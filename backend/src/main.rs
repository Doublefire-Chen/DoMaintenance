use std::net::SocketAddr;

use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post, put},
    Router,
};
use sea_orm::DatabaseConnection;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod db;
mod entities;
mod errors;
mod handlers;
mod middleware;
mod services;

use services::currency::CurrencyService;

type AppState = (DatabaseConnection, CurrencyService);

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env();
    let db = db::connect(&config).await;

    let currency_svc = services::currency::init(&db).await;

    let state: AppState = (db.clone(), currency_svc);

    let frontend_origin = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());

    let cors = CorsLayer::new()
        .allow_origin(frontend_origin.parse::<axum::http::HeaderValue>().unwrap())
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ])
        .allow_credentials(true);

    // Public routes
    let public_routes = Router::new()
        .route("/api/public/domains", get(handlers::public::get_domains))
        .route(
            "/api/public/currencies",
            get(handlers::public::get_currencies),
        );

    // Auth routes
    let auth_routes = Router::new()
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/logout", post(handlers::auth::logout))
        .route("/api/auth/me", get(handlers::auth::me))
        .route("/api/auth/allow-register", get(handlers::auth::allow_register));

    // Admin routes (protected)
    let admin_routes = Router::new()
        .route("/api/admin/domains", get(handlers::domains::list))
        .route("/api/admin/domains", post(handlers::domains::create))
        .route(
            "/api/admin/whois/:domain",
            get(handlers::domains::lookup),
        )
        .route("/api/admin/domains/:id", get(handlers::domains::get))
        .route("/api/admin/domains/:id", put(handlers::domains::update))
        .route(
            "/api/admin/domains/:id",
            delete(handlers::domains::delete),
        )
        .route("/api/admin/registrars", get(handlers::registrars::list))
        .route(
            "/api/admin/registrars",
            post(handlers::registrars::create),
        )
        .route(
            "/api/admin/registrars/:id",
            get(handlers::registrars::get),
        )
        .route(
            "/api/admin/registrars/:id",
            put(handlers::registrars::update),
        )
        .route(
            "/api/admin/registrars/:id",
            delete(handlers::registrars::delete),
        )
        .route("/api/admin/tags", get(handlers::tags::list))
        .route("/api/admin/tags", post(handlers::tags::create))
        .route("/api/admin/tags/:id", get(handlers::tags::get))
        .route("/api/admin/tags/:id", put(handlers::tags::update))
        .route("/api/admin/tags/:id", delete(handlers::tags::delete))
        .layer(axum_middleware::from_fn_with_state(
            state.0.clone(),
            middleware::auth::require_auth,
        ));

    let app = Router::new()
        .merge(public_routes)
        .merge(auth_routes)
        .merge(admin_routes)
        .with_state(state)
        .layer(cors);

    let addr: SocketAddr = format!("{}:{}", config.server_host, config.server_port)
        .parse()
        .expect("Invalid SERVER_HOST or SERVER_PORT");
    tracing::info!("Server starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
