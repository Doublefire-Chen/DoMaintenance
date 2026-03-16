use axum::{extract::State, Json};
use rust_decimal::Decimal;
use serde::Serialize;

#[derive(Serialize)]
pub struct CurrencyRateResponse {
    pub code: String,
    pub rate: Decimal,
}

#[derive(Serialize)]
pub struct CurrencyStatusResponse {
    pub fetched_at: chrono::DateTime<chrono::Utc>,
    pub currencies: Vec<CurrencyRateResponse>,
}

pub async fn list(
    State(state): State<crate::AppState>,
) -> Json<CurrencyStatusResponse> {
    let rates = state.currency.read().await;
    let mut currencies: Vec<CurrencyRateResponse> = rates
        .rates
        .iter()
        .map(|(code, rate)| CurrencyRateResponse {
            code: code.clone(),
            rate: *rate,
        })
        .collect();

    currencies.sort_by(|a, b| a.code.cmp(&b.code));

    Json(CurrencyStatusResponse {
        fetched_at: rates.fetched_at,
        currencies,
    })
}
