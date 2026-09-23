#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Canonical project-domain boundary for AgentiCOS.
///
/// This crate is intentionally small until the project orchestration slice
/// becomes implementation-authorized.

/// Returns the architectural owner.
pub const OWNER: &str = "agenticos-projects";
