//! Logging (based on tracing MIT patterns)
//! MIT Licensed - Application level tracing for Rust
//! Source: https://github.com/tokio-rs/tracing (6844 stars, MIT)

use tracing::{info, warn, error, debug, trace, instrument, Level};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LoggingError {
    #[error("Failed to initialize logging: {0}")]
    InitError(String),
}

/// Initialize logging with default settings
pub fn init_default() -> Result<(), LoggingError> {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"))
        )
        .with(fmt::layer())
        .init();
    Ok(())
}

/// Initialize logging with custom level
pub fn init_with_level(level: Level) -> Result<(), LoggingError> {
    tracing_subscriber::registry()
        .with(EnvFilter::new(level.to_string().to_lowercase()))
        .with(fmt::layer())
        .init();
    Ok(())
}

/// Initialize logging with custom filter
pub fn init_with_filter(filter: &str) -> Result<(), LoggingError> {
    tracing_subscriber::registry()
        .with(EnvFilter::new(filter))
        .with(fmt::layer())
        .init();
    Ok(())
}

/// Initialize logging with JSON output
pub fn init_json() -> Result<(), LoggingError> {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"))
        )
        .with(fmt::layer().json())
        .init();
    Ok(())
}

/// Initialize logging with pretty output
pub fn init_pretty() -> Result<(), LoggingError> {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"))
        )
        .with(fmt::layer().pretty())
        .init();
    Ok(())
}

/// Logger wrapper for common logging operations
pub struct Logger;

impl Logger {
    /// Log info message
    pub fn info(message: &str) {
        info!("{}", message);
    }

    /// Log info message with fields
    pub fn info_with_fields(message: &str, fields: &[(&str, &str)]) {
        for (key, value) in fields {
            tracing::info!(%key, %value, "{}", message);
        }
    }

    /// Log warning message
    pub fn warn(message: &str) {
        warn!("{}", message);
    }

    /// Log error message
    pub fn error(message: &str) {
        error!("{}", message);
    }

    /// Log debug message
    pub fn debug(message: &str) {
        debug!("{}", message);
    }

    /// Log trace message
    pub fn trace(message: &str) {
        trace!("{}", message);
    }

    /// Log info with context
    #[instrument(skip(fields))]
    pub fn info_context(message: &str, fields: &[(&str, String)]) {
        for (key, value) in fields {
            tracing::info!(%key, %value, "{}", message);
        }
    }
}

/// Scoped logger with automatic span management
pub struct ScopedLogger {
    _name: String,
}

impl ScopedLogger {
    pub fn new(name: &str) -> Self {
        Self {
            _name: name.to_string(),
        }
    }

    #[instrument(skip(self))]
    pub fn info(&self, message: &str) {
        info!("{}", message);
    }

    #[instrument(skip(self))]
    pub fn warn(&self, message: &str) {
        warn!("{}", message);
    }

    #[instrument(skip(self))]
    pub fn error(&self, message: &str) {
        error!("{}", message);
    }

    #[instrument(skip(self))]
    pub fn debug(&self, message: &str) {
        debug!("{}", message);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_default() {
        let result = init_default();
        assert!(result.is_ok());
    }

    #[test]
    fn test_init_with_level() {
        let result = init_with_level(Level::DEBUG);
        assert!(result.is_ok());
    }

    #[test]
    fn test_init_with_filter() {
        let result = init_with_filter("debug");
        assert!(result.is_ok());
    }

    #[test]
    fn test_logger_info() {
        Logger::info("test info message");
    }

    #[test]
    fn test_logger_warn() {
        Logger::warn("test warning message");
    }

    #[test]
    fn test_logger_error() {
        Logger::error("test error message");
    }

    #[test]
    fn test_logger_debug() {
        Logger::debug("test debug message");
    }

    #[test]
    fn test_logger_trace() {
        Logger::trace("test trace message");
    }

    #[test]
    fn test_scoped_logger() {
        let logger = ScopedLogger::new("test_scope");
        logger.info("scoped info message");
        logger.warn("scoped warning message");
        logger.error("scoped error message");
        logger.debug("scoped debug message");
    }
}
