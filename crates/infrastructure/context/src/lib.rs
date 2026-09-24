#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Deterministic context budgeting and compaction boundary.

use agenticos_contracts::Message;
use serde::{Deserialize, Serialize};

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-context";

/// Runtime budget for assembling model input.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContextBudget {
    /// Maximum model context window in tokens.
    pub context_window_tokens: u32,
    /// Tokens reserved for the model's output.
    pub reserved_output_tokens: u32,
    /// Safety margin kept unused to absorb tokenizer/provider differences.
    pub safety_margin_tokens: u32,
    /// Minimum number of newest non-system messages to preserve when trimming.
    pub min_recent_messages: usize,
}

impl ContextBudget {
    /// Create a budget with a conservative default safety margin.
    pub fn new(context_window_tokens: u32, reserved_output_tokens: u32) -> Self {
        let safety_margin_tokens = context_window_tokens / 20;
        Self {
            context_window_tokens,
            reserved_output_tokens,
            safety_margin_tokens,
            min_recent_messages: 2,
        }
    }

    /// Maximum number of input tokens allowed for the current request.
    pub fn max_input_tokens(&self) -> u32 {
        self.context_window_tokens
            .saturating_sub(self.reserved_output_tokens)
            .saturating_sub(self.safety_margin_tokens)
    }
}

/// Result of deterministic context preparation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ContextPlan {
    /// Messages selected for model input, oldest to newest.
    pub messages: Vec<Message>,
    /// Number of tokens removed from the original message set.
    pub dropped_tokens: u32,
    /// Whether any historical messages were removed.
    pub trimmed: bool,
}

/// Stateless context engine.
#[derive(Debug, Clone, Copy, Default)]
pub struct ContextEngine;

impl ContextEngine {
    /// Create a context engine.
    pub const fn new() -> Self {
        Self
    }

    /// Select a deterministic suffix while preserving system messages and recent turns.
    pub fn prepare(&self, messages: &[Message], budget: ContextBudget) -> ContextPlan {
        let limit = budget.max_input_tokens();
        let total: u32 = messages.iter().map(|message| message.token_count).sum();
        if total <= limit {
            return ContextPlan {
                messages: messages.to_vec(),
                dropped_tokens: 0,
                trimmed: false,
            };
        }

        let recent_floor = messages.len().saturating_sub(budget.min_recent_messages.max(1));
        let mut selected = Vec::with_capacity(messages.len());
        let mut used = 0_u32;
        let mut dropped_tokens = 0_u32;

        for (index, message) in messages.iter().enumerate() {
            let protected = message.role == "system" || index >= recent_floor;
            if protected && used.saturating_add(message.token_count) <= limit {
                selected.push(message.clone());
                used = used.saturating_add(message.token_count);
                continue;
            }
            if protected {
                selected.push(message.clone());
                used = used.saturating_add(message.token_count);
            } else {
                dropped_tokens = dropped_tokens.saturating_add(message.token_count);
            }
        }

        ContextPlan {
            messages: selected,
            dropped_tokens,
            trimmed: dropped_tokens > 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agenticos_contracts::RunId;

    fn message(id: &str, role: &str, tokens: u32) -> Message {
        Message {
            message_id: id.to_string(),
            role: role.to_string(),
            content: id.to_string(),
            timestamp: 1,
            token_count: tokens,
            run_id: RunId::new("context-test").unwrap(),
        }
    }

    #[test]
    fn budget_leaves_output_and_safety_margin() {
        let budget = ContextBudget::new(1000, 200);
        assert_eq!(budget.max_input_tokens(), 750);
    }

    #[test]
    fn prepare_keeps_recent_turns_and_system_messages() {
        let engine = ContextEngine::new();
        let budget = ContextBudget {
            context_window_tokens: 100,
            reserved_output_tokens: 10,
            safety_margin_tokens: 10,
            min_recent_messages: 2,
        };
        let messages = vec![
            message("system", "system", 20),
            message("old", "user", 60),
            message("recent-user", "user", 20),
            message("recent-assistant", "assistant", 20),
        ];

        let plan = engine.prepare(&messages, budget);
        assert!(plan.trimmed);
        assert_eq!(
            plan.messages
                .iter()
                .map(|value| value.message_id.as_str())
                .collect::<Vec<_>>(),
            vec!["system", "recent-user", "recent-assistant"]
        );
        assert_eq!(plan.dropped_tokens, 60);
    }
}
