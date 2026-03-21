use axum::{extract::{Path, State}, Json};
use chrono::Utc;
use rust_decimal::Decimal;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, ModelTrait, QueryFilter, QueryOrder, Set, TransactionTrait};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::{domain, domain_tag, registrar, tag};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct DomainPayload {
    pub name: String,
    pub registrar_id: Option<Uuid>,
    pub registration_date: Option<chrono::DateTime<chrono::FixedOffset>>,
    pub expiration_date: chrono::DateTime<chrono::FixedOffset>,
    pub display_order: Option<i32>,
    pub renewal_days: i32,
    pub renew_price: Option<Decimal>,
    pub currency: String,
    pub masking_level: i16,
    pub notes: Option<String>,
    pub tag_ids: Vec<Uuid>,
}

#[derive(Serialize)]
pub struct DomainResponse {
    #[serde(flatten)]
    pub domain: domain::Model,
    pub registrar: Option<registrar::Model>,
    pub tags: Vec<tag::Model>,
    pub favicon_url: Option<String>,
}

#[derive(Deserialize)]
pub struct RefreshDomainsPayload {
    pub domain_ids: Option<Vec<Uuid>>,
}

#[derive(Deserialize)]
pub struct ReorderDomainsPayload {
    pub domain_ids: Vec<Uuid>,
}

pub async fn list(
    State(state): State<crate::AppState>,
) -> Result<Json<Vec<DomainResponse>>, AppError> {
    let domains = domain::Entity::find()
        .order_by_asc(domain::Column::DisplayOrder)
        .order_by_asc(domain::Column::Name)
        .all(&state.db)
        .await?;
    let mut results = Vec::new();

    for d in domains {
        let reg = if let Some(rid) = d.registrar_id {
            registrar::Entity::find_by_id(rid).one(&state.db).await?
        } else {
            None
        };
        let favicon_url = if let Some(rid) = d.registrar_id {
            crate::services::favicon::registrar_favicon_url(rid).await
        } else {
            crate::services::favicon::favicon_url(d.id).await
        };
        let tags = d.find_related(tag::Entity).all(&state.db).await?;
        results.push(DomainResponse {
            domain: d,
            registrar: reg,
            tags,
            favicon_url,
        });
    }

    Ok(Json(results))
}

pub async fn get(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<DomainResponse>, AppError> {
    let d = domain::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound("Domain not found".to_string()))?;

    let reg = if let Some(rid) = d.registrar_id {
        registrar::Entity::find_by_id(rid).one(&state.db).await?
    } else {
        None
    };
    let tags = d.find_related(tag::Entity).all(&state.db).await?;
    let favicon_url = if let Some(rid) = d.registrar_id {
        crate::services::favicon::registrar_favicon_url(rid).await
    } else {
        crate::services::favicon::favicon_url(d.id).await
    };

    Ok(Json(DomainResponse {
        domain: d,
        registrar: reg,
        tags,
        favicon_url,
    }))
}

pub async fn create(
    State(state): State<crate::AppState>,
    Json(payload): Json<DomainPayload>,
) -> Result<Json<DomainResponse>, AppError> {
    let txn = state.db.begin().await?;
    let now = Utc::now().fixed_offset();
    let domain_id = Uuid::new_v4();
    let display_order = if let Some(display_order) = payload.display_order {
        display_order
    } else {
        domain::Entity::find()
            .order_by_desc(domain::Column::DisplayOrder)
            .one(&txn)
            .await?
            .map(|domain| domain.display_order + 1)
            .unwrap_or(0)
    };

    let model = domain::ActiveModel {
        id: Set(domain_id),
        name: Set(payload.name),
        registrar_id: Set(payload.registrar_id),
        registration_date: Set(payload.registration_date),
        expiration_date: Set(payload.expiration_date),
        display_order: Set(display_order),
        renewal_days: Set(payload.renewal_days),
        renew_price: Set(payload.renew_price),
        currency: Set(payload.currency),
        masking_level: Set(payload.masking_level),
        notes: Set(payload.notes),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let d = model.insert(&txn).await?;

    // Insert domain_tags
    for tag_id in &payload.tag_ids {
        let dt = domain_tag::ActiveModel {
            domain_id: Set(domain_id),
            tag_id: Set(*tag_id),
        };
        dt.insert(&txn).await?;
    }

    txn.commit().await?;

    // Fetch related data for response
    let reg = if let Some(rid) = d.registrar_id {
        registrar::Entity::find_by_id(rid).one(&state.db).await?
    } else {
        None
    };
    let tags = d.find_related(tag::Entity).all(&state.db).await?;
    let favicon_url = if let Some(rid) = d.registrar_id {
        crate::services::favicon::registrar_favicon_url(rid).await
    } else {
        crate::services::favicon::favicon_url(d.id).await
    };

    Ok(Json(DomainResponse {
        domain: d,
        registrar: reg,
        tags,
        favicon_url,
    }))
}

pub async fn update(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<DomainPayload>,
) -> Result<Json<DomainResponse>, AppError> {
    let d = domain::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound("Domain not found".to_string()))?;
    let existing_display_order = d.display_order;

    let txn = state.db.begin().await?;

    let mut model: domain::ActiveModel = d.into();
    model.name = Set(payload.name);
    model.registrar_id = Set(payload.registrar_id);
    model.registration_date = Set(payload.registration_date);
    model.expiration_date = Set(payload.expiration_date);
    model.display_order = Set(payload.display_order.unwrap_or(existing_display_order));
    model.renewal_days = Set(payload.renewal_days);
    model.renew_price = Set(payload.renew_price);
    model.currency = Set(payload.currency);
    model.masking_level = Set(payload.masking_level);
    model.notes = Set(payload.notes);
    model.updated_at = Set(Utc::now().fixed_offset());

    let d = model.update(&txn).await?;

    // Delete existing domain_tags and re-insert
    domain_tag::Entity::delete_many()
        .filter(domain_tag::Column::DomainId.eq(id))
        .exec(&txn)
        .await?;

    for tag_id in &payload.tag_ids {
        let dt = domain_tag::ActiveModel {
            domain_id: Set(id),
            tag_id: Set(*tag_id),
        };
        dt.insert(&txn).await?;
    }

    txn.commit().await?;

    let reg = if let Some(rid) = d.registrar_id {
        registrar::Entity::find_by_id(rid).one(&state.db).await?
    } else {
        None
    };
    let tags = d.find_related(tag::Entity).all(&state.db).await?;
    let favicon_url = if let Some(rid) = d.registrar_id {
        crate::services::favicon::registrar_favicon_url(rid).await
    } else {
        crate::services::favicon::favicon_url(d.id).await
    };

    Ok(Json(DomainResponse {
        domain: d,
        registrar: reg,
        tags,
        favicon_url,
    }))
}

pub async fn delete(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = domain::Entity::delete_by_id(id).exec(&state.db).await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound("Domain not found".to_string()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

pub async fn refresh_all(
    State(state): State<crate::AppState>,
    Json(payload): Json<RefreshDomainsPayload>,
) -> Result<Json<crate::services::whois::RefreshDomainsSummary>, AppError> {
    if let Err(err) = crate::services::currency::refresh_cached_rates(&state.db, &state.currency).await {
        tracing::warn!("Currency refresh failed before WHOIS refresh: {}", err);
    }

    let configured_whois_request_delay_ms = state.app_settings.whois_request_delay_ms().await;
    let whois_request_delay_ms = configured_whois_request_delay_ms
        .min(crate::services::app_settings::MAX_MANUAL_WHOIS_REQUEST_DELAY_MS);
    if whois_request_delay_ms != configured_whois_request_delay_ms {
        tracing::info!(
            "Manual WHOIS refresh delay capped from {}ms to {}ms",
            configured_whois_request_delay_ms,
            whois_request_delay_ms
        );
    }

    let summary = if let Some(domain_ids) = payload.domain_ids {
        crate::services::whois::refresh_selected_domains(
            &state.db,
            &domain_ids,
            whois_request_delay_ms,
        )
        .await
    } else {
        crate::services::whois::refresh_all_domains(&state.db, whois_request_delay_ms).await
    };

    if summary.failed > 0 {
        tracing::warn!(
            "WHOIS refresh completed with {} failures out of {} domains",
            summary.failed,
            summary.total_domains
        );
    } else {
        tracing::info!(
            "WHOIS refresh completed successfully for {} domains",
            summary.total_domains
        );
    }

    Ok(Json(summary))
}

pub async fn reorder(
    State(state): State<crate::AppState>,
    Json(payload): Json<ReorderDomainsPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    if payload.domain_ids.is_empty() {
        return Err(AppError::BadRequest("No domains provided for reorder".to_string()));
    }

    let txn = state.db.begin().await?;

    for (index, domain_id) in payload.domain_ids.iter().enumerate() {
        let domain = domain::Entity::find_by_id(*domain_id)
            .one(&txn)
            .await?
            .ok_or(AppError::NotFound(format!("Domain not found: {}", domain_id)))?;

        let mut model: domain::ActiveModel = domain.into();
        model.display_order = Set(index as i32);
        model.updated_at = Set(Utc::now().fixed_offset());
        model.update(&txn).await?;
    }

    txn.commit().await?;

    Ok(Json(serde_json::json!({ "updated": payload.domain_ids.len() })))
}

pub async fn lookup(
    Path(domain): Path<String>,
) -> Result<Json<crate::services::whois::DomainLookup>, AppError> {
    tracing::info!("WHOIS lookup requested for domain: {}", domain);
    crate::services::whois::lookup_domain(&domain)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("WHOIS lookup error: {}", e);
            AppError::BadRequest(e)
        })
}

pub async fn refresh_favicon(
    State(state): State<crate::AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let domain = domain::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound("Domain not found".to_string()))?;

    crate::services::favicon::refresh_domain_favicon(domain.id, &domain.name)
        .await
        .map_err(AppError::BadRequest)?;

    Ok(Json(serde_json::json!({
        "ok": true,
        "favicon_url": crate::services::favicon::favicon_url(domain.id).await,
    })))
}
