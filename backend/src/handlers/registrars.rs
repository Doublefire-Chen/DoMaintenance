use axum::{extract::{Path, State}, Json};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, Set};
use serde::Deserialize;
use uuid::Uuid;

use crate::entities::registrar;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct RegistrarPayload {
    pub name: String,
    pub website: Option<String>,
}

pub async fn list(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
) -> Result<Json<Vec<registrar::Model>>, AppError> {
    let registrars = registrar::Entity::find().all(&db).await?;
    Ok(Json(registrars))
}

pub async fn get(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
    Path(id): Path<Uuid>,
) -> Result<Json<registrar::Model>, AppError> {
    let reg = registrar::Entity::find_by_id(id)
        .one(&db)
        .await?
        .ok_or(AppError::NotFound("Registrar not found".to_string()))?;
    Ok(Json(reg))
}

pub async fn create(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
    Json(payload): Json<RegistrarPayload>,
) -> Result<Json<registrar::Model>, AppError> {
    let now = Utc::now().fixed_offset();
    let model = registrar::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(payload.name),
        website: Set(payload.website),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let result = model.insert(&db).await?;
    Ok(Json(result))
}

pub async fn update(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
    Path(id): Path<Uuid>,
    Json(payload): Json<RegistrarPayload>,
) -> Result<Json<registrar::Model>, AppError> {
    let reg = registrar::Entity::find_by_id(id)
        .one(&db)
        .await?
        .ok_or(AppError::NotFound("Registrar not found".to_string()))?;

    let mut model: registrar::ActiveModel = reg.into();
    model.name = Set(payload.name);
    model.website = Set(payload.website);
    model.updated_at = Set(Utc::now().fixed_offset());

    let result = model.update(&db).await?;
    Ok(Json(result))
}

pub async fn delete(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = registrar::Entity::delete_by_id(id).exec(&db).await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound("Registrar not found".to_string()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
