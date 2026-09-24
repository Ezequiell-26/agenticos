#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Canonical runtime lifecycle and readiness boundary.

use serde::Serialize;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;

/// Current runtime lifecycle phase.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimePhase {
    /// Runtime components are being initialized.
    Booting = 0,
    /// Runtime is ready to serve requests.
    Ready = 1,
    /// Runtime is serving but one or more components are degraded.
    Degraded = 2,
    /// Runtime is shutting down.
    ShuttingDown = 3,
}

impl RuntimePhase {
    fn from_u8(value: u8) -> Self {
        match value {
            1 => Self::Ready,
            2 => Self::Degraded,
            3 => Self::ShuttingDown,
            _ => Self::Booting,
        }
    }
}

/// Snapshot of runtime lifecycle state.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct RuntimeSnapshot {
    /// Stable runtime instance identifier.
    pub runtime_id: String,
    /// Runtime semantic version.
    pub version: String,
    /// Current lifecycle phase.
    pub phase: RuntimePhase,
    /// Unix start timestamp.
    pub started_at: u64,
}

/// Thread-safe lifecycle controller.
#[derive(Clone, Debug)]
pub struct RuntimeController {
    runtime_id: Arc<String>,
    version: Arc<String>,
    started_at: u64,
    phase: Arc<AtomicU8>,
}

impl RuntimeController {
    /// Create a new runtime controller in the booting phase.
    pub fn new() -> Self {
        Self {
            runtime_id: Arc::new(format!("runtime-{}", uuid::Uuid::new_v4())),
            version: Arc::new(env!("CARGO_PKG_VERSION").to_string()),
            started_at: unix_time(),
            phase: Arc::new(AtomicU8::new(RuntimePhase::Booting as u8)),
        }
    }

    /// Update the lifecycle phase.
    pub fn set_phase(&self, phase: RuntimePhase) {
        self.phase.store(phase as u8, Ordering::Release);
    }

    /// Read an immutable lifecycle snapshot.
    pub fn snapshot(&self) -> RuntimeSnapshot {
        RuntimeSnapshot {
            runtime_id: self.runtime_id.as_ref().clone(),
            version: self.version.as_ref().clone(),
            phase: RuntimePhase::from_u8(self.phase.load(Ordering::Acquire)),
            started_at: self.started_at,
        }
    }
}

impl Default for RuntimeController {
    fn default() -> Self {
        Self::new()
    }
}

fn unix_time() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifecycle_controller_transitions() {
        let runtime = RuntimeController::new();
        assert_eq!(runtime.snapshot().phase, RuntimePhase::Booting);

        runtime.set_phase(RuntimePhase::Ready);
        assert_eq!(runtime.snapshot().phase, RuntimePhase::Ready);

        runtime.set_phase(RuntimePhase::Degraded);
        assert_eq!(runtime.snapshot().phase, RuntimePhase::Degraded);

        runtime.set_phase(RuntimePhase::ShuttingDown);
        assert_eq!(runtime.snapshot().phase, RuntimePhase::ShuttingDown);
    }
}
