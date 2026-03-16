use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, Utc};
use reqwest::header::ACCEPT;
use reqwest::StatusCode;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;

use crate::entities::domain;

#[derive(Serialize, Debug)]
pub struct DomainLookup {
    pub expiration_date: Option<DateTime<FixedOffset>>,
    pub registration_date: Option<DateTime<FixedOffset>>,
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

fn parse_rdap_event_date(date_str: &str) -> Option<DateTime<FixedOffset>> {
    DateTime::parse_from_rfc3339(date_str)
        .ok()
        .or_else(|| {
            NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
                .ok()
                .and_then(|date| date.and_hms_opt(0, 0, 0))
                .and_then(|date_time| FixedOffset::east_opt(0).map(|offset| {
                    DateTime::<FixedOffset>::from_naive_utc_and_offset(date_time, offset)
                }))
        })
}

fn domain_tld(domain: &str) -> Option<&str> {
    domain.rsplit('.').next()
}

fn requires_manual_dates(domain: &str) -> bool {
    matches!(domain_tld(domain), Some("cy"))
}

pub async fn lookup_domain(domain: &str) -> Result<DomainLookup, String> {
    let client = build_client()?;
    lookup_domain_with_client(&client, domain).await
}

async fn lookup_domain_with_client(client: &reqwest::Client, domain: &str) -> Result<DomainLookup, String> {
    if requires_manual_dates(domain) {
        return Err(format!(
            "The .cy registry does not provide a supported automated lookup; enter dates manually for {}",
            domain
        ));
    }

    if matches!(domain_tld(domain), Some("mk")) {
        return lookup_mk_domain(domain).await;
    }

    lookup_rdap_domain_with_client(client, domain).await
}

async fn lookup_rdap_domain_with_client(
    client: &reqwest::Client,
    domain: &str,
) -> Result<DomainLookup, String> {
    let url = format!("https://rdap.org/domain/{}", domain);

    let resp = client
        .get(&url)
        .header(ACCEPT, "application/rdap+json, application/json;q=0.9, */*;q=0.1")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("RDAP request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let final_host = resp.url().host_str().unwrap_or_default().to_string();

        if status == StatusCode::NOT_FOUND && final_host == "rdap.org" {
            let tld = domain_tld(domain).unwrap_or(domain);
            return Err(format!(
                "No authoritative RDAP service is published for .{}; enter dates manually for {}",
                tld, domain
            ));
        }

        if status == StatusCode::NOT_FOUND {
            return Err(format!("Domain not found in registry RDAP: {}", domain));
        }

        return Err(format!("RDAP returned status {}", status));
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
                let date = parse_rdap_event_date(date_str);

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

fn parse_mk_datetime(date_str: &str) -> Option<DateTime<FixedOffset>> {
    NaiveDateTime::parse_from_str(date_str, "%d.%m.%Y %H:%M:%S")
        .ok()
        .and_then(|date_time| {
            FixedOffset::east_opt(0).map(|offset| {
                DateTime::<FixedOffset>::from_naive_utc_and_offset(date_time, offset)
            })
        })
}

fn parse_mk_date(date_str: &str) -> Option<DateTime<FixedOffset>> {
    NaiveDate::parse_from_str(date_str, "%d.%m.%Y")
        .ok()
        .and_then(|date| date.and_hms_opt(0, 0, 0))
        .and_then(|date_time| {
            FixedOffset::east_opt(0).map(|offset| {
                DateTime::<FixedOffset>::from_naive_utc_and_offset(date_time, offset)
            })
        })
}

fn parse_mk_whois_response(domain: &str, body: &str) -> Result<DomainLookup, String> {
    let lowered = body.to_ascii_lowercase();
    if lowered.contains("not found")
        || lowered.contains("no entries found")
        || lowered.contains("no match")
    {
        return Err(format!("Domain not found in .mk WHOIS: {}", domain));
    }

    let mut registration_date = None;
    let mut expiration_date = None;

    for line in body.lines() {
        let trimmed = line.trim();

        if let Some(value) = trimmed.strip_prefix("registered:") {
            registration_date = parse_mk_datetime(value.trim());
        } else if let Some(value) = trimmed.strip_prefix("expire:") {
            expiration_date = parse_mk_date(value.trim());
        }
    }

    if registration_date.is_none() && expiration_date.is_none() {
        return Err(format!(
            "Failed to parse .mk WHOIS response for {}; required date fields were not found",
            domain
        ));
    }

    Ok(DomainLookup {
        expiration_date,
        registration_date,
    })
}

async fn lookup_mk_domain(domain: &str) -> Result<DomainLookup, String> {
    let mut stream = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        tokio::net::TcpStream::connect(("whois.marnet.mk", 43)),
    )
    .await
    .map_err(|_| format!("WHOIS request timed out for {}", domain))?
    .map_err(|e| format!("Failed to connect to .mk WHOIS for {}: {}", domain, e))?;

    stream
        .write_all(format!("{}\r\n", domain).as_bytes())
        .await
        .map_err(|e| format!("Failed to send .mk WHOIS query for {}: {}", domain, e))?;

    let mut body = String::new();
    stream
        .read_to_string(&mut body)
        .await
        .map_err(|e| format!("Failed to read .mk WHOIS response for {}: {}", domain, e))?;

    if body.trim().is_empty() {
        return Err(format!("Empty .mk WHOIS response for {}", domain));
    }

    parse_mk_whois_response(domain, &body)
}

async fn refresh_domain_record_with_client(
    db: &DatabaseConnection,
    client: &reqwest::Client,
    record: domain::Model,
) -> Result<bool, String> {
    let lookup = lookup_domain_with_client(client, &record.name).await?;
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

pub async fn refresh_all_domains(
    db: &DatabaseConnection,
    delay_ms: u64,
) -> RefreshDomainsSummary {
    refresh_domains(db, None, delay_ms).await
}

pub async fn refresh_selected_domains(
    db: &DatabaseConnection,
    ids: &[Uuid],
    delay_ms: u64,
) -> RefreshDomainsSummary {
    refresh_domains(db, Some(ids), delay_ms).await
}

async fn refresh_domains(
    db: &DatabaseConnection,
    ids: Option<&[Uuid]>,
    delay_ms: u64,
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
    let total_refreshable = domains
        .iter()
        .filter(|record| !requires_manual_dates(&record.name))
        .count();
    let mut attempted = 0;
    let mut updated = 0;
    let mut errors = Vec::new();
    let client = match build_client() {
        Ok(client) => client,
        Err(err) => {
            return RefreshDomainsSummary {
                total_domains,
                attempted: 0,
                updated: 0,
                failed: total_domains.max(1),
                errors: vec![err],
            };
        }
    };

    for record in domains {
        if requires_manual_dates(&record.name) {
            continue;
        }

        attempted += 1;
        match refresh_domain_record_with_client(db, &client, record).await {
            Ok(true) => updated += 1,
            Ok(false) => {}
            Err(err) => errors.push(err),
        }

        if delay_ms > 0 && attempted < total_refreshable {
            tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
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
