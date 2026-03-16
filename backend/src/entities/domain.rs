use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "domains")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub registrar_id: Option<Uuid>,
    pub registration_date: Option<DateTimeWithTimeZone>,
    pub expiration_date: DateTimeWithTimeZone,
    pub renewal_days: i32,
    #[sea_orm(column_type = "Decimal(Some((10, 2)))")]
    pub renew_price: Option<Decimal>,
    pub currency: String,
    pub masking_level: i16,
    #[sea_orm(column_type = "Text")]
    pub notes: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::registrar::Entity",
        from = "Column::RegistrarId",
        to = "super::registrar::Column::Id"
    )]
    Registrar,
}

impl Related<super::registrar::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Registrar.def()
    }
}

impl Related<super::tag::Entity> for Entity {
    fn to() -> RelationDef {
        super::domain_tag::Relation::Tag.def()
    }

    fn via() -> Option<RelationDef> {
        Some(super::domain_tag::Relation::Domain.def().rev())
    }
}

impl ActiveModelBehavior for ActiveModel {}
