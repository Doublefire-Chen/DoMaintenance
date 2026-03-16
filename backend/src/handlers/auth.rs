use axum::{extract::State, http::StatusCode, Json};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use chrono::{Duration, Utc};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, Set};
use serde::Deserialize;
use uuid::Uuid;

use crate::entities::{session, user};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

pub async fn login(
    State(state): State<crate::AppState>,
    jar: CookieJar,
    Json(payload): Json<LoginRequest>,
) -> Result<(CookieJar, StatusCode), AppError> {
    let user = user::Entity::find()
        .filter(user::Column::Username.eq(&payload.username))
        .one(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    // Verify password
    let parsed_hash = argon2::PasswordHash::new(&user.password_hash)
        .map_err(|_| AppError::Internal("Invalid password hash".to_string()))?;

    use argon2::PasswordVerifier;
    argon2::Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)?;

    // Create session
    let session_id = Uuid::new_v4();
    let now = Utc::now().fixed_offset();
    let expires_at = (Utc::now() + Duration::days(7)).fixed_offset();

    let session_model = session::ActiveModel {
        id: Set(session_id),
        user_id: Set(user.id),
        expires_at: Set(expires_at),
        created_at: Set(now),
        updated_at: Set(now),
    };
    session_model.insert(&state.db).await?;

    let cookie = Cookie::build(("session_id", session_id.to_string()))
        .path("/")
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .max_age(time::Duration::days(7))
        .build();

    Ok((jar.add(cookie), StatusCode::OK))
}

pub async fn logout(
    State(state): State<crate::AppState>,
    jar: CookieJar,
) -> Result<CookieJar, AppError> {
    if let Some(cookie) = jar.get("session_id") {
        if let Ok(session_id) = Uuid::parse_str(cookie.value()) {
            let _ = session::Entity::delete_by_id(session_id).exec(&state.db).await;
        }
    }

    let cookie = Cookie::build(("session_id", ""))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::ZERO)
        .build();

    Ok(jar.remove(cookie))
}

pub async fn register(
    State(state): State<crate::AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let allow = state.app_settings.allow_register().await;

    if !allow {
        return Err(AppError::BadRequest("Registration is closed".to_string()));
    }

    let count = user::Entity::find().count(&state.db).await?;
    if count > 0 {
        return Err(AppError::BadRequest("An account already exists".to_string()));
    }

    use argon2::PasswordHasher;
    let salt = argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
    let password_hash = argon2::Argon2::default()
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|_| AppError::Internal("Failed to hash password".to_string()))?
        .to_string();

    let now = Utc::now().fixed_offset();
    let user_model = user::ActiveModel {
        id: Set(Uuid::new_v4()),
        username: Set(payload.username.clone()),
        password_hash: Set(password_hash),
        created_at: Set(now),
        updated_at: Set(now),
    };
    user_model.insert(&state.db).await?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "message": "User created" }))))
}

pub async fn allow_register(
    State(state): State<crate::AppState>,
) -> Json<serde_json::Value> {
    let allow = state.app_settings.allow_register().await;
    Json(serde_json::json!({ "allow_register": allow }))
}

pub async fn me(
    State(state): State<crate::AppState>,
    jar: CookieJar,
) -> Result<Json<serde_json::Value>, AppError> {
    let session_id = jar
        .get("session_id")
        .and_then(|c| Uuid::parse_str(c.value()).ok())
        .ok_or(AppError::Unauthorized)?;

    let session = session::Entity::find_by_id(session_id)
        .one(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    if session.expires_at < Utc::now().fixed_offset() {
        let _ = session::Entity::delete_by_id(session_id).exec(&state.db).await;
        return Err(AppError::Unauthorized);
    }

    let user = user::Entity::find_by_id(session.user_id)
        .one(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    Ok(Json(serde_json::json!({
        "id": user.id,
        "username": user.username,
    })))
}
