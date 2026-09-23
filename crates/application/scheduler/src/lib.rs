#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! durable scheduling and leases boundary. Functionality is introduced only through verified vertical slices.

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-scheduler";
