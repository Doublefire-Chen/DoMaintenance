use chrono::NaiveDate;
use reqwest::header::ACCEPT;
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct DomainLookup {
    pub expiration_date: Option<NaiveDate>,
    pub registration_date: Option<NaiveDate>,
}

pub async fn lookup_domain(domain: &str) -> Result<DomainLookup, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!(
            "{}/{} (+http://localhost)",
            env!("CARGO_PKG_NAME"),
            env!("CARGO_PKG_VERSION")
        ))
        .build()
        .map_err(|e| format!("Failed to build RDAP client: {}", e))?;
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
