#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! workspace/project domain boundary. Functionality is introduced only through verified vertical slices.

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-projects";
