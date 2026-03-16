use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{errors::AppError, AppState};

#[derive(Serialize)]
pub struct WhoisRefreshSettingsResponse {
    pub interval_hours: u64,
}

#[derive(Deserialize)]
pub struct WhoisRefreshSettingsPayload {
    pub interval_hours: u64,
}

pub async fn get_whois_refresh(
    State(state): State<AppState>,
) -> Result<Json<WhoisRefreshSettingsResponse>, AppError> {
    let interval_hours = state.whois_refresh.current_hours().await;
    Ok(Json(WhoisRefreshSettingsResponse { interval_hours }))
}

pub async fn update_whois_refresh(
    State(state): State<AppState>,
    Json(payload): Json<WhoisRefreshSettingsPayload>,
) -> Result<Json<WhoisRefreshSettingsResponse>, AppError> {
    crate::services::whois_refresh::save_interval_hours(&state.db, payload.interval_hours).await?;
    state
        .whois_refresh
        .set_hours(payload.interval_hours)
        .await
        .map_err(AppError::Internal)?;

    Ok(Json(WhoisRefreshSettingsResponse {
        interval_hours: payload.interval_hours,
    }))
}
