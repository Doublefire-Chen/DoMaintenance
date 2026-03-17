use std::{
    path::{Path, PathBuf},
    sync::OnceLock,
};

use reqwest::header::CONTENT_TYPE;
use tokio::fs;
use uuid::Uuid;

static FAVICON_DIR: OnceLock<PathBuf> = OnceLock::new();

fn favicon_dir() -> &'static PathBuf {
    FAVICON_DIR.get_or_init(|| {
        let storage_root = std::env::var("STORAGE_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                std::env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .join("storage")
            });
        storage_root.join("favicons")
    })
}

fn favicon_path(domain_id: Uuid) -> PathBuf {
    Path::new(favicon_dir()).join(domain_id.to_string())
}

fn registrar_favicon_path(registrar_id: Uuid) -> PathBuf {
    Path::new(favicon_dir()).join(format!("registrar-{}", registrar_id))
}

pub async fn ensure_storage_dir() -> Result<(), String> {
    fs::create_dir_all(favicon_dir())
        .await
        .map_err(|e| format!("Failed to create favicon storage directory: {}", e))
}

pub async fn clear_storage() -> Result<(), String> {
    match fs::remove_dir_all(favicon_dir()).await {
        Ok(_) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => {
            return Err(format!("Failed to clear favicon storage directory: {}", err));
        }
    }

    ensure_storage_dir().await
}

pub async fn favicon_url(domain_id: Uuid) -> Option<String> {
    if fs::metadata(favicon_path(domain_id)).await.is_ok() {
        Some(format!("/public/favicons/{}", domain_id))
    } else {
        None
    }
}

pub async fn read_favicon(domain_id: Uuid) -> Result<Vec<u8>, String> {
    fs::read(favicon_path(domain_id))
        .await
        .map_err(|e| format!("Failed to read favicon: {}", e))
}

pub async fn registrar_favicon_url(registrar_id: Uuid) -> Option<String> {
    if fs::metadata(registrar_favicon_path(registrar_id)).await.is_ok() {
        Some(format!("/public/registrar-favicons/{}", registrar_id))
    } else {
        None
    }
}

pub async fn read_registrar_favicon(registrar_id: Uuid) -> Result<Vec<u8>, String> {
    fs::read(registrar_favicon_path(registrar_id))
        .await
        .map_err(|e| format!("Failed to read registrar favicon: {}", e))
}

pub async fn write_favicon(domain_id: Uuid, bytes: &[u8]) -> Result<(), String> {
    ensure_storage_dir().await?;
    fs::write(favicon_path(domain_id), bytes)
        .await
        .map_err(|e| format!("Failed to save favicon: {}", e))
}

pub async fn write_registrar_favicon(registrar_id: Uuid, bytes: &[u8]) -> Result<(), String> {
    ensure_storage_dir().await?;
    fs::write(registrar_favicon_path(registrar_id), bytes)
        .await
        .map_err(|e| format!("Failed to save registrar favicon: {}", e))
}

pub fn detect_content_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x00, 0x00, 0x01, 0x00]) {
        return "image/x-icon";
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return "image/png";
    }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return "image/jpeg";
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return "image/gif";
    }
    if bytes.len() > 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return "image/webp";
    }
    if let Ok(text) = std::str::from_utf8(bytes) {
        if text.contains("<svg") {
            return "image/svg+xml";
        }
    }

    "application/octet-stream"
}

pub fn extension_for_bytes(bytes: &[u8]) -> &'static str {
    match detect_content_type(bytes) {
        "image/x-icon" => "ico",
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        _ => "bin",
    }
}

pub async fn refresh_domain_favicon(domain_id: Uuid, domain_name: &str) -> Result<(), String> {
    ensure_storage_dir().await?;

    let client = reqwest::Client::builder()
        .user_agent(format!(
            "{}/{} (+http://localhost)",
            env!("CARGO_PKG_NAME"),
            env!("CARGO_PKG_VERSION")
        ))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Failed to build favicon client: {}", e))?;

    let bytes = fetch_favicon_bytes(&client, domain_name).await?;
    write_favicon(domain_id, &bytes).await
}

pub async fn refresh_registrar_favicon(registrar_id: Uuid, website: &str) -> Result<(), String> {
    ensure_storage_dir().await?;

    let client = reqwest::Client::builder()
        .user_agent(format!(
            "{}/{} (+http://localhost)",
            env!("CARGO_PKG_NAME"),
            env!("CARGO_PKG_VERSION")
        ))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Failed to build favicon client: {}", e))?;

    let bytes = fetch_favicon_bytes(&client, website).await?;
    write_registrar_favicon(registrar_id, &bytes).await
}

async fn fetch_favicon_bytes(client: &reqwest::Client, source: &str) -> Result<Vec<u8>, String> {
    let normalized_base = normalize_base_url(source);
    let host = extract_host(source);
    let mut candidates = vec![
        format!("{}/favicon.ico", normalized_base),
    ];

    if let Some(host) = host.clone() {
        candidates.push(format!("https://{}/favicon.ico", host));
        candidates.push(format!("http://{}/favicon.ico", host));
    }

    if let Ok(icon_hrefs) = discover_icon_hrefs(client, &normalized_base).await {
        for icon_href in icon_hrefs.into_iter().rev() {
            candidates.insert(0, icon_href);
        }
    }

    for candidate in candidates {
        if let Ok(bytes) = try_download_icon(client, &candidate).await {
            return Ok(bytes);
        }
    }

    Err(format!("Failed to download favicon for {}", source))
}

async fn try_download_icon(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let response = client
        .get(url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Favicon request failed for {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Favicon request failed for {} with status {}",
            url,
            response.status()
        ));
    }

    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read favicon response for {}: {}", url, e))?;

    if bytes.is_empty() {
        return Err(format!("Empty favicon response for {}", url));
    }

    let detected = detect_content_type(bytes.as_ref());
    if !content_type.is_empty()
        && !content_type.starts_with("image/")
        && !content_type.contains("svg")
        && detected == "application/octet-stream"
    {
        return Err(format!("Unsupported favicon content type for {}: {}", url, content_type));
    }

    Ok(bytes.to_vec())
}

async fn discover_icon_hrefs(client: &reqwest::Client, base_url: &str) -> Result<Vec<String>, String> {
    let response = client
        .get(base_url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Homepage request failed for {}: {}", base_url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Homepage request failed for {} with status {}",
            base_url,
            response.status()
        ));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read homepage HTML for {}: {}", base_url, e))?;

    let mut hrefs = Vec::new();
    for tag in extract_link_tags(&html) {
        let lower = tag.to_ascii_lowercase();
        if !lower.contains("icon") {
            continue;
        }

        let Some(rel) = extract_attribute_value(tag, "rel") else {
            continue;
        };
        if !rel.to_ascii_lowercase().contains("icon") {
            continue;
        }

        let Some(href) = extract_attribute_value(tag, "href") else {
            continue;
        };
        hrefs.push(resolve_icon_href(base_url, &href));
    }

    hrefs.dedup();
    if hrefs.is_empty() {
        return Err(format!("No favicon link found for {}", base_url));
    }

    Ok(hrefs)
}

fn normalize_base_url(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('/');
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{}", trimmed)
    }
}

fn extract_host(value: &str) -> Option<String> {
    let normalized = normalize_base_url(value);
    let without_scheme = normalized
        .strip_prefix("https://")
        .or_else(|| normalized.strip_prefix("http://"))?;
    Some(without_scheme.split('/').next()?.to_string())
}

fn extract_link_tags(html: &str) -> Vec<&str> {
    html.split("<link").skip(1).filter_map(|fragment| {
        let end = fragment.find('>')?;
        Some(&fragment[..end])
    }).collect()
}

fn extract_attribute_value(tag_fragment: &str, attribute: &str) -> Option<String> {
    let pattern = format!("{}=", attribute);
    let lower = tag_fragment.to_ascii_lowercase();
    let start = lower.find(&pattern)?;
    let rest = &tag_fragment[start + pattern.len()..];
    let quote = rest.chars().next()?;

    if quote != '"' && quote != '\'' {
        return None;
    }

    let rest = &rest[1..];
    let end_index = rest.find(quote)?;
    Some(rest[..end_index].to_string())
}

fn resolve_icon_href(base_url: &str, href: &str) -> String {
    if href.starts_with("http://") || href.starts_with("https://") {
        return href.to_string();
    }
    if href.starts_with("//") {
        return format!("https:{}", href);
    }
    if href.starts_with('/') {
        return format!("{}{}", base_url, href);
    }
    format!("{}/{}", base_url.trim_end_matches('/'), href)
}
