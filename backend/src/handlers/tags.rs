use axum::{extract::{Path, State}, Json};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use serde::Deserialize;
use uuid::Uuid;

use crate::entities::tag;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct TagPayload {
    pub name: String,
    pub color: Option<String>,
}

pub async fn list(
    State(state): State<crate::AppState>,
) -> Result<Json<Vec<tag::Model>>, AppError> {
    let tags = tag::Entity::find().all(&state.db).await?;
    Ok(Json(tags))
}

pub async fn get(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<tag::Model>, AppError> {
    let t = tag::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound("Tag not found".to_string()))?;
    Ok(Json(t))
}

pub async fn create(
    State(state): State<crate::AppState>,
    Json(payload): Json<TagPayload>,
) -> Result<Json<tag::Model>, AppError> {
    let now = Utc::now().fixed_offset();
    let model = tag::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(payload.name),
        color: Set(payload.color),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let result = model.insert(&state.db).await?;
    Ok(Json(result))
}

pub async fn update(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<TagPayload>,
) -> Result<Json<tag::Model>, AppError> {
    let t = tag::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound("Tag not found".to_string()))?;

    let mut model: tag::ActiveModel = t.into();
    model.name = Set(payload.name);
    model.color = Set(payload.color);
    model.updated_at = Set(Utc::now().fixed_offset());

    let result = model.update(&state.db).await?;
    Ok(Json(result))
}

pub async fn delete(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = tag::Entity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound("Tag not found".to_string()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
