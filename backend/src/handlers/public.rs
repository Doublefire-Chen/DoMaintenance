use axum::{extract::{Query, State}, Json};
use chrono::Utc;
use rust_decimal::Decimal;
use sea_orm::{EntityTrait, ModelTrait};
use serde::{Deserialize, Serialize};

use crate::entities::{domain, registrar, tag};
use crate::errors::AppError;
use crate::services::currency;

#[derive(Deserialize)]
pub struct PublicQuery {
    pub display_currency: Option<String>,
}

#[derive(Serialize)]
pub struct PublicDomain {
    pub name: String,
    pub registrar: Option<registrar::Model>,
    pub tags: Vec<tag::Model>,
    pub registration_date: Option<chrono::NaiveDate>,
    pub registered_days: Option<i64>,
    pub remaining_days: i64,
    pub renewal_days: i32,
    pub status: String,
    pub renew_price: Option<Decimal>,
    pub currency: String,
    pub converted_price: Option<Decimal>,
}

#[derive(Serialize)]
pub struct CurrencyTotals {
    pub display_currency: String,
    pub total: Decimal,
}

#[derive(Serialize)]
pub struct PublicResponse {
    pub domains: Vec<PublicDomain>,
    pub currency_totals: CurrencyTotals,
    pub available_currencies: Vec<String>,
}

fn mask_domain(name: &str, level: i16) -> String {
    match level {
        0 => name.to_string(),
        1 => {
            // Keep first char + TLD, stars in middle
            if let Some(dot_pos) = name.rfind('.') {
                let tld = &name[dot_pos..];
                let prefix = &name[..dot_pos];
                if prefix.is_empty() {
                    return format!("***{}", tld);
                }
                let first = prefix.chars().next().unwrap();
                let stars = "*".repeat(prefix.len() - 1);
                format!("{}{}{}", first, stars, tld)
            } else {
                let first = name.chars().next().unwrap_or('*');
                format!("{}***", first)
            }
        }
        2 => {
            // *** + TLD
            if let Some(dot_pos) = name.rfind('.') {
                let tld = &name[dot_pos..];
                format!("***{}", tld)
            } else {
                "***".to_string()
            }
        }
        3 => "***.***".to_string(),
        _ => name.to_string(),
    }
}

fn calculate_status(remaining_days: i64) -> String {
    if remaining_days > 180 {
        "green".to_string()
    } else if remaining_days > 90 {
        "yellow".to_string()
    } else {
        "red".to_string()
    }
}

pub async fn get_domains(
    State(state): State<crate::AppState>,
    Query(query): Query<PublicQuery>,
) -> Result<Json<PublicResponse>, AppError> {
    let display_currency = query.display_currency.unwrap_or_else(|| "CNY".to_string());
    let today = Utc::now().date_naive();

    let domains = domain::Entity::find().all(&state.db).await?;
    let rates = state.currency.read().await;

    let mut public_domains = Vec::new();
    let mut total = Decimal::ZERO;

    for d in &domains {
        let reg = if let Some(rid) = d.registrar_id {
            registrar::Entity::find_by_id(rid).one(&state.db).await?
        } else {
            None
        };
        let tags = d.find_related(tag::Entity).all(&state.db).await?;

        let remaining_days = (d.expiration_date - today).num_days();
        let registered_days = d.registration_date.map(|registration_date| {
            (today - registration_date).num_days().max(0)
        });
        let status = calculate_status(remaining_days);
        let masked_name = mask_domain(&d.name, d.masking_level);

        let converted_price = d.renew_price.and_then(|price| {
            currency::convert(&rates.rates, &d.currency, &display_currency, price)
        });

        if let Some(cp) = converted_price {
            total += cp;
        }

        public_domains.push(PublicDomain {
            name: masked_name,
            registrar: reg,
            tags,
            registration_date: d.registration_date,
            registered_days,
            remaining_days,
            renewal_days: d.renewal_days,
            status,
            renew_price: d.renew_price,
            currency: d.currency.clone(),
            converted_price,
        });
    }

    let available = currency::available_currencies(&rates.rates);

    Ok(Json(PublicResponse {
        domains: public_domains,
        currency_totals: CurrencyTotals {
            display_currency,
            total,
        },
        available_currencies: available,
    }))
}

pub async fn get_currencies(
    State(state): State<crate::AppState>,
) -> Result<Json<Vec<String>>, AppError> {
    let rates = state.currency.read().await;
    Ok(Json(currency::available_currencies(&rates.rates)))
}
