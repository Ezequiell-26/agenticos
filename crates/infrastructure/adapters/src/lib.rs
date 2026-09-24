#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Compatibility facade for the canonical provider infrastructure.
//!
//! New code should depend on the canonical providers crate directly. This crate remains
//! as a stable import surface for older integrations and intentionally contains
//! no second provider implementation.

/// Architectural owner of this compatibility facade.
pub const OWNER: &str = "agenticos-adapters";

pub use agenticos_providers::{
    CredentialPool, FallbackManager, HealthChecker, ModelCatalog, ProviderPlatform,
    ProviderRegistry, ProviderStatus, QuotaTracker, RetryManager,
};
