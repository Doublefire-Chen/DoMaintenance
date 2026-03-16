use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{errors::AppError, AppState};

#[derive(Serialize)]
pub struct SettingsResponse {
    pub allow_register: bool,
    pub whois_refresh_interval_hours: u64,
    pub whois_request_delay_ms: u64,
    pub date_time_display_format: String,
}

#[derive(Deserialize)]
pub struct SettingsPayload {
    pub allow_register: bool,
    pub whois_refresh_interval_hours: u64,
    pub whois_request_delay_ms: u64,
    pub date_time_display_format: String,
}

pub async fn get_settings(
    State(state): State<AppState>,
) -> Result<Json<SettingsResponse>, AppError> {
    let allow_register = state.app_settings.allow_register().await;
    let whois_refresh_interval_hours = state.whois_refresh.current_hours().await;
    let whois_request_delay_ms = state.app_settings.whois_request_delay_ms().await;
    let date_time_display_format = state.app_settings.date_time_display_format().await;

    Ok(Json(SettingsResponse {
        allow_register,
        whois_refresh_interval_hours,
        whois_request_delay_ms,
        date_time_display_format,
    }))
}

pub async fn update_settings(
    State(state): State<AppState>,
    Json(payload): Json<SettingsPayload>,
) -> Result<Json<SettingsResponse>, AppError> {
    crate::services::app_settings::save_allow_register(&state.db, payload.allow_register).await?;
    crate::services::whois_refresh::save_interval_hours(
        &state.db,
        payload.whois_refresh_interval_hours,
    )
    .await?;
    crate::services::app_settings::save_whois_request_delay_ms(
        &state.db,
        payload.whois_request_delay_ms,
    )
    .await?;
    let date_time_display_format =
        crate::services::app_settings::normalize_date_time_display_format(
            &payload.date_time_display_format,
        );
    crate::services::app_settings::save_date_time_display_format(
        &state.db,
        &date_time_display_format,
    )
    .await?;

    state
        .app_settings
        .set_allow_register(payload.allow_register)
        .await;
    state
        .app_settings
        .set_whois_request_delay_ms(payload.whois_request_delay_ms)
        .await;
    state
        .app_settings
        .set_date_time_display_format(date_time_display_format.clone())
        .await;
    state
        .whois_refresh
        .set_hours(payload.whois_refresh_interval_hours)
        .await
        .map_err(AppError::Internal)?;

    Ok(Json(SettingsResponse {
        allow_register: payload.allow_register,
        whois_refresh_interval_hours: payload.whois_refresh_interval_hours,
        whois_request_delay_ms: payload.whois_request_delay_ms,
        date_time_display_format,
    }))
}
