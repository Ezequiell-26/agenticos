#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Canonical runtime composition boundary. Tokio integration is introduced by the verified Step 1 slice.

/// Runtime build information.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuntimeInfo {
    /// Semantic runtime version.
    pub version: &'static str,
}

/// Returns the canonical runtime identity.
pub fn info() -> RuntimeInfo {
    RuntimeInfo {
        version: env!("CARGO_PKG_VERSION"),
    }
}
