use std::io::{Cursor, Read, Write};
use std::path::PathBuf;

use axum::{
    body,
    extract::{Request, State},
    http::{
        header::{CONTENT_DISPOSITION, CONTENT_TYPE},
        HeaderMap, HeaderValue, StatusCode,
    },
    Json,
};
use chrono::Utc;
use sea_orm::{EntityTrait, QueryOrder};
use serde::Serialize;
use tokio::{fs, process::Command};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

use crate::entities::{domain, registrar};
use crate::errors::AppError;

const DATABASE_SQL_ENTRY: &str = "database.sql";
const DOMAIN_FAVICON_PREFIX: &str = "favicons/domains/";
const REGISTRAR_FAVICON_PREFIX: &str = "favicons/registrars/";

#[derive(Serialize)]
pub struct ImportMigrationResponse {
    pub message: String,
    pub imported_domain_favicons: usize,
    pub imported_registrar_favicons: usize,
}

#[derive(Default)]
struct ValidatedMigrationPackage {
    database_sql: Vec<u8>,
    domain_favicons: Vec<(Uuid, Vec<u8>)>,
    registrar_favicons: Vec<(Uuid, Vec<u8>)>,
}

fn zip_error(err: impl std::fmt::Display) -> AppError {
    AppError::Internal(format!("Migration zip error: {}", err))
}

fn database_url() -> Result<String, AppError> {
    std::env::var("DATABASE_URL")
        .map_err(|_| AppError::Internal("DATABASE_URL is not set".to_string()))
}

fn parse_uuid_from_entry(name: &str, prefix: &str) -> Option<Uuid> {
    let filename = name.strip_prefix(prefix)?;
    let id = filename.split('.').next()?;
    Uuid::parse_str(id).ok()
}

async fn run_command(mut command: Command, action: &str) -> Result<Vec<u8>, AppError> {
    let output = command
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to {}: {}", action, e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let message = if stderr.is_empty() {
            format!("Failed to {}", action)
        } else {
            format!("Failed to {}: {}", action, stderr)
        };
        return Err(AppError::Internal(message));
    }

    Ok(output.stdout)
}

async fn dump_database_sql() -> Result<Vec<u8>, AppError> {
    let database_url = database_url()?;
    let mut command = Command::new("pg_dump");
    command
        .arg("--dbname")
        .arg(database_url)
        .arg("--clean")
        .arg("--if-exists")
        .arg("--no-owner")
        .arg("--no-privileges")
        .arg("--format=plain");

    run_command(command, "export database backup").await
}

fn make_temp_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("domaintenance-{}-{}", name, Uuid::new_v4()))
}

async fn clear_database() -> Result<(), AppError> {
    let database_url = database_url()?;
    let mut command = Command::new("psql");
    command
        .arg(database_url)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-c")
        .arg("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

    run_command(command, "clear current database").await?;
    Ok(())
}

async fn restore_database_from_sql(sql_bytes: &[u8]) -> Result<(), AppError> {
    let database_url = database_url()?;
    let sql_path = make_temp_path("database-restore.sql");
    fs::write(&sql_path, sql_bytes)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write temporary database.sql: {}", e)))?;

    let mut command = Command::new("psql");
    command
        .arg(database_url)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-f")
        .arg(&sql_path);

    let result = run_command(command, "restore database backup").await;
    let _ = fs::remove_file(&sql_path).await;
    result.map(|_| ())
}

fn validate_package(mut archive: ZipArchive<Cursor<Vec<u8>>>) -> Result<ValidatedMigrationPackage, AppError> {
    let mut package = ValidatedMigrationPackage::default();

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(zip_error)?;
        let name = file.name().to_string();

        if file.is_dir() {
            continue;
        }

        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).map_err(zip_error)?;

        if name == DATABASE_SQL_ENTRY {
            if bytes.is_empty() {
                return Err(AppError::BadRequest("database.sql is empty".to_string()));
            }
            package.database_sql = bytes;
            continue;
        }

        if let Some(domain_id) = parse_uuid_from_entry(&name, DOMAIN_FAVICON_PREFIX) {
            package.domain_favicons.push((domain_id, bytes));
            continue;
        }

        if let Some(registrar_id) = parse_uuid_from_entry(&name, REGISTRAR_FAVICON_PREFIX) {
            package.registrar_favicons.push((registrar_id, bytes));
            continue;
        }

        return Err(AppError::BadRequest(format!(
            "Unsupported entry in migration package: {}",
            name
        )));
    }

    if package.database_sql.is_empty() {
        return Err(AppError::BadRequest(
            "Migration package is missing database.sql".to_string(),
        ));
    }

    Ok(package)
}

async fn sync_runtime_state(state: &crate::AppState) -> Result<(), AppError> {
    let allow_register = crate::services::app_settings::load_allow_register(&state.db).await;
    let whois_request_delay_ms =
        crate::services::app_settings::load_whois_request_delay_ms(&state.db).await;
    let date_time_display_format =
        crate::services::app_settings::load_date_time_display_format(&state.db).await;
    let whois_refresh_interval_hours =
        crate::services::whois_refresh::load_interval_hours(&state.db).await;

    state.app_settings.set_allow_register(allow_register).await;
    state
        .app_settings
        .set_whois_request_delay_ms(whois_request_delay_ms)
        .await;
    state
        .app_settings
        .set_date_time_display_format(date_time_display_format)
        .await;
    let _ = state
        .whois_refresh
        .set_hours(whois_refresh_interval_hours)
        .await;
    crate::services::currency::reload_cached_rates_from_db(&state.db, &state.currency)
        .await?;
    Ok(())
}

pub async fn export_data(
    State(state): State<crate::AppState>,
) -> Result<(HeaderMap, Vec<u8>), AppError> {
    let database_sql = dump_database_sql().await?;
    let domains = domain::Entity::find()
        .order_by_asc(domain::Column::DisplayOrder)
        .order_by_asc(domain::Column::Name)
        .all(&state.db)
        .await?;
    let registrars = registrar::Entity::find()
        .order_by_asc(registrar::Column::Name)
        .all(&state.db)
        .await?;

    let mut cursor = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut cursor);
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated);

        zip.start_file(DATABASE_SQL_ENTRY, options)
            .map_err(zip_error)?;
        zip.write_all(&database_sql).map_err(zip_error)?;

        for record in &domains {
            if let Ok(bytes) = crate::services::favicon::read_favicon(record.id).await {
                zip.start_file(
                    format!(
                        "{}{}.{}",
                        DOMAIN_FAVICON_PREFIX,
                        record.id,
                        crate::services::favicon::extension_for_bytes(&bytes),
                    ),
                    options,
                )
                .map_err(zip_error)?;
                zip.write_all(&bytes).map_err(zip_error)?;
            }
        }

        for record in &registrars {
            if let Ok(bytes) = crate::services::favicon::read_registrar_favicon(record.id).await {
                zip.start_file(
                    format!(
                        "{}{}.{}",
                        REGISTRAR_FAVICON_PREFIX,
                        record.id,
                        crate::services::favicon::extension_for_bytes(&bytes),
                    ),
                    options,
                )
                .map_err(zip_error)?;
                zip.write_all(&bytes).map_err(zip_error)?;
            }
        }

        zip.finish().map_err(zip_error)?;
    }

    let date_stamp = Utc::now().format("%Y-%m-%d");
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/zip"));
    headers.insert(
        CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!(
            "attachment; filename=\"domaintenance-backup-{}.zip\"",
            date_stamp
        ))
        .map_err(|e| AppError::Internal(format!("Failed to build download header: {}", e)))?,
    );

    Ok((headers, cursor.into_inner()))
}

pub async fn import_data(
    State(state): State<crate::AppState>,
    request: Request,
) -> Result<(StatusCode, Json<ImportMigrationResponse>), AppError> {
    let bytes = body::to_bytes(request.into_body(), usize::MAX)
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to read import package: {}", e)))?;
    let archive = ZipArchive::new(Cursor::new(bytes.to_vec())).map_err(zip_error)?;
    let package = validate_package(archive)?;

    clear_database().await?;
    restore_database_from_sql(&package.database_sql).await?;

    crate::services::favicon::clear_storage()
        .await
        .map_err(AppError::Internal)?;

    for (domain_id, bytes) in &package.domain_favicons {
        crate::services::favicon::write_favicon(*domain_id, bytes)
            .await
            .map_err(AppError::Internal)?;
    }

    for (registrar_id, bytes) in &package.registrar_favicons {
        crate::services::favicon::write_registrar_favicon(*registrar_id, bytes)
            .await
            .map_err(AppError::Internal)?;
    }

    sync_runtime_state(&state).await?;

    Ok((
        StatusCode::OK,
        Json(ImportMigrationResponse {
            message: "Backup restored. Please sign in again.".to_string(),
            imported_domain_favicons: package.domain_favicons.len(),
            imported_registrar_favicons: package.registrar_favicons.len(),
        }),
    ))
}
