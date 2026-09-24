#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Deterministic context budgeting and compaction boundary.

use agenticos_contracts::Message;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

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
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContextPlan {
    /// Messages selected for model input, oldest to newest.
    pub messages: Vec<Message>,
    /// Number of tokens removed from the original message set.
    pub dropped_tokens: u32,
    /// Whether any historical messages were removed.
    pub trimmed: bool,
}

/// Statistics produced while compacting a tool payload.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolOutputOptimization {
    /// Original UTF-8 byte length.
    pub original_bytes: usize,
    /// Optimized UTF-8 byte length.
    pub optimized_bytes: usize,
    /// Number of bytes removed by deterministic normalization.
    pub bytes_saved: usize,
    /// Number of repeated lines folded.
    pub repeated_lines_folded: usize,
}

impl ToolOutputOptimization {
    /// Ratio of bytes removed from the original payload.
    pub fn savings_ratio(self) -> f64 {
        if self.original_bytes == 0 { 0.0 } else { 1.0 - (self.optimized_bytes as f64 / self.original_bytes as f64) }
    }
}

/// Deterministically normalize tool output before it becomes model-visible.
///
/// This representation is for logs and tool payloads. Source artifacts must
/// remain recoverable separately from the optimized model-facing payload.
pub fn optimize_tool_output(input: &str) -> (String, ToolOutputOptimization) {
    let original_bytes = input.len();
    let normalized = strip_ansi(input);
    let source = compact_json_if_possible(&normalized).unwrap_or(normalized);
    let (folded, repeated_lines_folded) = fold_repeated_lines(&source);
    let optimized = folded.trim_end().to_string();
    let optimized_bytes = optimized.len();

    (
        optimized,
        ToolOutputOptimization {
            original_bytes,
            optimized_bytes,
            bytes_saved: original_bytes.saturating_sub(optimized_bytes),
            repeated_lines_folded,
        },
    )
}

fn strip_ansi(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars();

    while let Some(ch) = chars.next() {
        if ch != '' {
            output.push(ch);
            continue;
        }

        match chars.next() {
            Some('[') => {
                for control in chars.by_ref() {
                    if ('@'..='~').contains(&control) { break; }
                }
            }
            Some(_) | None => {}
        }
    }

    output
}

fn compact_json_if_possible(input: &str) -> Option<String> {
    let trimmed = input.trim();
    if !(trimmed.starts_with('{') || trimmed.starts_with('[')) { return None; }
    let value = serde_json::from_str::<serde_json::Value>(trimmed).ok()?;
    serde_json::to_string(&value).ok()
}

fn fold_repeated_lines(input: &str) -> (String, usize) {
    let mut output = String::with_capacity(input.len());
    let mut previous = None::<&str>;
    let mut repeat_count = 0usize;
    let mut folded = 0usize;

    let flush = |output: &mut String, previous: &mut Option<&str>, repeat_count: &mut usize, folded: &mut usize| {
        if let Some(line) = *previous {
            if *repeat_count > 1 {
                output.push_str(line);
                output.push_str(" (repeated ");
                output.push_str(&repeat_count.to_string());
                output.push_str(" times)");
                *folded += *repeat_count - 1;
            } else {
                output.push_str(line);
            }
            output.push('\n');
        }
        *previous = None;
        *repeat_count = 0;
    };

    for line in input.lines() {
        let line = line.trim_end();
        if line.is_empty() {
            if repeat_count > 0 {
        flush(&mut output, &mut previous, &mut repeat_count, &mut folded);
    }
            if !output.is_empty() && !output.ends_with("\n\n") { output.push('\n'); }
            continue;
        }

        match previous {
            Some(current) if current == line => repeat_count += 1,
            Some(_) => {
                flush(&mut output, &mut previous, &mut repeat_count, &mut folded);
                previous = Some(line);
                repeat_count = 1;
            }
            None => {
                previous = Some(line);
                repeat_count = 1;
            }
        }
    }

    if repeat_count > 0 {
        flush(&mut output, &mut previous, &mut repeat_count, &mut folded);
    }
    (output.trim_end_matches('\n').to_string(), folded)
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

        let mut selected_indices = Vec::with_capacity(messages.len());
        let mut selected_set = HashSet::with_capacity(messages.len());
        let mut used = 0_u32;

        // Preserve system messages first because they define the runtime contract.
        for (index, message) in messages.iter().enumerate() {
            if message.role == "system" && used.saturating_add(message.token_count) <= limit {
                selected_indices.push(index);
                selected_set.insert(index);
                used = used.saturating_add(message.token_count);
            }
        }

        // Fill the remaining budget with the newest messages.
        for index in (0..messages.len()).rev() {
            if selected_set.contains(&index) {
                continue;
            }
            let message = &messages[index];
            if used.saturating_add(message.token_count) > limit {
                continue;
            }
            selected_indices.push(index);
            selected_set.insert(index);
            used = used.saturating_add(message.token_count);
        }

        selected_indices.sort_unstable();

        let selected = selected_indices
            .into_iter()
            .map(|index| messages[index].clone())
            .collect::<Vec<_>>();
        let dropped_tokens = messages
            .iter()
            .enumerate()
            .filter(|(index, _)| !selected_set.contains(index))
            .map(|(_, message)| message.token_count)
            .sum();

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
    fn optimize_tool_output_removes_noise() {
        let input = "écho\n\u{1b}[32mOK\u{1b}[0m\nline\nline\n\n\n";
        let (optimized, stats) = optimize_tool_output(input);
        assert!(optimized.contains("écho"));
        assert!(optimized.contains("line (repeated 2 times)"));
        assert!(!optimized.contains('\u{1b}'));
        assert_eq!(stats.repeated_lines_folded, 1);
        assert!(stats.bytes_saved > 0);
    }

    #[test]
    fn optimize_tool_output_compacts_json() {
        let input = "{\n  \"status\": \"ok\",\n  \"items\": [1, 2]\n}";
        let (optimized, _) = optimize_tool_output(input);
        assert_eq!(optimized, "{\"status\":\"ok\",\"items\":[1,2]}");
    }

    #[test]
    fn budget_leaves_output_and_safety_margin() {
        let budget = ContextBudget::new(1000, 200);
        assert_eq!(budget.max_input_tokens(), 750);
    }

    #[test]
    fn prepare_uses_remaining_budget_after_minimum_recent_messages() {
        let engine = ContextEngine::new();
        let budget = ContextBudget {
            context_window_tokens: 120,
            reserved_output_tokens: 10,
            safety_margin_tokens: 10,
            min_recent_messages: 1,
        };
        let messages = vec![
            message("system", "system", 20),
            message("a", "user", 20),
            message("b", "assistant", 20),
            message("c", "user", 20),
            message("d", "assistant", 20),
        ];

        let plan = engine.prepare(&messages, budget);
        assert_eq!(plan.dropped_tokens, 0);
        assert_eq!(plan.messages.len(), 5);
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
