#![forbid(unsafe_code)]

//! Session event log for durable append-only event tracking.
//! Inspired by DeepSeek Harness session event log pattern.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

/// Session event types based on DeepSeek Harness event model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type")]
pub enum SessionEvent {
    /// Turn started
    TurnStart { turn_id: String, timestamp: u64 },
    /// Turn ended
    TurnEnd {
        turn_id: String,
        timestamp: u64,
        step_count: usize,
        latency_ms: u64,
    },
    /// Step started
    StepStart {
        step_id: String,
        turn_id: String,
        timestamp: u64,
    },
    /// Step ended
    StepEnd {
        step_id: String,
        turn_id: String,
        timestamp: u64,
    },
    /// User message
    UserMessage {
        message_id: String,
        turn_id: String,
        content: String,
        timestamp: u64,
    },
    /// Assistant message
    AssistantMessage {
        message_id: String,
        turn_id: String,
        content: String,
        timestamp: u64,
        token_count: Option<usize>,
    },
    /// Tool call started
    ToolCallStart {
        tool_id: String,
        step_id: String,
        tool_name: String,
        args: serde_json::Value,
        timestamp: u64,
    },
    /// Tool call result
    ToolCallResult {
        tool_id: String,
        step_id: String,
        success: bool,
        output: Option<String>,
        error: Option<String>,
        timestamp: u64,
    },
    /// Agent pre-step validation
    AgentPreStep {
        step_id: String,
        accepted: bool,
        reason: Option<String>,
        timestamp: u64,
    },
    /// Agent request prepared
    AgentRequest {
        request_id: String,
        model: String,
        prompt_length: usize,
        timestamp: u64,
    },
    /// Agent assistant stream chunk
    AssistantStreamChunk {
        stream_id: String,
        chunk: String,
        timestamp: u64,
    },
    /// Error event
    Error {
        error_id: String,
        context: String,
        message: String,
        timestamp: u64,
    },
    /// Planning started
    PlanningStart {
        plan_id: String,
        turn_id: String,
        goal: String,
        timestamp: u64,
    },
    /// Planning step
    PlanningStep {
        plan_id: String,
        step_number: usize,
        step_description: String,
        timestamp: u64,
    },
    /// Planning completed
    PlanningEnd {
        plan_id: String,
        turn_id: String,
        step_count: usize,
        timestamp: u64,
    },
    /// Recovery started
    RecoveryStart {
        recovery_id: String,
        turn_id: String,
        context: String,
        timestamp: u64,
    },
    /// Recovery attempt
    RecoveryAttempt {
        recovery_id: String,
        attempt_number: usize,
        action: String,
        timestamp: u64,
    },
    /// Recovery completed
    RecoveryEnd {
        recovery_id: String,
        turn_id: String,
        success: bool,
        timestamp: u64,
    },
}

impl SessionEvent {
    /// Get event timestamp
    pub fn timestamp(&self) -> u64 {
        match self {
            SessionEvent::TurnStart { timestamp, .. }
            | SessionEvent::TurnEnd { timestamp, .. }
            | SessionEvent::StepStart { timestamp, .. }
            | SessionEvent::StepEnd { timestamp, .. }
            | SessionEvent::UserMessage { timestamp, .. }
            | SessionEvent::AssistantMessage { timestamp, .. }
            | SessionEvent::ToolCallStart { timestamp, .. }
            | SessionEvent::ToolCallResult { timestamp, .. }
            | SessionEvent::AgentPreStep { timestamp, .. }
            | SessionEvent::AgentRequest { timestamp, .. }
            | SessionEvent::AssistantStreamChunk { timestamp, .. }
            | SessionEvent::Error { timestamp, .. }
            | SessionEvent::PlanningStart { timestamp, .. }
            | SessionEvent::PlanningStep { timestamp, .. }
            | SessionEvent::PlanningEnd { timestamp, .. }
            | SessionEvent::RecoveryStart { timestamp, .. }
            | SessionEvent::RecoveryAttempt { timestamp, .. }
            | SessionEvent::RecoveryEnd { timestamp, .. } => *timestamp,
        }
    }

    /// Generate unique ID
    pub fn generate_id(prefix: &str) -> String {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        format!("{}-{}", prefix, timestamp)
    }
}

/// Append-only session event log.
#[derive(Clone)]
#[allow(missing_debug_implementations)]
pub struct SessionEventLog {
    events: Arc<Mutex<Vec<SessionEvent>>>,
    session_id: String,
}

impl SessionEventLog {
    /// Create a new session event log.
    pub fn new(session_id: String) -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            session_id,
        }
    }

    fn lock_events(&self) -> std::sync::MutexGuard<'_, Vec<SessionEvent>> {
        self.events
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Append an event to the log (append-only, no deletions).
    pub fn append(&self, event: SessionEvent) {
        let mut events = self.lock_events();
        events.push(event);
    }

    /// Get all events for this session.
    pub fn get_events(&self) -> Vec<SessionEvent> {
        let events = self.lock_events();
        events.clone()
    }

    /// Get events by type.
    pub fn get_events_by_type(&self, event_type: &str) -> Vec<SessionEvent> {
        let events = self.events.lock().unwrap();
        events
            .iter()
            .filter(|e| {
                matches!(
                    (e, event_type),
                    (SessionEvent::TurnStart { .. }, "TurnStart")
                        | (SessionEvent::TurnEnd { .. }, "TurnEnd")
                        | (SessionEvent::StepStart { .. }, "StepStart")
                        | (SessionEvent::StepEnd { .. }, "StepEnd")
                        | (SessionEvent::UserMessage { .. }, "UserMessage")
                        | (SessionEvent::AssistantMessage { .. }, "AssistantMessage")
                        | (SessionEvent::ToolCallStart { .. }, "ToolCallStart")
                        | (SessionEvent::ToolCallResult { .. }, "ToolCallResult")
                        | (SessionEvent::AgentPreStep { .. }, "AgentPreStep")
                        | (SessionEvent::AgentRequest { .. }, "AgentRequest")
                        | (
                            SessionEvent::AssistantStreamChunk { .. },
                            "AssistantStreamChunk"
                        )
                        | (SessionEvent::Error { .. }, "Error")
                )
            })
            .cloned()
            .collect()
    }

    /// Get events for a specific turn.
    pub fn get_turn_events(&self, turn_id: &str) -> Vec<SessionEvent> {
        let events = self.events.lock().unwrap();
        events
            .iter()
            .filter(|e| match e {
                SessionEvent::TurnStart { turn_id: tid, .. }
                | SessionEvent::TurnEnd { turn_id: tid, .. }
                | SessionEvent::StepStart { turn_id: tid, .. }
                | SessionEvent::StepEnd { turn_id: tid, .. }
                | SessionEvent::UserMessage { turn_id: tid, .. }
                | SessionEvent::AssistantMessage { turn_id: tid, .. } => tid == turn_id,
                _ => false,
            })
            .cloned()
            .collect()
    }

    /// Get session ID.
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Get event count.
    pub fn event_count(&self) -> usize {
        let events = self.events.lock().unwrap();
        events.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_append_only() {
        let log = SessionEventLog::new("test-session".to_string());

        log.append(SessionEvent::TurnStart {
            turn_id: SessionEvent::generate_id("turn"),
            timestamp: 0,
        });

        assert_eq!(log.event_count(), 1);
    }

    #[test]
    fn test_get_events_by_type() {
        let log = SessionEventLog::new("test-session".to_string());

        log.append(SessionEvent::TurnStart {
            turn_id: "turn-1".to_string(),
            timestamp: 0,
        });

        log.append(SessionEvent::StepStart {
            step_id: "step-1".to_string(),
            turn_id: "turn-1".to_string(),
            timestamp: 0,
        });

        let turn_events = log.get_events_by_type("TurnStart");
        assert_eq!(turn_events.len(), 1);
    }

    #[test]
    fn test_get_turn_events() {
        let log = SessionEventLog::new("test-session".to_string());

        log.append(SessionEvent::TurnStart {
            turn_id: "turn-1".to_string(),
            timestamp: 0,
        });

        log.append(SessionEvent::UserMessage {
            message_id: "msg-1".to_string(),
            turn_id: "turn-1".to_string(),
            content: "test".to_string(),
            timestamp: 0,
        });

        let turn_events = log.get_turn_events("turn-1");
        assert_eq!(turn_events.len(), 2);
    }
}
