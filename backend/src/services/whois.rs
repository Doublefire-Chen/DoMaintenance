use chrono::{NaiveDate, Utc};
use reqwest::header::ACCEPT;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::Serialize;
use uuid::Uuid;

use crate::entities::domain;

#[derive(Serialize, Debug)]
pub struct DomainLookup {
    pub expiration_date: Option<NaiveDate>,
    pub registration_date: Option<NaiveDate>,
}

#[derive(Serialize, Debug)]
pub struct RefreshDomainsSummary {
    pub total_domains: usize,
    pub attempted: usize,
    pub updated: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(format!(
            "{}/{} (+http://localhost)",
            env!("CARGO_PKG_NAME"),
            env!("CARGO_PKG_VERSION")
        ))
        .build()
        .map_err(|e| format!("Failed to build RDAP client: {}", e))
}

pub async fn lookup_domain(domain: &str) -> Result<DomainLookup, String> {
    let client = build_client()?;
    lookup_domain_with_client(&client, domain).await
}

async fn lookup_domain_with_client(client: &reqwest::Client, domain: &str) -> Result<DomainLookup, String> {
    let url = format!("https://rdap.org/domain/{}", domain);

    let resp = client
        .get(&url)
        .header(ACCEPT, "application/rdap+json, application/json;q=0.9, */*;q=0.1")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("RDAP request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("RDAP returned status {}", resp.status()));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse RDAP response: {}", e))?;

    let mut expiration_date = None;
    let mut registration_date = None;

    if let Some(events) = body.get("events").and_then(|e| e.as_array()) {
        for event in events {
            let action = event.get("eventAction").and_then(|a| a.as_str());
            let date_str = event.get("eventDate").and_then(|d| d.as_str());

            if let (Some(action), Some(date_str)) = (action, date_str) {
                // eventDate is typically ISO 8601: "2025-12-31T00:00:00Z"
                let date = date_str
                    .get(..10)
                    .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

                match action {
                    "expiration" => expiration_date = date,
                    "registration" => registration_date = date,
                    _ => {}
                }
            }
        }
    }

    Ok(DomainLookup {
        expiration_date,
        registration_date,
    })
}

pub async fn refresh_domain_record(
    db: &DatabaseConnection,
    record: domain::Model,
) -> Result<bool, String> {
    let lookup = lookup_domain(&record.name).await?;
    let mut changed = false;
    let mut model: domain::ActiveModel = record.clone().into();

    if let Some(registration_date) = lookup.registration_date {
        if record.registration_date != Some(registration_date) {
            model.registration_date = Set(Some(registration_date));
            changed = true;
        }
    }

    if let Some(expiration_date) = lookup.expiration_date {
        if record.expiration_date != expiration_date {
            model.expiration_date = Set(expiration_date);
            changed = true;
        }
    }

    if changed {
        model.updated_at = Set(Utc::now().fixed_offset());
        model
            .update(db)
            .await
            .map_err(|e| format!("Failed to update {}: {}", record.name, e))?;
    }

    Ok(changed)
}

pub async fn refresh_all_domains(db: &DatabaseConnection) -> RefreshDomainsSummary {
    refresh_domains(db, None).await
}

pub async fn refresh_selected_domains(
    db: &DatabaseConnection,
    ids: &[Uuid],
) -> RefreshDomainsSummary {
    refresh_domains(db, Some(ids)).await
}

async fn refresh_domains(
    db: &DatabaseConnection,
    ids: Option<&[Uuid]>,
) -> RefreshDomainsSummary {
    let mut query = domain::Entity::find();
    if let Some(ids) = ids {
        query = query.filter(domain::Column::Id.is_in(ids.iter().copied()));
    }

    let domains = match query.all(db).await {
        Ok(domains) => domains,
        Err(err) => {
            return RefreshDomainsSummary {
                total_domains: 0,
                attempted: 0,
                updated: 0,
                failed: 1,
                errors: vec![format!("Failed to load domains: {}", err)],
            };
        }
    };

    let total_domains = domains.len();
    let mut attempted = 0;
    let mut updated = 0;
    let mut errors = Vec::new();

    for record in domains {
        attempted += 1;
        match refresh_domain_record(db, record).await {
            Ok(true) => updated += 1,
            Ok(false) => {}
            Err(err) => errors.push(err),
        }
    }

    RefreshDomainsSummary {
        total_domains,
        attempted,
        updated,
        failed: errors.len(),
        errors,
    }
}
