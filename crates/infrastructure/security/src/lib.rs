#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! policy and capability enforcement boundary. Functionality is introduced only through verified vertical slices.

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-security";
