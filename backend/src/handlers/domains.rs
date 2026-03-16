use axum::{extract::{Path, State}, Json};
use chrono::Utc;
use rust_decimal::Decimal;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, ModelTrait, QueryFilter, Set, TransactionTrait};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::{domain, domain_tag, registrar, tag};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct DomainPayload {
    pub name: String,
    pub registrar_id: Option<Uuid>,
    pub registration_date: Option<chrono::NaiveDate>,
    pub expiration_date: chrono::NaiveDate,
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
}

pub async fn list(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
) -> Result<Json<Vec<DomainResponse>>, AppError> {
    let domains = domain::Entity::find().all(&db).await?;
    let mut results = Vec::new();

    for d in domains {
        let reg = if let Some(rid) = d.registrar_id {
            registrar::Entity::find_by_id(rid).one(&db).await?
        } else {
            None
        };
        let tags = d.find_related(tag::Entity).all(&db).await?;
        results.push(DomainResponse {
            domain: d,
            registrar: reg,
            tags,
        });
    }

    Ok(Json(results))
}

pub async fn get(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
    Path(id): Path<Uuid>,
) -> Result<Json<DomainResponse>, AppError> {
    let d = domain::Entity::find_by_id(id)
        .one(&db)
        .await?
        .ok_or(AppError::NotFound("Domain not found".to_string()))?;

    let reg = if let Some(rid) = d.registrar_id {
        registrar::Entity::find_by_id(rid).one(&db).await?
    } else {
        None
    };
    let tags = d.find_related(tag::Entity).all(&db).await?;

    Ok(Json(DomainResponse {
        domain: d,
        registrar: reg,
        tags,
    }))
}

pub async fn create(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
    Json(payload): Json<DomainPayload>,
) -> Result<Json<DomainResponse>, AppError> {
    let txn = db.begin().await?;
    let now = Utc::now().fixed_offset();
    let domain_id = Uuid::new_v4();

    let model = domain::ActiveModel {
        id: Set(domain_id),
        name: Set(payload.name),
        registrar_id: Set(payload.registrar_id),
        registration_date: Set(payload.registration_date),
        expiration_date: Set(payload.expiration_date),
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
        registrar::Entity::find_by_id(rid).one(&db).await?
    } else {
        None
    };
    let tags = d.find_related(tag::Entity).all(&db).await?;

    Ok(Json(DomainResponse {
        domain: d,
        registrar: reg,
        tags,
    }))
}

pub async fn update(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
    Path(id): Path<Uuid>,
    Json(payload): Json<DomainPayload>,
) -> Result<Json<DomainResponse>, AppError> {
    let d = domain::Entity::find_by_id(id)
        .one(&db)
        .await?
        .ok_or(AppError::NotFound("Domain not found".to_string()))?;

    let txn = db.begin().await?;

    let mut model: domain::ActiveModel = d.into();
    model.name = Set(payload.name);
    model.registrar_id = Set(payload.registrar_id);
    model.registration_date = Set(payload.registration_date);
    model.expiration_date = Set(payload.expiration_date);
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
        registrar::Entity::find_by_id(rid).one(&db).await?
    } else {
        None
    };
    let tags = d.find_related(tag::Entity).all(&db).await?;

    Ok(Json(DomainResponse {
        domain: d,
        registrar: reg,
        tags,
    }))
}

pub async fn delete(
    State((db, _)): State<(DatabaseConnection, crate::services::currency::CurrencyService)>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = domain::Entity::delete_by_id(id).exec(&db).await?;
    if result.rows_affected == 0 {
        return Err(AppError::NotFound("Domain not found".to_string()));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
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
