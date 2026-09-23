#![forbid(unsafe_code)]

//! Tool execution pipeline with pre/post hooks.
//! Inspired by DeepSeek Harness tools/pre-execute -> tools/execute -> tools/post-execute pattern.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Tool execution context passed to pre/post hooks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionContext {
    /// Tool name being executed
    pub tool_name: String,
    /// Tool arguments
    pub args: serde_json::Value,
    /// Session ID
    pub session_id: String,
    /// Turn ID if available
    pub turn_id: Option<String>,
    /// User ID if available
    pub user_id: Option<String>,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl ToolExecutionContext {
    /// Create a new tool execution context.
    pub fn new(tool_name: String, args: serde_json::Value, session_id: String) -> Self {
        Self {
            tool_name,
            args,
            session_id,
            turn_id: None,
            user_id: None,
            metadata: HashMap::new(),
        }
    }

    /// Add turn ID to context.
    pub fn with_turn_id(mut self, turn_id: String) -> Self {
        self.turn_id = Some(turn_id);
        self
    }

    /// Add user ID to context.
    pub fn with_user_id(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }

    /// Add metadata to context.
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// Result of tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    /// Whether execution succeeded
    pub success: bool,
    /// Output from the tool
    pub output: Option<String>,
    /// Error message if failed
    pub error: Option<String>,
    /// Execution duration in milliseconds
    pub duration_ms: Option<u64>,
    /// Token usage if applicable
    pub token_usage: Option<usize>,
    /// Whether timeout was enforced
    pub timed_out: bool,
    /// Memory limit configured (MB)
    pub memory_limit_mb: u64,
    /// CPU limit configured
    pub cpu_limit: u64,
}

impl ToolExecutionResult {
    /// Create a successful result.
    pub fn success(output: String) -> Self {
        Self {
            success: true,
            output: Some(output),
            error: None,
            duration_ms: None,
            token_usage: None,
            timed_out: false,
            memory_limit_mb: 0,
            cpu_limit: 0,
        }
    }

    /// Create a failed result.
    pub fn failure(error: String) -> Self {
        Self {
            success: false,
            output: None,
            error: Some(error),
            duration_ms: None,
            token_usage: None,
            timed_out: false,
            memory_limit_mb: 0,
            cpu_limit: 0,
        }
    }

    /// Add duration to result.
    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    /// Add token usage to result.
    pub fn with_token_usage(mut self, token_usage: usize) -> Self {
        self.token_usage = Some(token_usage);
        self
    }
}

/// Pre-execution hook result.
#[derive(Debug, Clone)]
pub enum PreExecutionHookResult {
    /// Allow execution to proceed.
    Allow,
    /// Deny execution with reason.
    Deny(String),
    /// Modify arguments before execution.
    ModifyArguments(serde_json::Value),
}

/// Pre-execution hook trait.
pub trait PreExecutionHook: Send + Sync {
    /// Called before tool execution.
    fn pre_execute(&self, context: &ToolExecutionContext) -> PreExecutionHookResult;
}

/// Post-execution hook trait.
pub trait PostExecutionHook: Send + Sync {
    /// Called after tool execution.
    fn post_execute(&self, context: &ToolExecutionContext, result: &ToolExecutionResult);
}

/// Default permission policy hook.
#[allow(missing_debug_implementations)]
pub struct PermissionPolicyHook {
    /// Allowed tools (empty = all allowed)
    allowed_tools: Vec<String>,
    /// Blocked tools
    blocked_tools: Vec<String>,
}

impl PermissionPolicyHook {
    /// Create a new permission policy hook.
    pub fn new() -> Self {
        Self {
            allowed_tools: Vec::new(),
            blocked_tools: Vec::new(),
        }
    }

    /// Add allowed tool.
    pub fn allow_tool(mut self, tool: String) -> Self {
        self.allowed_tools.push(tool);
        self
    }

    /// Add blocked tool.
    pub fn block_tool(mut self, tool: String) -> Self {
        self.blocked_tools.push(tool);
        self
    }
}

impl Default for PermissionPolicyHook {
    fn default() -> Self {
        Self::new()
    }
}

impl PreExecutionHook for PermissionPolicyHook {
    fn pre_execute(&self, context: &ToolExecutionContext) -> PreExecutionHookResult {
        // Check blocked tools first
        if self.blocked_tools.contains(&context.tool_name) {
            return PreExecutionHookResult::Deny(format!(
                "Tool '{}' is blocked by policy",
                context.tool_name
            ));
        }

        // If allowed_tools is not empty, check if tool is in allowlist
        if !self.allowed_tools.is_empty() && !self.allowed_tools.contains(&context.tool_name) {
            return PreExecutionHookResult::Deny(format!(
                "Tool '{}' is not in allowlist",
                context.tool_name
            ));
        }

        PreExecutionHookResult::Allow
    }
}

/// Logging hook for post-execution.
#[allow(missing_debug_implementations)]
pub struct LoggingHook;

impl PostExecutionHook for LoggingHook {
    fn post_execute(&self, context: &ToolExecutionContext, result: &ToolExecutionResult) {
        if result.success {
            println!(
                "[ToolHook] Tool '{}' executed successfully in {:?}ms",
                context.tool_name, result.duration_ms
            );
        } else {
            println!(
                "[ToolHook] Tool '{}' failed: {}",
                context.tool_name,
                result.error.as_deref().unwrap_or("unknown error")
            );
        }
    }
}

/// Tool execution pipeline with hooks.
#[allow(missing_debug_implementations)]
pub struct ToolExecutionPipeline {
    /// Pre-execution hooks
    pre_hooks: Vec<Arc<dyn PreExecutionHook>>,
    /// Post-execution hooks
    post_hooks: Vec<Arc<dyn PostExecutionHook>>,
}

impl ToolExecutionPipeline {
    /// Create a new tool execution pipeline.
    pub fn new() -> Self {
        Self {
            pre_hooks: Vec::new(),
            post_hooks: Vec::new(),
        }
    }

    /// Add a pre-execution hook.
    pub fn add_pre_hook(mut self, hook: Arc<dyn PreExecutionHook>) -> Self {
        self.pre_hooks.push(hook);
        self
    }

    /// Add a post-execution hook.
    pub fn add_post_hook(mut self, hook: Arc<dyn PostExecutionHook>) -> Self {
        self.post_hooks.push(hook);
        self
    }

    /// Execute tool with pipeline.
    pub async fn execute<F, Fut>(
        &self,
        mut context: ToolExecutionContext,
        executor: F,
    ) -> ToolExecutionResult
    where
        F: FnOnce(ToolExecutionContext) -> Fut,
        Fut: std::future::Future<Output = ToolExecutionResult>,
    {
        // Run pre-execution hooks (may modify context)
        for hook in &self.pre_hooks {
            match hook.pre_execute(&context) {
                PreExecutionHookResult::Allow => continue,
                PreExecutionHookResult::Deny(reason) => {
                    return ToolExecutionResult::failure(reason);
                }
                PreExecutionHookResult::ModifyArguments(new_args) => {
                    context.args = new_args;
                }
            }
        }

        // Execute the tool
        let start = std::time::Instant::now();
        let context_clone = context.clone();
        let mut result = executor(context).await;
        let duration = start.elapsed();

        // Add duration to result
        result.duration_ms = Some(duration.as_millis() as u64);

        // Run post-execution hooks
        for hook in &self.post_hooks {
            hook.post_execute(&context_clone, &result);
        }

        result
    }
}

impl Default for ToolExecutionPipeline {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_policy_allow() {
        let hook = PermissionPolicyHook::new().allow_tool("read_file".to_string());
        let context = ToolExecutionContext::new(
            "read_file".to_string(),
            serde_json::json!({"path": "test.txt"}),
            "session-1".to_string(),
        );

        match hook.pre_execute(&context) {
            PreExecutionHookResult::Allow => (),
            _ => panic!("Expected Allow"),
        }
    }

    #[test]
    fn test_permission_policy_deny() {
        let hook = PermissionPolicyHook::new().block_tool("delete_file".to_string());
        let context = ToolExecutionContext::new(
            "delete_file".to_string(),
            serde_json::json!({"path": "test.txt"}),
            "session-1".to_string(),
        );

        match hook.pre_execute(&context) {
            PreExecutionHookResult::Deny(_) => (),
            _ => panic!("Expected Deny"),
        }
    }

    #[test]
    fn test_execution_result() {
        let result = ToolExecutionResult::success("test output".to_string())
            .with_duration(100)
            .with_token_usage(50);

        assert!(result.success);
        assert_eq!(result.output, Some("test output".to_string()));
        assert_eq!(result.duration_ms, Some(100));
        assert_eq!(result.token_usage, Some(50));
    }

    #[tokio::test]
    async fn test_pipeline_with_hooks() {
        let pipeline = ToolExecutionPipeline::new()
            .add_pre_hook(Arc::new(PermissionPolicyHook::new()))
            .add_post_hook(Arc::new(LoggingHook));

        let context = ToolExecutionContext::new(
            "test_tool".to_string(),
            serde_json::json!({}),
            "session-1".to_string(),
        );

        let executor = |ctx: ToolExecutionContext| async move {
            ToolExecutionResult::success(format!("Executed: {}", ctx.tool_name))
        };

        let result = pipeline.execute(context, executor).await;
        assert!(result.success);
    }
}
