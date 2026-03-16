use axum::{extract::State, Json};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::services::currency;

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
    let currencies: Vec<CurrencyRateResponse> = currency::available_currencies(&rates.rates)
        .into_iter()
        .filter_map(|code| {
            rates.rates.get(&code).map(|rate| CurrencyRateResponse {
                code,
                rate: *rate,
            })
        })
        .collect();

    Json(CurrencyStatusResponse {
        fetched_at: rates.fetched_at,
        currencies,
    })
}
