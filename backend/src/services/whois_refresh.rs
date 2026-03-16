use std::sync::Arc;

use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use tokio::sync::{watch, RwLock};

use crate::entities::app_setting;

const WHOIS_REFRESH_SETTING_KEY: &str = "whois_refresh_interval_hours";

#[derive(Clone)]
pub struct WhoisRefreshService {
    current_hours: Arc<RwLock<u64>>,
    sender: watch::Sender<u64>,
}

impl WhoisRefreshService {
    pub fn new(initial_hours: u64) -> Self {
        let (sender, _) = watch::channel(initial_hours);

        Self {
            current_hours: Arc::new(RwLock::new(initial_hours)),
            sender,
        }
    }

    pub async fn current_hours(&self) -> u64 {
        *self.current_hours.read().await
    }

    pub async fn set_hours(&self, hours: u64) -> Result<(), String> {
        *self.current_hours.write().await = hours;
        self.sender
            .send(hours)
            .map_err(|e| format!("Failed to notify refresh interval change: {}", e))
    }

    pub fn subscribe(&self) -> watch::Receiver<u64> {
        self.sender.subscribe()
    }
}

pub async fn load_interval_hours(db: &DatabaseConnection, default_hours: u64) -> u64 {
    app_setting::Entity::find()
        .filter(app_setting::Column::Key.eq(WHOIS_REFRESH_SETTING_KEY))
        .one(db)
        .await
        .ok()
        .flatten()
        .and_then(|setting| setting.value.parse::<u64>().ok())
        .unwrap_or(default_hours)
}

pub async fn save_interval_hours(db: &DatabaseConnection, hours: u64) -> Result<(), sea_orm::DbErr> {
    let now = Utc::now().fixed_offset();
    let existing = app_setting::Entity::find_by_id(WHOIS_REFRESH_SETTING_KEY.to_string())
        .one(db)
        .await?;

    if let Some(existing) = existing {
        let mut model: app_setting::ActiveModel = existing.into();
        model.value = Set(hours.to_string());
        model.updated_at = Set(now);
        model.update(db).await?;
    } else {
        let model = app_setting::ActiveModel {
            key: Set(WHOIS_REFRESH_SETTING_KEY.to_string()),
            value: Set(hours.to_string()),
            updated_at: Set(now),
        };
        model.insert(db).await?;
    }

    Ok(())
}
