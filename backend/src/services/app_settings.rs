use std::sync::Arc;

use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    Set,
};
use tokio::sync::RwLock;

use crate::entities::{app_setting, user};

const ALLOW_REGISTER_SETTING_KEY: &str = "allow_register";
const WHOIS_REQUEST_DELAY_SETTING_KEY: &str = "whois_request_delay_ms";

pub const DEFAULT_WHOIS_REQUEST_DELAY_MS: u64 = 60_000;

#[derive(Clone)]
pub struct AppSettingsService {
    allow_register: Arc<RwLock<bool>>,
    whois_request_delay_ms: Arc<RwLock<u64>>,
}

impl AppSettingsService {
    pub fn new(initial_allow_register: bool, initial_whois_request_delay_ms: u64) -> Self {
        Self {
            allow_register: Arc::new(RwLock::new(initial_allow_register)),
            whois_request_delay_ms: Arc::new(RwLock::new(initial_whois_request_delay_ms)),
        }
    }

    pub async fn allow_register(&self) -> bool {
        *self.allow_register.read().await
    }

    pub async fn whois_request_delay_ms(&self) -> u64 {
        *self.whois_request_delay_ms.read().await
    }

    pub async fn set_allow_register(&self, allow_register: bool) {
        *self.allow_register.write().await = allow_register;
    }

    pub async fn set_whois_request_delay_ms(&self, delay_ms: u64) {
        *self.whois_request_delay_ms.write().await = delay_ms;
    }
}

pub async fn load_allow_register(db: &DatabaseConnection) -> bool {
    if let Some(allow_register) = load_bool_setting(db, ALLOW_REGISTER_SETTING_KEY).await {
        return allow_register;
    }

    user::Entity::find()
        .count(db)
        .await
        .map(|count| count == 0)
        .unwrap_or(false)
}

pub async fn load_whois_request_delay_ms(db: &DatabaseConnection) -> u64 {
    load_u64_setting(db, WHOIS_REQUEST_DELAY_SETTING_KEY)
        .await
        .unwrap_or(DEFAULT_WHOIS_REQUEST_DELAY_MS)
}

pub async fn save_allow_register(
    db: &DatabaseConnection,
    allow_register: bool,
) -> Result<(), sea_orm::DbErr> {
    save_setting(db, ALLOW_REGISTER_SETTING_KEY, allow_register.to_string()).await
}

pub async fn save_whois_request_delay_ms(
    db: &DatabaseConnection,
    delay_ms: u64,
) -> Result<(), sea_orm::DbErr> {
    save_setting(db, WHOIS_REQUEST_DELAY_SETTING_KEY, delay_ms.to_string()).await
}

async fn load_bool_setting(db: &DatabaseConnection, key: &str) -> Option<bool> {
    load_setting_value(db, key)
        .await
        .and_then(|value| value.parse::<bool>().ok())
}

async fn load_u64_setting(db: &DatabaseConnection, key: &str) -> Option<u64> {
    load_setting_value(db, key)
        .await
        .and_then(|value| value.parse::<u64>().ok())
}

async fn load_setting_value(db: &DatabaseConnection, key: &str) -> Option<String> {
    app_setting::Entity::find()
        .filter(app_setting::Column::Key.eq(key))
        .one(db)
        .await
        .ok()
        .flatten()
        .map(|setting| setting.value)
}

async fn save_setting(
    db: &DatabaseConnection,
    key: &str,
    value: String,
) -> Result<(), sea_orm::DbErr> {
    let now = Utc::now().fixed_offset();
    let existing = app_setting::Entity::find_by_id(key.to_string())
        .one(db)
        .await?;

    if let Some(existing) = existing {
        let mut model: app_setting::ActiveModel = existing.into();
        model.value = Set(value);
        model.updated_at = Set(now);
        model.update(db).await?;
    } else {
        let model = app_setting::ActiveModel {
            key: Set(key.to_string()),
            value: Set(value),
            updated_at: Set(now),
        };
        model.insert(db).await?;
    }

    Ok(())
}
