use axum::{extract::{Path, State}, Json};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::Deserialize;
use uuid::Uuid;

use crate::entities::{domain, registrar};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct RegistrarPayload {
    pub name: String,
    pub website: Option<String>,
}

#[derive(serde::Serialize)]
pub struct RefreshRegistrarFaviconsResponse {
    pub fetched: usize,
    pub total_domains: usize,
    pub covered_domains: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

pub async fn list(
    State(state): State<crate::AppState>,
) -> Result<Json<Vec<registrar::Model>>, AppError> {
    let registrars = registrar::Entity::find().all(&state.db).await?;
    Ok(Json(registrars))
}

pub async fn get(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<registrar::Model>, AppError> {
    let reg = registrar::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound("Registrar not found".to_string()))?;
    Ok(Json(reg))
}

pub async fn create(
    State(state): State<crate::AppState>,
    Json(payload): Json<RegistrarPayload>,
) -> Result<Json<registrar::Model>, AppError> {
    let now = Utc::now().fixed_offset();
    let website = payload.website.clone();
    let model = registrar::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(payload.name),
        website: Set(payload.website),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let result = model.insert(&state.db).await?;

    if let Some(website) = website {
        if let Err(err) = crate::services::favicon::refresh_registrar_favicon(result.id, &website).await {
            tracing::warn!("Failed to refresh favicon for registrar {}: {}", result.name, err);
        }
    }

    Ok(Json(result))
}

pub async fn update(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<RegistrarPayload>,
) -> Result<Json<registrar::Model>, AppError> {
    let reg = registrar::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound("Registrar not found".to_string()))?;

    let mut model: registrar::ActiveModel = reg.into();
    model.name = Set(payload.name);
    model.website = Set(payload.website.clone());
    model.updated_at = Set(Utc::now().fixed_offset());

    let result = model.update(&state.db).await?;

    if let Some(website) = payload.website {
        if let Err(err) = crate::services::favicon::refresh_registrar_favicon(result.id, &website).await {
            tracing::warn!("Failed to refresh favicon for registrar {}: {}", result.name, err);
        }
    }

    Ok(Json(result))
}

pub async fn delete(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = registrar::Entity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound("Registrar not found".to_string()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

pub async fn refresh_favicons(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RefreshRegistrarFaviconsResponse>, AppError> {
    let registrar = registrar::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound("Registrar not found".to_string()))?;

    let domains = domain::Entity::find()
        .filter(domain::Column::RegistrarId.eq(registrar.id))
        .all(&state.db)
        .await?;

    let total_domains = domains.len();
    let Some(website) = registrar.website.as_deref() else {
        return Err(AppError::BadRequest("Registrar website is required to refresh favicon".to_string()));
    };

    let mut fetched = 0;
    let mut covered_domains = 0;
    let mut errors = Vec::new();
    match crate::services::favicon::refresh_registrar_favicon(registrar.id, website).await {
        Ok(_) => {
            fetched = 1;
            covered_domains = total_domains;
        }
        Err(err) => errors.push(err),
    }

    Ok(Json(RefreshRegistrarFaviconsResponse {
        fetched,
        total_domains,
        covered_domains,
        failed: errors.len(),
        errors,
    }))
}
