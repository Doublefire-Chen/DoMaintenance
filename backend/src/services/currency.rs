use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal::prelude::*;
use sea_orm::{DatabaseConnection, EntityTrait, ActiveModelTrait, Set, QueryOrder, ColumnTrait, QueryFilter};
use uuid::Uuid;

use crate::entities::exchange_rate;

pub const SUPPORTED_CURRENCIES: [&str; 9] = [
    "USD", "EUR", "SEK", "GBP", "JPY", "CNY", "CHF", "CAD", "AUD",
];

#[derive(Clone, Debug)]
pub struct CachedRates {
    pub rates: HashMap<String, Decimal>, // currency -> rate relative to USD
    pub fetched_at: chrono::DateTime<Utc>,
}

pub type CurrencyService = Arc<RwLock<CachedRates>>;

pub async fn init(db: &DatabaseConnection) -> CurrencyService {
    let cached = Arc::new(RwLock::new(CachedRates {
        rates: default_rates(),
        fetched_at: Utc::now(),
    }));

    // Try to load from external API first
    if let Ok(rates) = fetch_rates_from_api().await {
        {
            let mut cache = cached.write().await;
            cache.rates = rates.clone();
            cache.fetched_at = Utc::now();
        }
        // Persist to DB
        persist_rates(db, &rates).await;
    } else {
        // Fallback: load from DB
        if let Ok(rates) = load_rates_from_db(db).await {
            if !rates.is_empty() {
                let mut cache = cached.write().await;
                cache.rates = rates;
                cache.fetched_at = Utc::now();
            }
        }
    }

    // Spawn background refresh task
    let cached_clone = cached.clone();
    let db_clone = db.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(6 * 3600));
        interval.tick().await; // skip first immediate tick
        loop {
            interval.tick().await;
            tracing::info!("Refreshing exchange rates...");
            if let Ok(rates) = fetch_rates_from_api().await {
                {
                    let mut cache = cached_clone.write().await;
                    cache.rates = rates.clone();
                    cache.fetched_at = Utc::now();
                }
                persist_rates(&db_clone, &rates).await;
                tracing::info!("Exchange rates refreshed successfully");
            } else {
                tracing::warn!("Failed to refresh exchange rates, using cached values");
            }
        }
    });

    cached
}

fn default_rates() -> HashMap<String, Decimal> {
    let mut rates = HashMap::new();
    rates.insert("USD".to_string(), Decimal::ONE);
    rates.insert("EUR".to_string(), Decimal::from_str("0.92").unwrap());
    rates.insert("SEK".to_string(), Decimal::from_str("10.35").unwrap());
    rates.insert("GBP".to_string(), Decimal::from_str("0.79").unwrap());
    rates.insert("JPY".to_string(), Decimal::from_str("149.50").unwrap());
    rates.insert("CNY".to_string(), Decimal::from_str("7.25").unwrap());
    rates.insert("CHF".to_string(), Decimal::from_str("0.88").unwrap());
    rates.insert("CAD".to_string(), Decimal::from_str("1.35").unwrap());
    rates.insert("AUD".to_string(), Decimal::from_str("1.52").unwrap());
    rates
}

async fn fetch_rates_from_api() -> Result<HashMap<String, Decimal>, reqwest::Error> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.frankfurter.app/latest?from=USD")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    let mut rates = HashMap::new();
    rates.insert("USD".to_string(), Decimal::ONE);

    if let Some(rate_map) = resp.get("rates").and_then(|r| r.as_object()) {
        for (currency, value) in rate_map {
            if !is_supported_currency(currency) {
                continue;
            }
            if let Some(rate) = value.as_f64() {
                if let Some(dec) = Decimal::from_f64_retain(rate) {
                    rates.insert(currency.clone(), dec);
                }
            }
        }
    }

    Ok(rates)
}

async fn persist_rates(db: &DatabaseConnection, rates: &HashMap<String, Decimal>) {
    let now = Utc::now().fixed_offset();
    for (currency, rate) in rates {
        let model = exchange_rate::ActiveModel {
            id: Set(Uuid::new_v4()),
            base_currency: Set("USD".to_string()),
            target_currency: Set(currency.clone()),
            rate: Set(*rate),
            fetched_at: Set(now),
        };
        let _ = model.insert(db).await;
    }
}

async fn load_rates_from_db(db: &DatabaseConnection) -> Result<HashMap<String, Decimal>, sea_orm::DbErr> {
    // Get the most recent rates for each currency
    let records = exchange_rate::Entity::find()
        .filter(exchange_rate::Column::BaseCurrency.eq("USD"))
        .order_by_desc(exchange_rate::Column::FetchedAt)
        .all(db)
        .await?;

    let mut rates = HashMap::new();
    for record in records {
        if !is_supported_currency(&record.target_currency) {
            continue;
        }
        rates.entry(record.target_currency).or_insert(record.rate);
    }
    Ok(rates)
}

pub fn convert(rates: &HashMap<String, Decimal>, from: &str, to: &str, amount: Decimal) -> Option<Decimal> {
    if from == to {
        return Some(amount);
    }

    let from_rate = rates.get(from)?;
    let to_rate = rates.get(to)?;

    // Convert: amount_in_from * (to_rate / from_rate)
    Some(amount * to_rate / from_rate)
}

pub fn available_currencies(rates: &HashMap<String, Decimal>) -> Vec<String> {
    SUPPORTED_CURRENCIES
        .iter()
        .filter(|currency| rates.contains_key(**currency))
        .map(|currency| (*currency).to_string())
        .collect()
}

pub fn is_supported_currency(currency: &str) -> bool {
    SUPPORTED_CURRENCIES
        .iter()
        .any(|supported| supported.eq_ignore_ascii_case(currency))
}

pub fn normalize_supported_currency(currency: Option<&str>) -> String {
    let fallback = "CNY".to_string();
    let Some(currency) = currency else {
        return fallback;
    };

    let normalized = currency.trim().to_uppercase();
    if is_supported_currency(&normalized) {
        normalized
    } else {
        fallback
    }
}
