//! Minimal Agent Loop adapted from GenericAgent
//!
//! A ~100-line agent loop that provides core ReAct functionality
//! with hooks for extensibility and clean step-by-step execution.

use serde::{Deserialize, Serialize};

/// Outcome of a single step in the agent loop
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepOutcome {
    /// Data returned from the step
    pub data: Option<serde_json::Value>,
    /// Next prompt to send to the LLM (if any)
    pub next_prompt: Option<String>,
    /// Whether the agent should exit
    pub should_exit: bool,
}

impl StepOutcome {
    /// Create a successful outcome with data
    pub fn success(data: serde_json::Value) -> Self {
        Self {
            data: Some(data),
            next_prompt: None,
            should_exit: false,
        }
    }

    /// Create an outcome that continues with a next prompt
    pub fn continue_with(next_prompt: String) -> Self {
        Self {
            data: None,
            next_prompt: Some(next_prompt),
            should_exit: false,
        }
    }

    /// Create an outcome that exits the loop
    pub fn exit(data: serde_json::Value) -> Self {
        Self {
            data: Some(data),
            next_prompt: None,
            should_exit: true,
        }
    }

    /// Create an outcome indicating the current task is done
    pub fn task_done(data: serde_json::Value) -> Self {
        Self {
            data: Some(data),
            next_prompt: None,
            should_exit: true,
        }
    }
}

/// Tool call from the LLM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// Tool name
    pub tool_name: String,
    /// Arguments for the tool
    pub args: serde_json::Value,
    /// Tool call ID
    pub id: String,
}

/// LLM response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMResponse {
    /// Content of the response
    pub content: String,
    /// Tool calls made by the LLM
    pub tool_calls: Vec<ToolCall>,
}

/// Handler for tool dispatch and execution
pub trait ToolHandler: Send + Sync {
    /// Dispatch a tool call to the appropriate handler
    fn dispatch(
        &self,
        tool_name: &str,
        args: serde_json::Value,
        response: &LLMResponse,
        index: usize,
        tool_num: usize,
    ) -> StepOutcome;

    /// Callback at the end of each turn
    fn turn_end_callback(
        &self,
        response: &LLMResponse,
        tool_calls: &[ToolCall],
        tool_results: &[serde_json::Value],
        turn: usize,
        next_prompt: &str,
        exit_reason: &Option<ExitReason>,
    ) -> String;
}

/// Reason for exiting the agent loop
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExitReason {
    /// Agent explicitly exited
    Exited { data: serde_json::Value },
    /// Current task completed
    TaskDone { data: serde_json::Value },
    /// Maximum turns exceeded
    MaxTurnsExceeded,
}

/// Configuration for the minimal agent loop
#[derive(Debug, Clone)]
pub struct AgentLoopConfig {
    /// Maximum number of turns
    pub max_turns: usize,
    /// Whether to output verbose logs
    pub verbose: bool,
    /// Whether to yield turn info
    pub yield_info: bool,
}

impl Default for AgentLoopConfig {
    fn default() -> Self {
        Self {
            max_turns: 40,
            verbose: true,
            yield_info: false,
        }
    }
}

/// Minimal agent loop runner adapted from GenericAgent
///
/// This is a simplified ~100-line agent loop that:
/// - Maintains message history
/// - Calls LLM with tools schema
/// - Executes tool calls via handler dispatch
/// - Supports hooks for extensibility
/// - Has max_turns limit
/// - Supports exit conditions
pub struct MinimalAgentLoop {
    config: AgentLoopConfig,
}

impl MinimalAgentLoop {
    /// Create a new minimal agent loop
    pub fn new(config: AgentLoopConfig) -> Self {
        Self { config }
    }

    /// Run the agent loop
    ///
    /// # Arguments
    /// * `system_prompt` - System prompt for the LLM
    /// * `user_input` - Initial user input
    /// * `handler` - Tool handler for dispatch
    /// * `llm_client` - LLM client for chat completion
    /// * `tools_schema` - Schema of available tools
    ///
    /// # Returns
    /// Exit reason and final state
    pub async fn run<H, L>(
        &self,
        system_prompt: &str,
        user_input: &str,
        handler: &H,
        llm_client: &L,
        tools_schema: &serde_json::Value,
    ) -> ExitReason
    where
        H: ToolHandler,
        L: LLMClient,
    {
        let mut messages = vec![
            serde_json::json!({"role": "system", "content": system_prompt}),
            serde_json::json!({"role": "user", "content": user_input}),
        ];

        let mut turn = 0;
        let mut exit_reason = None;

        while turn < self.config.max_turns {
            turn += 1;

            if self.config.verbose {
                println!("**Turn {}**", turn);
            }

            // Call LLM
            let response = llm_client.chat(&messages, tools_schema).await;

            // Extract tool calls
            let tool_calls = if response.tool_calls.is_empty() {
                vec![ToolCall {
                    tool_name: "no_tool".to_string(),
                    args: serde_json::json!({}),
                    id: String::new(),
                }]
            } else {
                response.tool_calls.clone()
            };

            // Execute tool calls
            let mut tool_results = Vec::new();
            let mut next_prompts = Vec::new();

            for (ii, tc) in tool_calls.iter().enumerate() {
                if tc.tool_name == "no_tool" {
                    continue;
                }

                if self.config.verbose {
                    println!("🛠️ Tool: `{}`", tc.tool_name);
                    println!(
                        "📥 args: {}",
                        serde_json::to_string_pretty(&tc.args).unwrap_or_default()
                    );
                }

                let outcome = handler.dispatch(
                    &tc.tool_name,
                    tc.args.clone(),
                    &response,
                    ii,
                    tool_calls.len(),
                );

                if outcome.should_exit {
                    exit_reason = Some(ExitReason::Exited {
                        data: outcome.data.unwrap_or(serde_json::json!(null)),
                    });
                    break;
                }

                if outcome.next_prompt.is_none() {
                    exit_reason = Some(ExitReason::TaskDone {
                        data: outcome.data.unwrap_or(serde_json::json!(null)),
                    });
                    break;
                }

                if let Some(next) = outcome.next_prompt {
                    next_prompts.push(next);
                }

                if let Some(data) = outcome.data {
                    tool_results.push(data);
                }
            }

            if exit_reason.is_some() {
                break;
            }

            // Determine next prompt
            let next_prompt = if next_prompts.is_empty() {
                String::new()
            } else {
                next_prompts.join("\n")
            };

            // Turn end callback
            let final_prompt = handler.turn_end_callback(
                &response,
                &tool_calls,
                &tool_results,
                turn,
                &next_prompt,
                &exit_reason,
            );

            // Add new message to history
            messages.push(serde_json::json!({
                "role": "user",
                "content": final_prompt,
                "tool_results": tool_results
            }));
        }

        exit_reason.unwrap_or(ExitReason::MaxTurnsExceeded)
    }
}

/// Trait for LLM client
#[allow(async_fn_in_trait)]
pub trait LLMClient: Send + Sync {
    /// Chat completion with tools
    async fn chat(&self, messages: &[serde_json::Value], tools: &serde_json::Value) -> LLMResponse;
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockHandler;
    impl ToolHandler for MockHandler {
        fn dispatch(
            &self,
            tool_name: &str,
            _args: serde_json::Value,
            _response: &LLMResponse,
            _index: usize,
            _tool_num: usize,
        ) -> StepOutcome {
            match tool_name {
                "no_tool" => StepOutcome::task_done(serde_json::json!("done")),
                _ => StepOutcome::continue_with("continue".to_string()),
            }
        }

        fn turn_end_callback(
            &self,
            _response: &LLMResponse,
            _tool_calls: &[ToolCall],
            _tool_results: &[serde_json::Value],
            _turn: usize,
            next_prompt: &str,
            _exit_reason: &Option<ExitReason>,
        ) -> String {
            next_prompt.to_string()
        }
    }

    struct MockLLMClient;
    impl LLMClient for MockLLMClient {
        async fn chat(
            &self,
            _messages: &[serde_json::Value],
            _tools: &serde_json::Value,
        ) -> LLMResponse {
            LLMResponse {
                content: "response".to_string(),
                tool_calls: vec![ToolCall {
                    tool_name: "no_tool".to_string(),
                    args: serde_json::json!({}),
                    id: "1".to_string(),
                }],
            }
        }
    }

    #[tokio::test]
    async fn test_minimal_loop() {
        let config = AgentLoopConfig::default();
        let loop_runner = MinimalAgentLoop::new(config);
        let handler = MockHandler;
        let llm_client = MockLLMClient;

        let result = loop_runner
            .run(
                "You are an agent",
                "Hello",
                &handler,
                &llm_client,
                &serde_json::json!({}),
            )
            .await;

        match result {
            ExitReason::TaskDone { .. } => {}
            _ => panic!("Expected TaskDone"),
        }
    }
}
