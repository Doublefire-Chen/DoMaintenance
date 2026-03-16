use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tags")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub name: String,
    pub color: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl Related<super::domain::Entity> for Entity {
    fn to() -> RelationDef {
        super::domain_tag::Relation::Domain.def()
    }

    fn via() -> Option<RelationDef> {
        Some(super::domain_tag::Relation::Tag.def().rev())
    }
}

impl ActiveModelBehavior for ActiveModel {}
