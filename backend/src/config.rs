use std::env;

pub struct Config {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub whois_refresh_interval_hours: u64,
    pub whois_request_delay_ms: u64,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .expect("SERVER_PORT must be a number"),
            whois_refresh_interval_hours: env::var("WHOIS_REFRESH_INTERVAL_HOURS")
                .unwrap_or_else(|_| "24".to_string())
                .parse()
                .expect("WHOIS_REFRESH_INTERVAL_HOURS must be a number"),
            whois_request_delay_ms: env::var("WHOIS_REQUEST_DELAY_MS")
                .unwrap_or_else(|_| "60000".to_string())
                .parse()
                .expect("WHOIS_REQUEST_DELAY_MS must be a number"),
        }
    }
}
