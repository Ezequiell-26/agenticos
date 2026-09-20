#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! durable memory and retrieval boundary. Functionality is introduced only through verified vertical slices.

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-memory";
