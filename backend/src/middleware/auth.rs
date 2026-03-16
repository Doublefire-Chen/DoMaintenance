use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;
use chrono::Utc;
use sea_orm::{DatabaseConnection, EntityTrait};
use uuid::Uuid;

use crate::entities::session;

pub async fn require_auth(
    State(db): State<DatabaseConnection>,
    jar: CookieJar,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let session_id = jar
        .get("session_id")
        .and_then(|c| Uuid::parse_str(c.value()).ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let session = session::Entity::find_by_id(session_id)
        .one(&db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if session.expires_at < Utc::now().fixed_offset() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    request.extensions_mut().insert(session.user_id);
    Ok(next.run(request).await)
}
