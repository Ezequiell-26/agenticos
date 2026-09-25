#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! telemetry and tracing boundary. Functionality is introduced only through verified vertical slices.

pub mod audit;
/// Cost and usage accounting for provider executions.
pub mod cost;
pub mod metrics;

use tracing_subscriber::{fmt, layer::SubscriberExt, EnvFilter, Registry};
use uuid::Uuid;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-observability";

/// Initialize structured logging with tracing subscriber.
///
/// # Errors
/// Returns error if the subscriber cannot be initialized.
pub fn init_logging(service_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let subscriber = Registry::default().with(env_filter).with(
        fmt::layer()
            .with_target(false)
            .with_thread_ids(true)
            .with_line_number(true),
    );

    tracing::subscriber::set_global_default(subscriber)?;

    tracing::info!("Starting {} with tracing initialized", service_name);

    Ok(())
}

/// Generate a new correlation ID for request tracking.
pub fn new_correlation_id() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_logging() {
        let result = init_logging("test-service");
        assert!(result.is_ok());
    }

    #[test]
    fn test_new_correlation_id() {
        let id = new_correlation_id();
        assert!(!id.is_empty());
        assert_eq!(id.len(), 36); // UUID v4 format
    }
}
