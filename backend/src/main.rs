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
use services::whois_refresh::WhoisRefreshService;

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub currency: CurrencyService,
    pub whois_refresh: WhoisRefreshService,
    pub whois_request_delay_ms: u64,
}

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
    let initial_whois_refresh_hours =
        services::whois_refresh::load_interval_hours(&db, config.whois_refresh_interval_hours).await;
    let whois_refresh_svc = WhoisRefreshService::new(initial_whois_refresh_hours);

    let state = AppState {
        db: db.clone(),
        currency: currency_svc,
        whois_refresh: whois_refresh_svc.clone(),
        whois_request_delay_ms: config.whois_request_delay_ms,
    };

    {
        let refresh_db = db.clone();
        let refresh_currency = state.currency.clone();
        let whois_request_delay_ms = config.whois_request_delay_ms;
        let mut refresh_rx = whois_refresh_svc.subscribe();
        tokio::spawn(async move {
            loop {
                let refresh_interval_hours = *refresh_rx.borrow();
                if refresh_interval_hours == 0 {
                    tracing::info!("WHOIS auto refresh disabled; waiting for settings update");
                    if refresh_rx.changed().await.is_err() {
                        break;
                    }
                    continue;
                }

                tracing::info!(
                    "WHOIS auto refresh scheduled in {} hour(s)",
                    refresh_interval_hours
                );

                tokio::select! {
                    changed = refresh_rx.changed() => {
                        if changed.is_err() {
                            break;
                        }
                    }
                    _ = tokio::time::sleep(std::time::Duration::from_secs(refresh_interval_hours * 3600)) => {
                        tracing::info!(
                            "Refreshing WHOIS data for all domains on {} hour interval",
                            refresh_interval_hours
                        );

                        if let Err(err) = services::currency::refresh_cached_rates(&refresh_db, &refresh_currency).await {
                            tracing::warn!("Currency refresh failed before WHOIS refresh: {}", err);
                        }

                        let summary = services::whois::refresh_all_domains(
                            &refresh_db,
                            whois_request_delay_ms,
                        ).await;
                        if summary.failed > 0 {
                            tracing::warn!(
                                "WHOIS refresh finished: updated={}, failed={}, total={}",
                                summary.updated,
                                summary.failed,
                                summary.total_domains
                            );
                        } else {
                            tracing::info!(
                                "WHOIS refresh finished: updated={}, total={}",
                                summary.updated,
                                summary.total_domains
                            );
                        }
                    }
                }
            }
        });
    }

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
            "/api/admin/domains/refresh-whois",
            post(handlers::domains::refresh_all),
        )
        .route(
            "/api/admin/settings/whois-refresh",
            get(handlers::settings::get_whois_refresh),
        )
        .route(
            "/api/admin/settings/whois-refresh",
            put(handlers::settings::update_whois_refresh),
        )
        .route("/api/admin/currencies", get(handlers::currencies::list))
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
            state.db.clone(),
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
