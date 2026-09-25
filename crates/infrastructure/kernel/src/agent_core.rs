//! Agent orchestration implementation kept separate from the durable kernel runtime.
//!
//! This module contains the ReAct agent, tool executor and planning/supervision
//! support that historically lived inline in lib.rs.

use super::*;
use agenticos_contracts::{ModelRequest, Sandbox, SandboxRequest, ToolRequest, ToolRuntimePort};

/// Recovery state for failed tool executions with retry logic.
#[derive(Debug, Clone)]
struct RecoveryState {
    /// Current retry count for the current operation
    retry_count: usize,
    /// Maximum retries allowed
    max_retries: usize,
    /// Consecutive failures count for circuit breaker
    consecutive_failures: usize,
    /// Circuit breaker threshold
    circuit_breaker_threshold: usize,
    /// Whether circuit breaker is open
    circuit_breaker_open: bool,
    /// Last error context
    last_error: Option<String>,
}

impl Default for RecoveryState {
    fn default() -> Self {
        Self {
            retry_count: 0,
            max_retries: 3,
            consecutive_failures: 0,
            circuit_breaker_threshold: 5,
            circuit_breaker_open: false,
            last_error: None,
        }
    }
}

impl RecoveryState {
    /// Create a new recovery state with custom configuration.
    #[allow(dead_code)]
    pub fn new(max_retries: usize, circuit_breaker_threshold: usize) -> Self {
        Self {
            retry_count: 0,
            max_retries,
            consecutive_failures: 0,
            circuit_breaker_threshold,
            circuit_breaker_open: false,
            last_error: None,
        }
    }

    /// Increment retry count.
    pub fn increment_retry(&mut self) -> bool {
        self.retry_count += 1;
        self.retry_count <= self.max_retries
    }

    /// Record a failure and check circuit breaker.
    pub fn record_failure(&mut self, error: String) -> bool {
        self.consecutive_failures += 1;
        self.last_error = Some(error);

        if self.consecutive_failures >= self.circuit_breaker_threshold {
            self.circuit_breaker_open = true;
            false // Circuit breaker triggered
        } else {
            true // Continue retries
        }
    }

    /// Record a success and reset circuit breaker.
    pub fn record_success(&mut self) {
        self.retry_count = 0;
        self.consecutive_failures = 0;
        self.circuit_breaker_open = false;
        self.last_error = None;
    }

    /// Check if retries are exhausted.
    #[allow(dead_code)]
    pub fn is_exhausted(&self) -> bool {
        self.retry_count >= self.max_retries
    }

    /// Check if circuit breaker is open.
    pub fn is_circuit_breaker_open(&self) -> bool {
        self.circuit_breaker_open
    }

    /// Reset circuit breaker.
    #[allow(dead_code)]
    pub fn reset_circuit_breaker(&mut self) {
        self.circuit_breaker_open = false;
        self.consecutive_failures = 0;
    }

    /// Calculate exponential backoff delay in milliseconds.
    pub fn calculate_backoff_ms(&self) -> u64 {
        let base_delay_ms = 100u64; // 100ms base delay
        let max_delay_ms = 5000u64; // 5 seconds max delay
        let delay = base_delay_ms * (2u64.pow(self.retry_count as u32));
        delay.min(max_delay_ms)
    }
}

pub(crate) fn is_structured_tool_action(action: &str) -> bool {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(action) else {
        return false;
    };
    value
        .get("tool")
        .or_else(|| value.get("tool_id"))
        .and_then(serde_json::Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}

/// ReAct agent core loop implementation.
#[allow(missing_debug_implementations)]
pub struct ReactAgent {
    /// Agent identity (SOUL.md equivalent)
    pub(crate) identity: String,
    /// Maximum turns per session
    pub(crate) max_turns: usize,
    /// SOUL system for persistent personality and memory (Hermes-style)
    soul: Arc<RwLock<Soul>>,
    /// Interior mutability for concurrent access
    inner: Mutex<ReactAgentInner>,
}

/// Interior mutable state of ReactAgent.
struct ReactAgentInner {
    /// Current turn count
    current_turn: usize,
    /// Model provider for LLM integration
    model_provider: Option<Arc<dyn ModelProvider>>,
    /// Optional model identifier pinned for this agent session.
    preferred_model: Option<String>,
    /// SQLite tier 2 memory for conversation history
    memory: Option<Arc<SqliteMemory>>,
    /// Current session ID
    session_id: String,
    /// Tool executor for legacy action compatibility.
    tool_executor: Option<ToolExecutor>,
    /// Capability-gated runtime for native and MCP tool execution.
    tool_runtime: Option<Arc<dyn ToolRuntimePort>>,
    /// Default short-lived grant used for safe agent tool calls.
    tool_grant_id: Option<String>,
    /// Optional checkpoint store for state persistence
    checkpoint_store: Option<Arc<dyn EventStore>>,
    /// Optional planner for task decomposition
    planner: Option<Planner>,
    /// Current plan being executed
    current_plan: Option<Plan>,
    /// Optional tool registry for tool discovery
    tool_registry: Option<ToolRegistry>,
    /// Optional supervisor for subagent coordination
    supervisor: Option<Supervisor>,
    /// Optional sandbox for secure tool execution
    sandbox: Option<Arc<dyn Sandbox>>,
    /// Session event log for durable event tracking
    event_log: Option<SessionEventLog>,
    /// Tool execution pipeline with pre/post hooks
    tool_pipeline: Option<Arc<ToolExecutionPipeline>>,
    /// Goal manager for persistent goals
    goal_manager: Option<Arc<GoalManager>>,
    /// Heartbeat manager for session liveness
    heartbeat_manager: Option<Arc<HeartbeatManager>>,
    /// Recovery state for failed tool executions
    recovery_state: RecoveryState,
    /// Skills catalog with full skill metadata (interior mutable)
    skills_catalog: Vec<Skill>,
    /// Memory tier 1: MEMORY.md (interior mutable)
    memory_md: String,
    /// Memory tier 1: USER.md (interior mutable)
    user_md: String,
    /// Cached static system-prompt section. Dynamic conversation history is appended per turn.
    static_system_prompt: Option<Arc<str>>,
}

impl ReactAgent {
    /// Create a new ReAct agent with default configuration.
    pub fn new(identity: String) -> Self {
        Self {
            identity,
            max_turns: 90,
            soul: Arc::new(RwLock::new(Soul::new())),
            inner: Mutex::new(ReactAgentInner {
                current_turn: 0,
                model_provider: None,
                preferred_model: None,
                memory: None,
                session_id: uuid::Uuid::new_v4().to_string(),
                tool_executor: None,
                tool_runtime: None,
                tool_grant_id: None,
                checkpoint_store: None,
                planner: None,
                current_plan: None,
                tool_registry: None,
                supervisor: None,
                sandbox: None,
                event_log: None,
                tool_pipeline: None::<Arc<ToolExecutionPipeline>>,

                goal_manager: None::<Arc<GoalManager>>,
                heartbeat_manager: None::<Arc<HeartbeatManager>>,
                recovery_state: RecoveryState::default(),
                skills_catalog: Vec::new(),
                memory_md: String::new(),
                user_md: String::new(),
                static_system_prompt: None,
            }),
        }
    }

    /// Get the agent's identity/name.
    pub fn name(&self) -> &str {
        &self.identity
    }

    /// Create a new ReAct agent with custom max turns.
    pub fn with_max_turns(identity: String, max_turns: usize) -> Self {
        Self {
            identity,
            max_turns,
            soul: Arc::new(RwLock::new(Soul::new())),
            inner: Mutex::new(ReactAgentInner {
                current_turn: 0,
                model_provider: None,
                preferred_model: None,
                memory: None,
                session_id: uuid::Uuid::new_v4().to_string(),
                tool_executor: None,
                tool_runtime: None,
                tool_grant_id: None,
                checkpoint_store: None,
                planner: None,
                current_plan: None,
                tool_registry: None,
                supervisor: None,
                sandbox: None,
                event_log: None,
                tool_pipeline: None::<Arc<ToolExecutionPipeline>>,

                goal_manager: None::<Arc<GoalManager>>,
                heartbeat_manager: None::<Arc<HeartbeatManager>>,
                recovery_state: RecoveryState::default(),
                skills_catalog: Vec::new(),
                memory_md: String::new(),
                user_md: String::new(),
                static_system_prompt: None,
            }),
        }
    }

    /// Set the model provider for LLM integration.
    pub fn set_model_provider(&self, provider: Arc<dyn ModelProvider>) {
        self.inner.lock().unwrap().model_provider = Some(provider);
    }

    /// Pin this agent session to a specific registered model identifier.
    pub fn set_model(&self, model: String) {
        let normalized = model.trim();
        self.inner.lock().unwrap().preferred_model =
            (!normalized.is_empty()).then(|| normalized.to_string());
    }

    /// Set SQLite tier 2 memory for conversation history.
    pub fn set_memory(&self, memory: Arc<SqliteMemory>) {
        self.inner.lock().unwrap().memory = Some(memory);
    }

    /// Get session history from memory.
    pub async fn get_session_history(&self, session_id: &str) -> Vec<serde_json::Value> {
        let memory = {
            let inner = self.inner.lock().unwrap();
            inner.memory.clone()
        };

        if let Some(memory) = memory {
            match memory.get_session_history(session_id, 100).await {
                Ok(messages) => messages
                    .into_iter()
                    .map(|msg| {
                        serde_json::json!({
                            "role": msg.role,
                            "content": msg.content,
                            "timestamp": msg.timestamp
                        })
                    })
                    .collect(),
                Err(_) => vec![],
            }
        } else {
            vec![]
        }
    }

    /// Set the session ID for conversation tracking.
    pub fn set_session_id(&self, session_id: String) {
        self.inner.lock().unwrap().session_id = session_id;
    }

    /// Set the tool executor for real tool execution.
    pub fn set_tool_executor(&self, executor: ToolExecutor) {
        self.inner.lock().unwrap().tool_executor = Some(executor);
    }

    /// Set the capability-gated runtime for structured agent tool calls.
    pub fn set_tool_runtime(&self, runtime: Arc<dyn ToolRuntimePort>) {
        self.inner.lock().unwrap().tool_runtime = Some(runtime);
    }

    /// Set the short-lived capability grant used for agent tool calls.
    pub fn set_tool_grant_id(&self, grant_id: String) {
        self.inner.lock().unwrap().tool_grant_id = Some(grant_id);
    }

    /// Set the checkpoint store for state persistence.
    pub fn set_checkpoint_store(&self, store: Arc<dyn EventStore>) {
        self.inner.lock().unwrap().checkpoint_store = Some(store);
    }

    /// Set the planner for task decomposition.
    pub fn set_planner(&self, planner: Planner) {
        self.inner.lock().unwrap().planner = Some(planner);
    }

    /// Set the tool registry for tool discovery.
    pub fn set_tool_registry(&self, registry: ToolRegistry) {
        self.inner.lock().unwrap().tool_registry = Some(registry);
    }

    /// Set the supervisor for subagent coordination.
    pub fn set_supervisor(&self, supervisor: Supervisor) {
        self.inner.lock().unwrap().supervisor = Some(supervisor);
    }

    /// Set the model provider for Planner and Supervisor LLM integration.
    pub fn set_model_provider_for_planning(
        &self,
        provider: Arc<dyn agenticos_contracts::ModelProvider>,
    ) {
        self.inner.lock().unwrap().model_provider = Some(provider);
    }

    /// Set the sandbox for secure tool execution.
    pub fn set_sandbox(&self, sandbox: Arc<dyn Sandbox>) {
        self.inner.lock().unwrap().sandbox = Some(sandbox);
    }

    /// Set the session event log for durable event tracking.
    pub fn set_event_log(&self, event_log: SessionEventLog) {
        self.inner.lock().unwrap().event_log = Some(event_log);
    }

    /// Get the session event log if available.
    pub fn get_event_log(&self) -> Option<SessionEventLog> {
        self.inner.lock().unwrap().event_log.clone()
    }

    /// Set the tool execution pipeline with pre/post hooks.
    pub fn set_tool_pipeline(&self, pipeline: ToolExecutionPipeline) {
        self.inner.lock().unwrap().tool_pipeline = Some(Arc::new(pipeline));
    }

    /// Get the tool execution pipeline if available.
    pub fn get_tool_pipeline(&self) -> Option<Arc<ToolExecutionPipeline>> {
        self.inner.lock().unwrap().tool_pipeline.clone()
    }

    /// Set the goal manager for persistent goals.
    pub fn set_goal_manager(&self, manager: GoalManager) {
        self.inner.lock().unwrap().goal_manager = Some(Arc::new(manager));
    }

    /// Get the goal manager if available.
    pub fn get_goal_manager(&self) -> Option<Arc<GoalManager>> {
        self.inner.lock().unwrap().goal_manager.clone()
    }

    /// Set the heartbeat manager for session liveness.
    pub fn set_heartbeat_manager(&self, manager: HeartbeatManager) {
        self.inner.lock().unwrap().heartbeat_manager = Some(Arc::new(manager));
    }

    /// Get the heartbeat manager if available.
    pub fn get_heartbeat_manager(&self) -> Option<Arc<HeartbeatManager>> {
        self.inner.lock().unwrap().heartbeat_manager.clone()
    }

    /// Get the SOUL (Hermes-style personality and memory system).
    pub async fn get_soul(&self) -> Soul {
        self.soul.read().await.clone()
    }

    /// Update the SOUL's memory.
    pub async fn update_soul_memory(&self, new_memory: String) {
        let mut soul = self.soul.write().await;
        soul.update_memory(new_memory);
    }

    /// Add a skill to the SOUL (Hermes-style skill crystallization).
    pub async fn add_skill_to_soul(&self, skill: SkillEntry) {
        let mut soul = self.soul.write().await;
        soul.add_skill(skill);
    }

    /// Record a milestone in the SOUL.
    pub async fn record_milestone(&self, milestone: Milestone) {
        let mut soul = self.soul.write().await;
        soul.add_milestone(milestone);
    }

    /// Get top skills from the SOUL.
    pub async fn get_top_skills(&self, limit: usize) -> Vec<SkillEntry> {
        let soul = self.soul.read().await;
        soul.get_top_skills(limit).into_iter().cloned().collect()
    }

    /// Load SOUL from a file.
    pub async fn load_soul_from_file(
        &self,
        path: PathBuf,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let soul = Soul::load_from_file(&path)?;
        *self.soul.write().await = soul;
        Ok(())
    }

    /// Save SOUL to a file.
    pub async fn save_soul_to_file(&self, path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        let soul = self.soul.read().await;
        soul.save_to_file(&path)?;
        Ok(())
    }

    /// Add a skill to the catalog.
    pub fn add_skill(&self, skill: Skill) {
        let mut inner = self.inner.lock().unwrap();
        inner.skills_catalog.push(skill);
        inner.static_system_prompt = None;
    }

    /// Add a skill from markdown content.
    pub fn add_skill_from_markdown(&self, markdown: &str) -> Result<(), String> {
        let skill = Skill::from_markdown(markdown)?;
        let mut inner = self.inner.lock().unwrap();
        inner.skills_catalog.push(skill);
        inner.static_system_prompt = None;
        Ok(())
    }

    /// Set MEMORY.md content.
    pub fn set_memory_md(&self, content: String) {
        let mut inner = self.inner.lock().unwrap();
        inner.memory_md = content;
        inner.static_system_prompt = None;
    }

    /// Set USER.md content.
    pub fn set_user_md(&self, content: String) {
        let mut inner = self.inner.lock().unwrap();
        inner.user_md = content;
        inner.static_system_prompt = None;
    }

    /// Build system prompt from a cached static section plus budgeted conversation history.
    pub async fn build_system_prompt(&self) -> String {
        self.build_system_prompt_with_input(None).await
    }

    async fn build_system_prompt_with_input(&self, input: Option<&str>) -> String {
        let cached_static = {
            let inner = self.inner.lock().unwrap();
            inner.static_system_prompt.clone()
        };

        let static_prompt = if let Some(cached) = cached_static {
            cached
        } else {
            let (memory_md, user_md, skill_summaries) = {
                let inner = self.inner.lock().unwrap();
                let max_skill_summaries = std::env::var("AGENTICOS_MAX_PROMPT_SKILLS")
                    .ok()
                    .and_then(|value| value.parse::<usize>().ok())
                    .unwrap_or(32)
                    .clamp(0, 128);

                (
                    inner.memory_md.clone(),
                    inner.user_md.clone(),
                    inner
                        .skills_catalog
                        .iter()
                        .take(max_skill_summaries)
                        .map(Skill::summary)
                        .collect::<Vec<_>>(),
                )
            };

            let mut prompt = String::new();
            prompt.push_str(&self.identity);
            prompt.push('\n');

            if !memory_md.is_empty() {
                prompt.push_str("## Memory (MEMORY.md)\n");
                prompt.push_str(&memory_md);
                prompt.push('\n');
            }

            if !user_md.is_empty() {
                prompt.push_str("## User Preferences (USER.md)\n");
                prompt.push_str(&user_md);
                prompt.push('\n');
            }

            if !skill_summaries.is_empty() {
                prompt.push_str("## Available Skills\n");
                for summary in skill_summaries {
                    prompt.push_str("- ");
                    prompt.push_str(&summary);
                    prompt.push('\n');
                }
                prompt.push('\n');
            }

            prompt.push_str("## Instructions\n");
            prompt.push_str("Use ReAct pattern: Thought → Action → Observation → repeat.\n");
            prompt.push_str("Be concise and precise.\n");
            prompt.push_str("When a tool is needed, emit ONLY JSON in the form {\"tool\":\"tool.id\",\"arguments\":{...}}.\n");
            prompt.push_str("Never invent tool IDs; use only the registered tool IDs supplied by the runtime.\n");

            let cached = Arc::<str>::from(prompt);
            let mut inner = self.inner.lock().unwrap();
            let existing = inner
                .static_system_prompt
                .get_or_insert_with(|| cached.clone())
                .clone();
            existing
        };

        let (memory, session_id) = {
            let inner = self.inner.lock().unwrap();
            (inner.memory.clone(), inner.session_id.clone())
        };

        let mut prompt = static_prompt.to_string();

        let tool_runtime = {
            let inner = self.inner.lock().unwrap();
            inner.tool_runtime.clone()
        };
        if let Some(runtime) = tool_runtime {
            if let Ok(tools) = runtime.list_tools().await {
                if !tools.is_empty() {
                    prompt.push_str("\n## Available Tools\n");
                    let max_tools = std::env::var("AGENTICOS_MAX_PROMPT_TOOLS")
                        .ok()
                        .and_then(|value| value.parse::<usize>().ok())
                        .unwrap_or(64)
                        .clamp(1, 256);
                    for tool in tools.into_iter().take(max_tools) {
                        prompt.push_str("- ");
                        prompt.push_str(&tool.tool_id);
                        prompt.push_str(": ");
                        prompt.push_str(&tool.description);
                        if !tool.context_requirements.is_empty() {
                            prompt.push_str(" [");
                            prompt.push_str(&tool.context_requirements.join(", "));
                            prompt.push(']');
                        }
                        prompt.push('\n');
                    }
                }
            }
        }

        if let Some(memory) = memory {
            let history_limit = std::env::var("AGENTICOS_MEMORY_HISTORY_LIMIT")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(64)
                .clamp(8, 256);

            if let Ok(context) = memory.get_session_history(&session_id, history_limit).await {
                if !context.is_empty() {
                    let run_id = agenticos_contracts::RunId::new(format!("session:{session_id}"))
                        .unwrap_or_else(|_| {
                            agenticos_contracts::RunId::new("session").expect("static run id")
                        });
                    let messages = context
                        .into_iter()
                        .map(|msg| agenticos_contracts::Message {
                            message_id: msg.id,
                            role: msg.role,
                            content: msg.content.clone(),
                            timestamp: msg.timestamp.max(0) as u64,
                            token_count: ((msg.content.chars().count() as u32).saturating_add(3)
                                / 4)
                            .max(1),
                            run_id: run_id.clone(),
                        })
                        .collect::<Vec<_>>();
                    let context_window = std::env::var("AGENTICOS_CONTEXT_WINDOW")
                        .ok()
                        .and_then(|value| value.parse::<u32>().ok())
                        .unwrap_or(8192)
                        .max(256);
                    let reserved_output = std::env::var("AGENTICOS_RESERVED_OUTPUT_TOKENS")
                        .ok()
                        .and_then(|value| value.parse::<u32>().ok())
                        .unwrap_or(2048)
                        .min(context_window.saturating_sub(1));
                    let safety_margin = context_window / 20;
                    let budget = ContextBudget {
                        context_window_tokens: context_window,
                        reserved_output_tokens: reserved_output,
                        safety_margin_tokens: safety_margin,
                        min_recent_messages: 10,
                    };
                    let prompt_overhead_tokens = estimate_prompt_tokens(&prompt)
                        .saturating_add(input.map(estimate_prompt_tokens).unwrap_or(0));
                    let plan = ContextEngine::new().prepare_with_overhead(
                        &messages,
                        budget,
                        prompt_overhead_tokens,
                    );
                    if !plan.messages.is_empty() {
                        prompt.push_str("## Conversation History (Recent)\n");
                        for msg in plan.messages {
                            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
                        }
                        prompt.push('\n');
                    }
                }
            }
        }

        prompt
    }

    /// Execute thought/reasoning step using the configured model provider.
    pub async fn think(&self, input: &str) -> Result<String, ContractError> {
        let (provider, turn, preferred_model) = {
            let inner = self.inner.lock().unwrap();
            (
                inner.model_provider.clone(),
                inner.current_turn,
                inner.preferred_model.clone(),
            )
        };

        self.think_inner(
            provider.as_ref(),
            turn,
            input,
            preferred_model.as_deref(),
            None,
        )
        .await
    }

    /// Inner thought method taking model provider and turn count without holding locks.
    async fn think_inner(
        &self,
        model_provider: Option<&Arc<dyn ModelProvider>>,
        current_turn: usize,
        input: &str,
        preferred_model: Option<&str>,
        parameters: Option<&str>,
    ) -> Result<String, ContractError> {
        if let Some(provider) = model_provider {
            let system_prompt = self.build_system_prompt_with_input(Some(input)).await;
            let request = ModelRequest {
                request_id: format!("think-{}", current_turn),
                model: preferred_model.unwrap_or("default").to_string(),
                input: format!("{}\n\nUser: {}", system_prompt, input),
                parameters: parameters.map(ToOwned::to_owned),
            };

            match provider.execute(request).await {
                Ok(response) => Ok(response.output),
                Err(e) => Err(ContractError::ParseError(format!("LLM error: {:?}", e))),
            }
        } else {
            Err(ContractError::MissingCapability)
        }
    }

    /// Execute action step (tool call).
    pub async fn act(&self, action: &str) -> Result<String, ContractError> {
        let (executor, runtime, grant_id) = {
            let inner = self.inner.lock().unwrap();
            (
                inner.tool_executor.clone(),
                inner.tool_runtime.clone(),
                inner.tool_grant_id.clone(),
            )
        };
        self.act_inner(
            executor.as_ref(),
            runtime.as_ref(),
            grant_id.as_deref(),
            action,
        )
        .await
    }

    /// Inner act method taking reference to executor.
    async fn act_inner(
        &self,
        executor: Option<&ToolExecutor>,
        tool_runtime: Option<&Arc<dyn ToolRuntimePort>>,
        default_grant_id: Option<&str>,
        action: &str,
    ) -> Result<String, ContractError> {
        if let Some(runtime) = tool_runtime {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(action) {
                let tool_id = value
                    .get("tool")
                    .or_else(|| value.get("tool_id"))
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty());
                if let Some(tool_id) = tool_id {
                    let arguments = value
                        .get("arguments")
                        .or_else(|| value.get("parameters"))
                        .cloned()
                        .unwrap_or_else(|| serde_json::json!({}));
                    let grant_id = value
                        .get("grant_id")
                        .and_then(serde_json::Value::as_str)
                        .or(default_grant_id)
                        .unwrap_or_default()
                        .to_string();
                    let request = ToolRequest {
                        request_id: format!("tool-{}", uuid::Uuid::new_v4()),
                        tool_id: tool_id.to_string(),
                        parameters: arguments.to_string(),
                        agent_id: self.identity.clone(),
                        grant_id,
                    };
                    let response = runtime.execute(request).await?;
                    if response.success {
                        return Ok(response.result);
                    }
                    return Err(ContractError::ParseError(
                        response
                            .error
                            .unwrap_or_else(|| "tool execution failed".to_string()),
                    ));
                }
            }
        }
        if let Some(executor) = executor {
            // Parse action to determine tool type
            // Format: "tool_name:args" or simple command
            if action.starts_with("read_file:") {
                let path = action.strip_prefix("read_file:").unwrap_or("");
                let result = executor.read_file(path);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action.starts_with("write_file:") {
                // Format: "write_file:path:content"
                let parts: Vec<&str> = action.splitn(3, ':').collect();
                if parts.len() >= 2 {
                    let path = parts[1];
                    let content = if parts.len() >= 3 { parts[2] } else { "" };
                    let result = executor.write_file(path, content);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid write_file format".to_string(),
                    ))
                }
            } else if action.starts_with("edit_line:") {
                // Format: "edit_line:path:line_number:new_content"
                let parts: Vec<&str> = action.splitn(4, ':').collect();
                if parts.len() >= 3 {
                    let path = parts[1];
                    let line_number: usize = parts[2].parse().unwrap_or(0);
                    let new_content = if parts.len() >= 4 { parts[3] } else { "" };
                    let result = executor.edit_line(path, line_number, new_content);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid edit_line format".to_string(),
                    ))
                }
            } else if action.starts_with("insert_line:") {
                // Format: "insert_line:path:line_number:new_content"
                let parts: Vec<&str> = action.splitn(4, ':').collect();
                if parts.len() >= 3 {
                    let path = parts[1];
                    let line_number: usize = parts[2].parse().unwrap_or(0);
                    let new_content = if parts.len() >= 4 { parts[3] } else { "" };
                    let result = executor.insert_line(path, line_number, new_content);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid insert_line format".to_string(),
                    ))
                }
            } else if action.starts_with("delete_line:") {
                // Format: "delete_line:path:line_number"
                let parts: Vec<&str> = action.splitn(3, ':').collect();
                if parts.len() >= 3 {
                    let path = parts[1];
                    let line_number: usize = parts[2].parse().unwrap_or(0);
                    let result = executor.delete_line(path, line_number);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid delete_line format".to_string(),
                    ))
                }
            } else if action.starts_with("find_and_replace:") {
                // Format: "find_and_replace:path:find:replace"
                let parts: Vec<&str> = action.splitn(4, ':').collect();
                if parts.len() >= 3 {
                    let path = parts[1];
                    let find = parts[2];
                    let replace = if parts.len() >= 4 { parts[3] } else { "" };
                    let result = executor.find_and_replace(path, find, replace);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid find_and_replace format".to_string(),
                    ))
                }
            } else if action.starts_with("file_exists:") {
                let path = action.strip_prefix("file_exists:").unwrap_or("");
                let result = executor.file_exists(path);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_status" {
                let result = executor.git_status();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action.starts_with("git_add:") {
                let path = action.strip_prefix("git_add:").unwrap_or("");
                let result = executor.git_add(path);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action.starts_with("git_commit:") {
                let message = action.strip_prefix("git_commit:").unwrap_or("");
                let result = executor.git_commit(message);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_push" {
                let result = executor.git_push();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_diff" {
                let result = executor.git_diff();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_log" {
                let result = executor.git_log();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_branch" {
                let result = executor.git_branch();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action.starts_with("execute:") {
                let command = action.strip_prefix("execute:").unwrap_or("");
                let result = executor.execute_command(command);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else {
                // Default: try as command
                let result = executor.execute_command(action);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            }
        } else {
            // Fallback when no executor configured
            Ok(format!("Executed action: {}", action))
        }
    }

    /// Process observation step.
    pub fn observe(&self, observation: &str) -> String {
        format!("Observation: {}", observation)
    }

    /// Execute one full ReAct loop turn using default model parameters.
    pub async fn execute_turn(&self, input: &str) -> Result<String, ContractError> {
        self.execute_turn_with_parameters(input, None).await
    }

    /// Execute one full ReAct loop turn with provider parameters encoded as JSON.
    pub async fn execute_turn_with_parameters(
        &self,
        input: &str,
        parameters: Option<String>,
    ) -> Result<String, ContractError> {
        // Reserve the turn atomically so concurrent requests cannot reuse the same turn.
        {
            let mut inner = self.inner.lock().unwrap();
            inner.current_turn = inner.current_turn.saturating_add(1);
        }

        // Snapshot required state without holding the lock across await boundaries
        let (
            current_turn,
            session_id,
            memory,
            model_provider,
            planner,
            current_plan,
            tool_executor,
            tool_runtime,
            tool_grant_id,
            checkpoint_store,
            supervisor,
            sandbox,
            event_log,
            tool_pipeline,
            _soul,
            goal_manager,
            heartbeat_manager,
            preferred_model,
        ) = {
            let inner = self.inner.lock().unwrap();
            (
                inner.current_turn,
                inner.session_id.clone(),
                inner.memory.clone(),
                inner.model_provider.clone(),
                inner.planner.clone(),
                inner.current_plan.clone(),
                inner.tool_executor.clone(),
                inner.tool_runtime.clone(),
                inner.tool_grant_id.clone(),
                inner.checkpoint_store.clone(),
                inner.supervisor.clone(),
                inner.sandbox.clone(),
                inner.event_log.clone(),
                inner.tool_pipeline.clone(),
                self.soul.clone(),
                inner.goal_manager.clone(),
                inner.heartbeat_manager.clone(),
                inner.preferred_model.clone(),
            )
        };

        // Track turn start time for latency measurement
        let turn_start_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Log turn start event
        let turn_id = if let Some(log) = &event_log {
            let tid = SessionEvent::generate_id("turn");
            log.append(SessionEvent::TurnStart {
                turn_id: tid.clone(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            });

            // Log user message event
            log.append(SessionEvent::UserMessage {
                message_id: SessionEvent::generate_id("msg"),
                turn_id: tid.clone(),
                content: input.to_string(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            });
            Some(tid)
        } else {
            None
        };

        // Update heartbeat for this session
        if let Some(hbm) = &heartbeat_manager {
            hbm.update_heartbeat(&session_id, format!("Turn {} in progress", current_turn))
                .await;
        }

        // Create a goal if input is complex and goal manager is available
        if let Some(gm) = &goal_manager {
            if input.len() > 100 {
                let goal = Goal {
                    id: uuid::Uuid::new_v4().to_string(),
                    description: input.to_string(),
                    progress: 0.0,
                    status: GoalStatus::Active,
                    session_id: session_id.clone(),
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                };
                gm.set_goal(goal).await;
            }
        }

        // Store user input in SQLite memory if available
        if let Some(memory) = &memory {
            let msg_id = format!("user-{}", uuid::Uuid::new_v4());
            memory
                .store_message(&msg_id, &session_id, "user", input)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("failed to persist user message: {error}"))
                })?;
        }

        // Use planner to decompose complex tasks if available
        let plan = if let Some(planner) = &planner {
            if current_plan.is_none() || current_plan.as_ref().map_or(true, |p| p.is_complete()) {
                Some(planner.generate_plan(input, model_provider.as_ref()).await)
            } else {
                current_plan
            }
        } else {
            None
        };

        // Step 1: Thought/Reasoning
        let thought = self
            .think_inner(
                model_provider.as_ref(),
                current_turn,
                input,
                preferred_model.as_deref(),
                parameters.as_deref(),
            )
            .await?;

        // Store assistant thought in SQLite memory if available
        if let Some(memory) = &memory {
            let msg_id = format!("assistant-{}", uuid::Uuid::new_v4());
            memory
                .store_message(&msg_id, &session_id, "assistant", &thought)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!(
                        "failed to persist assistant message: {error}"
                    ))
                })?;
        }

        // Log assistant message event
        if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
            log.append(SessionEvent::AssistantMessage {
                message_id: SessionEvent::generate_id("msg"),
                turn_id: tid.clone(),
                content: thought.clone(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                token_count: None,
            });
        }

        // Step 2: Action
        let action = thought.clone();

        // Step 3: Observation
        let observation = if let Some(pipeline) = &tool_pipeline {
            if !is_structured_tool_action(&action) {
                action.clone()
            } else {
                // Execute structured tool calls with pipeline (pre/post hooks).
                let context = ToolExecutionContext::new(
                    "react_action".to_string(),
                    serde_json::json!({"action": action}),
                    session_id.clone(),
                )
                .with_turn_id(turn_id.clone().unwrap_or_else(|| "unknown".to_string()));

                // Log tool call start event
                if let (Some(log), Some(_tid)) = (&event_log, &turn_id) {
                    log.append(SessionEvent::ToolCallStart {
                        tool_id: "react_action".to_string(),
                        step_id: SessionEvent::generate_id("step"),
                        tool_name: "react_action".to_string(),
                        args: serde_json::json!({"action": action}),
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                    });
                }

                let executor = |ctx: ToolExecutionContext| async move {
                    self.act_inner(
                        tool_executor.as_ref(),
                        tool_runtime.as_ref(),
                        tool_grant_id.as_deref(),
                        &ctx.args["action"].as_str().unwrap_or(""),
                    )
                    .await
                    .map(|o| ToolExecutionResult::success(o))
                    .unwrap_or_else(|e| ToolExecutionResult::failure(e.to_string()))
                };

                let result = pipeline.execute(context, executor).await;

                // Log tool call result event
                if let (Some(log), Some(_tid)) = (&event_log, &turn_id) {
                    log.append(SessionEvent::ToolCallResult {
                        tool_id: "react_action".to_string(),
                        step_id: SessionEvent::generate_id("step"),
                        success: result.success,
                        output: result.output.clone(),
                        error: result.error.clone(),
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                    });
                }

                // Update SOUL memory with successful tool execution
                if result.success {
                    let new_memory = format!(
                        "Successfully executed tool: {}. Result: {}",
                        action,
                        result.output.as_ref().unwrap_or(&"completed".to_string())
                    );
                    let _ = self.update_soul_memory(new_memory).await;

                    // If this was a complex task, crystallize it as a skill
                    if action.len() > 50 && result.success {
                        let skill = SkillEntry {
                            id: uuid::Uuid::new_v4().to_string(),
                            name: format!("Skill from turn {}", current_turn),
                            description: format!("Automatically crystallized from: {}", action),
                            created_at: chrono::Utc::now(),
                            usage_count: 1,
                            success_rate: 1.0,
                            origin_task: action.clone(),
                        };
                        let _ = self.add_skill_to_soul(skill).await;
                    }
                }

                if result.success {
                    // Record success and reset circuit breaker
                    let mut inner = self.inner.lock().unwrap();
                    inner.recovery_state.record_success();
                    result.output.unwrap_or("Execution completed".to_string())
                } else {
                    // Log error event
                    let error_msg = result
                        .error
                        .clone()
                        .unwrap_or("Tool execution failed".to_string());
                    if let (Some(log), Some(_tid)) = (&event_log, &turn_id) {
                        log.append(SessionEvent::Error {
                            error_id: SessionEvent::generate_id("error"),
                            context: "tool_execution".to_string(),
                            message: error_msg.clone(),
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        });
                    }

                    // Integrate recovery logic without holding a synchronous mutex across awaits.
                    let recovery_id = SessionEvent::generate_id("recovery");

                    // Log recovery start.
                    if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
                        log.append(SessionEvent::RecoveryStart {
                            recovery_id: recovery_id.clone(),
                            turn_id: tid.clone(),
                            context: "tool_execution".to_string(),
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        });
                    }

                    let (circuit_breaker_open, failure_triggered, retry) = {
                        let mut inner = self.inner.lock().unwrap();
                        if inner.recovery_state.is_circuit_breaker_open() {
                            (true, false, None)
                        } else if !inner.recovery_state.record_failure(error_msg.clone()) {
                            (false, true, None)
                        } else if inner.recovery_state.increment_retry() {
                            (
                                false,
                                false,
                                Some((
                                    inner.recovery_state.retry_count,
                                    inner.recovery_state.calculate_backoff_ms(),
                                )),
                            )
                        } else {
                            (false, false, None)
                        }
                    };

                    if circuit_breaker_open {
                        if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
                            log.append(SessionEvent::RecoveryEnd {
                                recovery_id,
                                turn_id: tid.clone(),
                                success: false,
                                timestamp: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                            });
                        }
                        return Err(ContractError::ParseError(
                            "Circuit breaker is open, tool execution blocked".to_string(),
                        ));
                    }

                    if failure_triggered {
                        if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
                            log.append(SessionEvent::RecoveryEnd {
                                recovery_id,
                                turn_id: tid.clone(),
                                success: false,
                                timestamp: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                            });
                        }
                        return Err(ContractError::ParseError(
                            "Circuit breaker triggered by consecutive failures".to_string(),
                        ));
                    }

                    if let Some((attempt_number, backoff_ms)) = retry {
                        if let (Some(log), Some(_tid)) = (&event_log, &turn_id) {
                            log.append(SessionEvent::RecoveryAttempt {
                                recovery_id: recovery_id.clone(),
                                attempt_number,
                                action: format!("retry_tool_execution: {}", action),
                                timestamp: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                            });
                        }

                        // Exponential backoff before the next attempt.
                        tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
                    }

                    if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
                        log.append(SessionEvent::RecoveryEnd {
                            recovery_id,
                            turn_id: tid.clone(),
                            success: false,
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        });
                    }

                    return Err(ContractError::ParseError(error_msg));
                }
            }
        } else {
            // Without a configured tool pipeline, the model output is the final assistant response.
            // Do not reinterpret arbitrary natural-language output as a shell/file action.
            action.clone()
        };

        // Log turn end event with latency and step count
        let turn_end_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let latency_ms = turn_end_time.saturating_sub(turn_start_time);

        if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
            log.append(SessionEvent::TurnEnd {
                turn_id: tid.clone(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                step_count: 2, // thought + action
                latency_ms,
            });
        }

        // Delegate to subagent if supervisor is configured
        if let Some(supervisor) = &supervisor {
            if let Some(subagent_name) = supervisor
                .decide_subagent(input, model_provider.as_ref())
                .await
            {
                let _ = subagent_name;
            }
        }

        // Execute code in sandbox if sandbox is configured and action is code execution
        if let Some(sandbox) = &sandbox {
            if action.starts_with("execute_code:") {
                let code = action.strip_prefix("execute_code:").unwrap_or("");
                let request = SandboxRequest {
                    request_id: format!("sandbox-{}", current_turn),
                    code: code.to_string(),
                    timeout_ms: 30000,
                    memory_limit_bytes: 1024 * 1024 * 100,
                    allowed_capabilities: vec!["process.execute".to_string()],
                };
                let _ = sandbox.execute(request).await;
            }
        }

        // Step 4: Complete the ReAct turn.
        //
        // When the model emitted a structured tool call, execute it and make one
        // bounded follow-up model call so the user receives a final answer rather
        // than the raw tool observation. Plain model responses are returned directly.
        let mut result = if is_structured_tool_action(&thought) && tool_pipeline.is_some() {
            self.observe(&observation)
        } else {
            observation.clone()
        };

        if is_structured_tool_action(&thought) && model_provider.is_some() {
            let max_followups = std::env::var("AGENTICOS_MAX_TOOL_FOLLOWUPS")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(1)
                .clamp(1, 4);
            let mut followup_prompt = format!(
                "Original user request:\n{}\n\nTool observation:\n{}\n\n",
                input, observation
            );
            let mut attempts = 0;
            while attempts < max_followups {
                attempts += 1;
                followup_prompt.push_str(
                    "Use the tool observation to produce the final user-facing answer. Return another tool JSON only when another tool call is strictly necessary.",
                );
                let followup = self
                    .think_inner(
                        model_provider.as_ref(),
                        current_turn.saturating_add(attempts),
                        &followup_prompt,
                        preferred_model.as_deref(),
                        parameters.as_deref(),
                    )
                    .await?;
                if is_structured_tool_action(&followup) {
                    if followup == thought {
                        result = followup;
                        break;
                    }
                    // Surface an additional tool request without executing it recursively.
                    result = followup;
                    if attempts < max_followups {
                        followup_prompt.push_str("\n\nThe previous response requested another tool call. Do not execute it; refine or return the final answer.");
                        continue;
                    }
                    break;
                }
                result = followup;
                break;
            }
        }

        // Persist the final user-facing answer separately from the model's tool-call thought.
        if let Some(memory) = &memory {
            if !result.trim().is_empty() && result != thought {
                let msg_id = format!("assistant-final-{}", uuid::Uuid::new_v4());
                memory
                    .store_message(&msg_id, &session_id, "assistant", &result)
                    .await
                    .map_err(|error| {
                        ContractError::ParseError(format!(
                            "failed to persist final assistant message: {error}"
                        ))
                    })?;
            }
        }

        // Create checkpoint if checkpoint store is available
        if let Some(store) = &checkpoint_store {
            let checkpoint = Checkpoint {
                checkpoint_id: generate_checkpoint_id(),
                thread_id: session_id.clone(),
                state: serde_json::json!({
                    "current_turn": current_turn,
                    "input": input,
                    "thought": thought,
                    "action": action,
                    "observation": observation,
                    "result": result,
                    "plan": plan
                }),
                metadata: serde_json::json!(CheckpointMetadata {
                    step: current_turn,
                    status: "completed".to_string(),
                    extra: serde_json::json!({})
                }),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
            };
            let event = SerializedEvent {
                event_type: "checkpoint".to_string(),
                data: serde_json::to_string(&checkpoint).map_err(|error| {
                    ContractError::ParseError(format!("failed to serialize checkpoint: {error}"))
                })?,
                schema_version: 1,
            };
            let stream_id = format!("agent-{}", session_id);
            store
                .append(&stream_id, current_turn as u64, vec![event])
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("failed to persist checkpoint: {error}"))
                })?;
        }

        Ok(result)
    }

    /// Load conversation context from SQLite memory.
    pub async fn load_context(&self) -> Result<String, ContractError> {
        let (memory, session_id) = {
            let inner = self.inner.lock().unwrap();
            (inner.memory.clone(), inner.session_id.clone())
        };

        if let Some(memory) = memory {
            let history = memory.get_session_history(&session_id, 20).await?;
            if history.is_empty() {
                Ok(String::new())
            } else {
                Ok(history
                    .iter()
                    .map(|msg| format!("{}: {}", msg.role, msg.content))
                    .collect::<Vec<_>>()
                    .join("\n"))
            }
        } else {
            Ok(String::new())
        }
    }

    /// Restore the durable turn count when rebuilding a session after restart.
    pub fn restore_turn_count(&self, turns: usize) {
        let mut inner = self.inner.lock().unwrap();
        inner.current_turn = turns;
    }

    /// Get current turn count.
    pub fn current_turn(&self) -> usize {
        self.inner.lock().unwrap().current_turn
    }

    /// Increment the current turn for callers that manage turns externally.
    pub fn increment_turn(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.current_turn = inner.current_turn.saturating_add(1);
    }

    /// Report whether the soft session turn budget has been reached.
    ///
    /// This is an observability signal only; long-lived sessions are not
    /// forcibly terminated by the counter.
    pub fn is_finished(&self) -> bool {
        self.current_turn() >= self.max_turns
    }
}

/// Skill with YAML frontmatter for procedural memory.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Skill {
    /// Skill name
    pub name: String,
    /// Skill description
    pub description: String,
    /// Skill version
    pub version: String,
    /// Skill author
    pub author: String,
    /// Supported platforms
    pub platforms: Vec<String>,
    /// Skill procedure content
    pub procedure: String,
    /// Skill pitfalls
    pub pitfalls: Vec<String>,
    /// Skill verification steps
    pub verification: Vec<String>,
}

impl Skill {
    /// Parse a skill from SKILL.md file with YAML frontmatter.
    pub fn from_markdown(content: &str) -> Result<Self, String> {
        // Check for YAML frontmatter (starts with ---)
        if !content.starts_with("---") {
            return Err("Missing YAML frontmatter".to_string());
        }

        // Split frontmatter and content
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() < 3 {
            return Err("Invalid YAML frontmatter format".to_string());
        }

        let yaml_frontmatter = parts[1];
        let markdown_content = parts[2];

        // Parse YAML frontmatter
        let metadata: serde_yaml::Value =
            serde_yaml::from_str(yaml_frontmatter).map_err(|e| e.to_string())?;

        // Extract metadata fields
        let name = metadata
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'name' in frontmatter")?
            .to_string();

        let description = metadata
            .get("description")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'description' in frontmatter")?
            .to_string();

        let version = metadata
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("1.0.0")
            .to_string();

        let author = metadata
            .get("author")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let platforms = metadata
            .get("platforms")
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Parse markdown content sections
        let procedure = Self::extract_section(markdown_content, "Procedure");
        let pitfalls = Self::extract_list_section(markdown_content, "Pitfalls");
        let verification = Self::extract_list_section(markdown_content, "Verification");

        Ok(Skill {
            name,
            description,
            version,
            author,
            platforms,
            procedure,
            pitfalls,
            verification,
        })
    }

    /// Extract a section from markdown content.
    fn extract_section(content: &str, section_name: &str) -> String {
        let section_header = format!("## {}", section_name);
        if let Some(start) = content.find(&section_header) {
            let start = start + section_header.len();
            let end = content[start..]
                .find("\n## ")
                .map(|pos| start + pos)
                .unwrap_or(content.len());
            content[start..end].trim().to_string()
        } else {
            String::new()
        }
    }

    /// Extract a list section from markdown content.
    fn extract_list_section(content: &str, section_name: &str) -> Vec<String> {
        let section = Self::extract_section(content, section_name);
        section
            .lines()
            .filter(|line| line.trim().starts_with('-'))
            .map(|line| {
                line.trim()
                    .strip_prefix('-')
                    .unwrap_or(line)
                    .trim()
                    .to_string()
            })
            .collect()
    }

    /// Get a concise description for progressive disclosure.
    pub fn summary(&self) -> String {
        format!("{} (v{}): {}", self.name, self.version, self.description)
    }
}

/// SQLite tier 2 memory for conversation history with FTS5.
#[allow(missing_debug_implementations)]
pub struct SqliteMemory {
    db: Arc<sqlx::SqlitePool>,
}

impl SqliteMemory {
    /// Create a new SQLite memory store.
    pub async fn new(database_url: &str) -> Result<Self, ContractError> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|e| {
                ContractError::ParseError(format!("Failed to connect to SQLite: {}", e))
            })?;

        // Create tables
        Self::initialize_schema(&pool).await?;

        Ok(Self { db: Arc::new(pool) })
    }

    /// Initialize database schema.
    async fn initialize_schema(pool: &sqlx::SqlitePool) -> Result<(), ContractError> {
        // Create conversations table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| {
            ContractError::ParseError(format!("Failed to create conversations table: {}", e))
        })?;

        // Create FTS5 virtual table for full-text search
        sqlx::query(
            r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
                id,
                session_id,
                role,
                content,
                timestamp
            )
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to create FTS5 table: {}", e)))?;

        // Create summaries table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS summaries (
                session_id TEXT PRIMARY KEY,
                summary TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| {
            ContractError::ParseError(format!("Failed to create summaries table: {}", e))
        })?;

        // Create checkpoints table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS checkpoints (
                checkpoint_id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                state TEXT NOT NULL,
                metadata TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| {
            ContractError::ParseError(format!("Failed to create checkpoints table: {}", e))
        })?;

        Ok(())
    }

    /// Store a conversation message.
    pub async fn store_message(
        &self,
        conversation_id: &str,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> Result<(), ContractError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut tx = self.db.begin().await.map_err(|e| {
            ContractError::ParseError(format!("Failed to begin memory transaction: {}", e))
        })?;

        sqlx::query(
            r#"
            INSERT INTO conversations (id, session_id, role, content, timestamp)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(conversation_id)
        .bind(session_id)
        .bind(role)
        .bind(content)
        .bind(timestamp as i64)
        .execute(&mut *tx)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to store message: {}", e)))?;

        sqlx::query(
            r#"
            INSERT INTO conversations_fts (id, session_id, role, content, timestamp)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(conversation_id)
        .bind(session_id)
        .bind(role)
        .bind(content)
        .bind(timestamp as i64)
        .execute(&mut *tx)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to insert into FTS5: {}", e)))?;

        tx.commit().await.map_err(|e| {
            ContractError::ParseError(format!("Failed to commit memory transaction: {}", e))
        })?;

        Ok(())
    }

    /// Search conversations using full-text search.
    pub async fn search_conversations(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<ConversationMessage>, ContractError> {
        let rows = sqlx::query_as::<_, ConversationMessage>(
            r#"
            SELECT id, session_id, role, content, timestamp
            FROM conversations_fts
            WHERE content MATCH ?
            ORDER BY timestamp DESC
            LIMIT ?
            "#,
        )
        .bind(query)
        .bind(limit as i64)
        .fetch_all(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to search conversations: {}", e)))?;

        Ok(rows)
    }

    /// Get conversation history for a session.
    pub async fn get_session_history(
        &self,
        session_id: &str,
        limit: usize,
    ) -> Result<Vec<ConversationMessage>, ContractError> {
        let mut rows = sqlx::query_as::<_, ConversationMessage>(
            r#"
            SELECT id, session_id, role, content, timestamp
            FROM conversations
            WHERE session_id = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
            "#,
        )
        .bind(session_id)
        .bind(limit as i64)
        .fetch_all(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to get session history: {}", e)))?;

        rows.reverse();
        Ok(rows)
    }

    /// Store a summary for a session.
    pub async fn store_summary(
        &self,
        session_id: &str,
        summary: &str,
    ) -> Result<(), ContractError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        sqlx::query(
            r#"
            INSERT INTO summaries (session_id, summary, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                summary = excluded.summary,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(session_id)
        .bind(summary)
        .bind(timestamp as i64)
        .execute(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to store summary: {}", e)))?;

        Ok(())
    }

    /// Get the summary for a session.
    pub async fn get_summary(&self, session_id: &str) -> Result<Option<String>, ContractError> {
        let row = sqlx::query_as::<_, (String,)>(
            r#"
            SELECT summary
            FROM summaries
            WHERE session_id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to get summary: {}", e)))?;

        Ok(row.map(|(summary,)| summary))
    }

    /// Store a checkpoint.
    pub async fn store_checkpoint(&self, checkpoint: &Checkpoint) -> Result<(), ContractError> {
        let state_json = serde_json::to_string(&checkpoint.state)
            .map_err(|e| ContractError::ParseError(format!("Failed to serialize state: {}", e)))?;
        let metadata_json = serde_json::to_string(&checkpoint.metadata).map_err(|e| {
            ContractError::ParseError(format!("Failed to serialize metadata: {}", e))
        })?;

        sqlx::query(
            r#"
            INSERT INTO checkpoints (checkpoint_id, thread_id, state, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&checkpoint.checkpoint_id)
        .bind(&checkpoint.thread_id)
        .bind(&state_json)
        .bind(&metadata_json)
        .bind(checkpoint.timestamp)
        .execute(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to store checkpoint: {}", e)))?;

        Ok(())
    }

    /// Get a checkpoint by ID.
    pub async fn get_checkpoint(
        &self,
        checkpoint_id: &str,
    ) -> Result<Option<Checkpoint>, ContractError> {
        let row = sqlx::query_as::<_, (String, String, String, String, i64)>(
            r#"
            SELECT checkpoint_id, thread_id, state, metadata, timestamp
            FROM checkpoints
            WHERE checkpoint_id = ?
            "#,
        )
        .bind(checkpoint_id)
        .fetch_optional(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to get checkpoint: {}", e)))?;

        if let Some((checkpoint_id, thread_id, state, metadata, timestamp)) = row {
            let state_value = serde_json::from_str(&state).map_err(|e| {
                ContractError::ParseError(format!("Failed to deserialize state: {}", e))
            })?;
            let metadata_value = serde_json::from_str(&metadata).map_err(|e| {
                ContractError::ParseError(format!("Failed to deserialize metadata: {}", e))
            })?;

            Ok(Some(Checkpoint {
                checkpoint_id,
                thread_id,
                state: state_value,
                metadata: metadata_value,
                timestamp,
            }))
        } else {
            Ok(None)
        }
    }

    /// Get all checkpoints for a thread.
    pub async fn get_thread_checkpoints(
        &self,
        thread_id: &str,
    ) -> Result<Vec<Checkpoint>, ContractError> {
        let rows = sqlx::query_as::<_, (String, String, String, String, i64)>(
            r#"
            SELECT checkpoint_id, thread_id, state, metadata, timestamp
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY timestamp ASC
            "#,
        )
        .bind(thread_id)
        .fetch_all(&*self.db)
        .await
        .map_err(|e| {
            ContractError::ParseError(format!("Failed to get thread checkpoints: {}", e))
        })?;

        let mut checkpoints = Vec::new();
        for (checkpoint_id, thread_id, state, metadata, timestamp) in rows {
            let state_value = serde_json::from_str(&state).map_err(|e| {
                ContractError::ParseError(format!("Failed to deserialize state: {}", e))
            })?;
            let metadata_value = serde_json::from_str(&metadata).map_err(|e| {
                ContractError::ParseError(format!("Failed to deserialize metadata: {}", e))
            })?;

            checkpoints.push(Checkpoint {
                checkpoint_id,
                thread_id,
                state: state_value,
                metadata: metadata_value,
                timestamp,
            });
        }

        Ok(checkpoints)
    }
}

/// Conversation message stored in SQLite.
#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct ConversationMessage {
    /// Message ID
    pub id: String,
    /// Session ID
    pub session_id: String,
    /// Role (user/assistant/system)
    pub role: String,
    /// Message content
    pub content: String,
    /// Timestamp
    pub timestamp: i64,
}

/// Tool execution result.
#[derive(Debug, Clone)]
pub struct ToolResult {
    /// Success status
    pub success: bool,
    /// Result output
    pub output: String,
    /// Error message if any
    pub error: Option<String>,
}

impl ToolResult {
    /// Create a successful tool result.
    pub fn success(output: String) -> Self {
        Self {
            success: true,
            output,
            error: None,
        }
    }

    /// Create a failed tool result.
    pub fn failure(error: String) -> Self {
        Self {
            success: false,
            output: String::new(),
            error: Some(error),
        }
    }
}

/// Tool executor for real tool execution.
#[allow(missing_debug_implementations)]
#[derive(Clone)]
pub struct ToolExecutor {
    /// Working directory for tool execution
    workdir: PathBuf,
}

impl ToolExecutor {
    /// Create a new tool executor.
    pub fn new(workdir: PathBuf) -> Self {
        Self { workdir }
    }

    fn safe_path(&self, path: &str) -> Result<PathBuf, String> {
        let relative = std::path::Path::new(path);
        if relative.is_absolute() || path.split(['/', '\\']).any(|segment| segment == "..") {
            return Err(format!("path '{}' escapes the workspace", path));
        }

        let root = std::fs::canonicalize(&self.workdir)
            .map_err(|error| format!("workspace is unavailable: {error}"))?;
        let candidate = self.workdir.join(relative);

        if candidate.exists() {
            let canonical = std::fs::canonicalize(&candidate)
                .map_err(|error| format!("path '{}' cannot be resolved: {error}", path))?;
            if !canonical.starts_with(&root) {
                return Err(format!("path '{}' escapes the workspace", path));
            }
            Ok(canonical)
        } else {
            let parent = candidate
                .parent()
                .unwrap_or_else(|| std::path::Path::new(&self.workdir));
            let canonical_parent = std::fs::canonicalize(parent).map_err(|error| {
                format!(
                    "parent directory for '{}' cannot be resolved: {error}",
                    path
                )
            })?;
            if !canonical_parent.starts_with(&root) {
                return Err(format!("path '{}' escapes the workspace", path));
            }
            Ok(candidate)
        }
    }

    /// Execute a file read operation.
    pub fn read_file(&self, path: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => ToolResult::success(content),
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Execute a file write operation.
    pub fn write_file(&self, path: &str, content: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::write(&full_path, content) {
            Ok(_) => ToolResult::success(format!("File written: {}", path)),
            Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
        }
    }

    /// Edit a specific line in a file.
    pub fn edit_line(&self, path: &str, line_number: usize, new_content: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let mut lines: Vec<&str> = content.lines().collect();
                if line_number > 0 && line_number <= lines.len() {
                    lines[line_number - 1] = new_content;
                    let new_content = lines.join("\n");
                    match std::fs::write(&full_path, new_content) {
                        Ok(_) => {
                            ToolResult::success(format!("Line {} edited in {}", line_number, path))
                        }
                        Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
                    }
                } else {
                    ToolResult::failure(format!("Invalid line number: {}", line_number))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Insert a line at a specific position in a file.
    pub fn insert_line(&self, path: &str, line_number: usize, new_content: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let mut lines: Vec<&str> = content.lines().collect();
                if line_number > 0 && line_number <= lines.len() + 1 {
                    lines.insert(line_number - 1, new_content);
                    let new_content = lines.join("\n");
                    match std::fs::write(&full_path, new_content) {
                        Ok(_) => ToolResult::success(format!(
                            "Line inserted at {} in {}",
                            line_number, path
                        )),
                        Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
                    }
                } else {
                    ToolResult::failure(format!("Invalid line number: {}", line_number))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Delete a specific line from a file.
    pub fn delete_line(&self, path: &str, line_number: usize) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let mut lines: Vec<&str> = content.lines().collect();
                if line_number > 0 && line_number <= lines.len() {
                    lines.remove(line_number - 1);
                    let new_content = lines.join("\n");
                    match std::fs::write(&full_path, new_content) {
                        Ok(_) => ToolResult::success(format!(
                            "Line {} deleted from {}",
                            line_number, path
                        )),
                        Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
                    }
                } else {
                    ToolResult::failure(format!("Invalid line number: {}", line_number))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Find and replace text in a file.
    pub fn find_and_replace(&self, path: &str, find: &str, replace: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let new_content = content.replace(find, replace);
                match std::fs::write(&full_path, new_content) {
                    Ok(_) => ToolResult::success(format!(
                        "Replaced '{}' with '{}' in {}",
                        find, replace, path
                    )),
                    Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Check if a file exists.
    pub fn file_exists(&self, path: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        if full_path.exists() {
            ToolResult::success(format!("File exists: {}", path))
        } else {
            ToolResult::failure(format!("File does not exist: {}", path))
        }
    }

    /// Execute a git status operation.
    pub fn git_status(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("status")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    ToolResult::success(stdout)
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    ToolResult::failure(format!("Git status failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git add operation.
    pub fn git_add(&self, path: &str) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("add")
            .arg(path)
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    ToolResult::success(format!("Added: {}", path))
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    ToolResult::failure(format!("Git add failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git commit operation.
    pub fn git_commit(&self, message: &str) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("commit")
            .arg("-m")
            .arg(message)
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    ToolResult::success(stdout)
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    ToolResult::failure(format!("Git commit failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git push operation.
    pub fn git_push(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("push")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    ToolResult::success(stdout)
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    ToolResult::failure(format!("Git push failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git diff operation.
    pub fn git_diff(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("diff")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                ToolResult::success(stdout)
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git log operation.
    pub fn git_log(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("log")
            .arg("--oneline")
            .arg("-10")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                ToolResult::success(stdout)
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git branch operation.
    pub fn git_branch(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("branch")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                ToolResult::success(stdout)
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a shell command (with safety restrictions).
    pub fn execute_command(&self, command: &str) -> ToolResult {
        // Basic safety check: only allow specific commands
        let allowed_commands = vec!["ls", "dir", "pwd", "echo", "cat", "grep"];
        let first_word = command.split_whitespace().next().unwrap_or("");

        if !allowed_commands.contains(&first_word) {
            return ToolResult::failure(format!(
                "Command '{}' not allowed. Allowed commands: {:?}",
                first_word, allowed_commands
            ));
        }

        let args: Vec<&str> = command.split_whitespace().collect();
        if args.is_empty() {
            return ToolResult::failure("Command must not be empty".to_string());
        }

        let output = std::process::Command::new(args[0])
            .args(&args[1..])
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                if output.status.success() {
                    ToolResult::success(stdout)
                } else {
                    ToolResult::failure(format!("Command failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute command: {}", e)),
        }
    }
}

/// Conversation summarization configuration.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SummarizationConfig {
    /// Maximum tokens before summarization kicks in.
    pub max_tokens_before_summary: usize,
    /// Maximum tokens for the resulting message list after summarization.
    pub max_tokens: usize,
    /// Maximum tokens for the summary itself.
    pub max_summary_tokens: usize,
}

impl Default for SummarizationConfig {
    fn default() -> Self {
        Self {
            max_tokens_before_summary: 2048,
            max_tokens: 4096,
            max_summary_tokens: 256,
        }
    }
}

/// Result of summarization.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SummarizationResult {
    /// The messages after summarization (summary + remaining messages).
    pub messages: Vec<String>,
    /// The running summary (if any).
    pub running_summary: Option<String>,
    /// Whether summarization was performed.
    pub was_summarized: bool,
}

/// Simple token counter (approximate character-based).
pub fn count_tokens_approximate(text: &str) -> usize {
    // Rough approximation: ~4 characters per token
    text.len().div_ceil(4)
}

/// Count tokens in a list of messages.
pub fn count_tokens_in_messages(messages: &[String]) -> usize {
    messages.iter().map(|m| count_tokens_approximate(m)).sum()
}

/// Summarize messages when they exceed a token limit.
/// This follows LangChain's summarization pattern:
/// - Keep recent messages below max_tokens
/// - Summarize older messages into a running summary
/// - Avoid re-summarizing the same messages
pub fn summarize_messages(
    messages: &[String],
    running_summary: Option<String>,
    config: &SummarizationConfig,
) -> SummarizationResult {
    let total_tokens = count_tokens_in_messages(messages);

    // If messages fit within max_tokens, return as-is
    if total_tokens <= config.max_tokens {
        return SummarizationResult {
            messages: messages.to_vec(),
            running_summary,
            was_summarized: false,
        };
    }

    // Messages exceed limit, need to summarize
    // Strategy: Keep last N messages + summary of older messages
    let mut remaining_tokens = config.max_tokens - config.max_summary_tokens;
    let mut result_messages = Vec::new();
    let mut messages_to_summarize = Vec::new();

    // Process messages from newest to oldest
    for msg in messages.iter().rev() {
        let msg_tokens = count_tokens_approximate(msg);

        if remaining_tokens >= msg_tokens {
            // Keep this message
            result_messages.insert(0, msg.clone());
            remaining_tokens -= msg_tokens;
        } else {
            // This message goes to summarization
            messages_to_summarize.insert(0, msg.clone());
        }
    }

    // If there are messages to summarize, create a summary
    let new_summary = if !messages_to_summarize.is_empty() {
        let base_summary = running_summary.unwrap_or_else(|| "Conversation summary:".to_string());
        let combined = format!(
            "{}\n\nAdditional context:\n{}",
            base_summary,
            messages_to_summarize.join("\n")
        );

        // Truncate to max_summary_tokens
        let max_chars = config.max_summary_tokens * 4;
        if combined.len() > max_chars {
            format!("{}...", &combined[..max_chars])
        } else {
            combined
        }
    } else {
        running_summary.unwrap_or_default()
    };

    // Add summary to result if it exists
    if !new_summary.is_empty() {
        result_messages.insert(0, format!("Summary: {}", new_summary));
    }

    SummarizationResult {
        messages: result_messages,
        running_summary: Some(new_summary),
        was_summarized: true,
    }
}

/// Checkpoint for agent state persistence (LangGraph pattern).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Checkpoint {
    /// Unique checkpoint ID
    pub checkpoint_id: String,
    /// Thread ID for organizing checkpoints
    pub thread_id: String,
    /// Agent state snapshot
    pub state: serde_json::Value,
    /// Checkpoint metadata
    pub metadata: serde_json::Value,
    /// Timestamp
    pub timestamp: i64,
}

/// Checkpoint metadata.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CheckpointMetadata {
    /// Step number
    pub step: usize,
    /// Status
    pub status: String,
    /// Additional metadata
    pub extra: serde_json::Value,
}

impl Default for CheckpointMetadata {
    fn default() -> Self {
        Self {
            step: 0,
            status: "active".to_string(),
            extra: serde_json::json!({}),
        }
    }
}

/// Checkpoint ID generator.
pub fn generate_checkpoint_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Thread ID generator.
pub fn generate_thread_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Planning system for task decomposition (LangChain Plan-and-Execute pattern).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Plan {
    /// Plan ID
    pub plan_id: String,
    /// Objective/goal of the plan
    pub objective: String,
    /// Steps in the plan
    pub steps: Vec<PlanStep>,
    /// Current step index
    pub current_step: usize,
    /// Plan status
    pub status: PlanStatus,
    /// Created timestamp
    pub created_at: i64,
}

impl Plan {
    /// Check if the plan is complete (all steps completed or plan status is completed/failed).
    pub fn is_complete(&self) -> bool {
        matches!(self.status, PlanStatus::Completed | PlanStatus::Failed)
            || self.steps.iter().all(|s| {
                matches!(
                    s.status,
                    StepStatus::Completed | StepStatus::Failed | StepStatus::Skipped
                )
            })
    }
}

/// Plan status.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum PlanStatus {
    /// Plan is pending execution
    Pending,
    /// Plan is in progress
    InProgress,
    /// Plan is completed
    Completed,
    /// Plan failed
    Failed,
    /// Plan needs re-planning
    NeedsReplanning,
}

/// Individual step in a plan.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlanStep {
    /// Step ID
    pub step_id: String,
    /// Step description
    pub description: String,
    /// Tool to use for this step
    pub tool: Option<String>,
    /// Tool arguments
    pub tool_args: Option<serde_json::Value>,
    /// Step status
    pub status: StepStatus,
    /// Step result
    pub result: Option<String>,
}

/// Step status.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum StepStatus {
    /// Step is pending
    Pending,
    /// Step is in progress
    InProgress,
    /// Step is completed
    Completed,
    /// Step failed
    Failed,
    /// Step skipped
    Skipped,
}

/// Planner for generating plans.
#[allow(missing_debug_implementations)]
#[derive(Clone)]
pub struct Planner {
    /// Planner configuration
    _config: (),
}

impl Planner {
    /// Create a new planner.
    pub fn new() -> Self {
        Self { _config: () }
    }

    /// Generate a plan for a given objective.
    /// Uses LLM for intelligent plan generation when provider is available.
    pub async fn generate_plan(
        &self,
        objective: &str,
        model_provider: Option<&Arc<dyn agenticos_contracts::ModelProvider>>,
    ) -> Plan {
        let plan_id = uuid::Uuid::new_v4().to_string();
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Try to use LLM for plan decomposition if provider is available
        if let Some(provider) = model_provider {
            let prompt = format!(
                "You are a task planning AI. Decompose the following objective into concrete steps. \
                 Return your response as a JSON array of steps, where each step has: \
                 {{\"description\": \"step description\", \"tool\": \"tool name or null\", \"tool_args\": {{}} or null}}. \
                 Objective: {}",
                objective
            );

            let request = agenticos_contracts::ModelRequest {
                request_id: uuid::Uuid::new_v4().to_string(),
                model: "default".to_string(),
                input: prompt,
                parameters: None,
            };

            match provider.execute(request).await {
                Ok(response) => {
                    // Try to parse LLM response as JSON array of steps
                    if let Ok(steps_json) =
                        serde_json::from_str::<serde_json::Value>(&response.output)
                    {
                        if let Some(steps_array) = steps_json.as_array() {
                            let steps: Vec<PlanStep> = steps_array
                                .iter()
                                .filter_map(|step| {
                                    let description = step
                                        .get("description")
                                        .and_then(|d| d.as_str())
                                        .unwrap_or("Unknown step")
                                        .to_string();
                                    let tool = step
                                        .get("tool")
                                        .and_then(|t| t.as_str())
                                        .map(|s| s.to_string());
                                    let tool_args = step.get("tool_args").cloned();
                                    Some(PlanStep {
                                        step_id: uuid::Uuid::new_v4().to_string(),
                                        description,
                                        tool,
                                        tool_args,
                                        status: StepStatus::Pending,
                                        result: None,
                                    })
                                })
                                .collect();

                            if !steps.is_empty() {
                                return Plan {
                                    plan_id,
                                    objective: objective.to_string(),
                                    steps,
                                    current_step: 0,
                                    status: PlanStatus::Pending,
                                    created_at,
                                };
                            }
                        }
                    }
                    // Fallback if parsing fails
                }
                Err(_) => {
                    // Fallback on error
                }
            }
        }

        // Fallback: create a simple plan with one step
        let step = PlanStep {
            step_id: uuid::Uuid::new_v4().to_string(),
            description: format!("Execute: {}", objective),
            tool: None,
            tool_args: None,
            status: StepStatus::Pending,
            result: None,
        };

        Plan {
            plan_id,
            objective: objective.to_string(),
            steps: vec![step],
            current_step: 0,
            status: PlanStatus::Pending,
            created_at,
        }
    }

    /// Re-plan based on current state and results.
    /// Uses LLM for intelligent re-planning when provider is available.
    pub async fn replan(
        &self,
        plan: &Plan,
        results: &[String],
        model_provider: Option<&Arc<dyn agenticos_contracts::ModelProvider>>,
    ) -> Plan {
        // Try to use LLM for re-planning if provider is available
        if let Some(provider) = model_provider {
            let current_state = plan
                .steps
                .iter()
                .map(|s| format!("{}: {:?}", s.description, s.status))
                .collect::<Vec<_>>()
                .join("\n");

            let results_str = results.join("\n");

            let prompt = format!(
                "You are a task planning AI. The following plan has been partially executed. \
                 Current state:\n{}\n\nResults:\n{}\n\nObjective: {}\n\n \
                 Adjust the plan by adding new steps, modifying existing steps, or marking steps as complete. \
                 Return your response as a JSON array of steps, where each step has: \
                 {{\"description\": \"step description\", \"tool\": \"tool name or null\", \"tool_args\": {{}} or null, \"status\": \"Pending\"|\"Completed\"|\"Failed\"}}.",
                current_state, results_str, plan.objective
            );

            let request = agenticos_contracts::ModelRequest {
                request_id: uuid::Uuid::new_v4().to_string(),
                model: "default".to_string(),
                input: prompt,
                parameters: None,
            };

            match provider.execute(request).await {
                Ok(response) => {
                    // Try to parse LLM response as JSON array of steps
                    if let Ok(steps_json) =
                        serde_json::from_str::<serde_json::Value>(&response.output)
                    {
                        if let Some(steps_array) = steps_json.as_array() {
                            let steps: Vec<PlanStep> = steps_array
                                .iter()
                                .filter_map(|step| {
                                    let description = step
                                        .get("description")
                                        .and_then(|d| d.as_str())
                                        .unwrap_or("Unknown step")
                                        .to_string();
                                    let tool = step
                                        .get("tool")
                                        .and_then(|t| t.as_str())
                                        .map(|s| s.to_string());
                                    let tool_args = step.get("tool_args").cloned();
                                    let status_str = step
                                        .get("status")
                                        .and_then(|s| s.as_str())
                                        .unwrap_or("Pending");
                                    let status = match status_str {
                                        "Completed" => StepStatus::Completed,
                                        "Failed" => StepStatus::Failed,
                                        _ => StepStatus::Pending,
                                    };
                                    Some(PlanStep {
                                        step_id: uuid::Uuid::new_v4().to_string(),
                                        description,
                                        tool,
                                        tool_args,
                                        status,
                                        result: None,
                                    })
                                })
                                .collect();

                            if !steps.is_empty() {
                                let mut new_plan = plan.clone();
                                new_plan.steps = steps;
                                new_plan.status = PlanStatus::NeedsReplanning;
                                return new_plan;
                            }
                        }
                    }
                    // Fallback if parsing fails
                }
                Err(_) => {
                    // Fallback on error
                }
            }
        }

        // Fallback: return the same plan with NeedsReplanning status
        let mut new_plan = plan.clone();
        new_plan.status = PlanStatus::NeedsReplanning;
        new_plan
    }
}

impl Default for Planner {
    fn default() -> Self {
        Self::new()
    }
}

/// Tool registry for tool management (ToolRegistry pattern).
#[derive(Debug, Clone)]
pub struct ToolRegistry {
    /// Registered tools
    tools: std::collections::HashMap<String, ToolDefinition>,
}

/// Tool definition for tool schema.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolDefinition {
    /// Tool name
    pub name: String,
    /// Tool description
    pub description: String,
    /// Tool parameters schema (JSON Schema)
    pub parameters: serde_json::Value,
    /// Tool metadata
    pub metadata: serde_json::Value,
}

impl ToolRegistry {
    /// Create a new tool registry.
    pub fn new() -> Self {
        Self {
            tools: std::collections::HashMap::new(),
        }
    }

    /// Register a tool.
    pub fn register_tool(&mut self, tool: ToolDefinition) {
        self.tools.insert(tool.name.clone(), tool);
    }

    /// Get a tool by name.
    pub fn get_tool(&self, name: &str) -> Option<&ToolDefinition> {
        self.tools.get(name)
    }

    /// List all registered tools.
    pub fn list_tools(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }

    /// Get all tools.
    pub fn get_all_tools(&self) -> Vec<ToolDefinition> {
        self.tools.values().cloned().collect()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Subagent for specialized agent tasks (LangChain multi-agent pattern).
#[derive(Debug, Clone)]
pub struct Subagent {
    /// Subagent name
    pub name: String,
    /// Subagent description
    pub description: String,
    /// Subagent role/specialization
    pub role: String,
    /// Subagent tools
    pub tools: Vec<String>,
}

/// Supervisor for coordinating subagents (LangGraph supervisor pattern).
#[derive(Clone)]
pub struct Supervisor {
    /// Registered subagents
    subagents: std::collections::HashMap<String, Subagent>,
}

impl Supervisor {
    /// Create a new supervisor.
    pub fn new() -> Self {
        Self {
            subagents: std::collections::HashMap::new(),
        }
    }

    /// Register a subagent.
    pub fn register_subagent(&mut self, subagent: Subagent) {
        self.subagents.insert(subagent.name.clone(), subagent);
    }

    /// Get a subagent by name.
    pub fn get_subagent(&self, name: &str) -> Option<&Subagent> {
        self.subagents.get(name)
    }

    /// List all subagents.
    pub fn list_subagents(&self) -> Vec<String> {
        self.subagents.keys().cloned().collect()
    }

    /// Decide which subagent to invoke for a task.
    /// Uses LLM for intelligent subagent selection when provider is available.
    pub async fn decide_subagent(
        &self,
        task: &str,
        model_provider: Option<&Arc<dyn agenticos_contracts::ModelProvider>>,
    ) -> Option<String> {
        // Try to use LLM for subagent selection if provider is available
        if let Some(provider) = model_provider {
            let subagents_list = self.list_subagents();
            if subagents_list.is_empty() {
                return None;
            }

            let subagents_info = subagents_list
                .iter()
                .map(|name| {
                    if let Some(subagent) = self.get_subagent(name) {
                        format!(
                            "{}: {} (tools: {})",
                            subagent.name,
                            subagent.description,
                            subagent.tools.join(", ")
                        )
                    } else {
                        name.clone()
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");

            let prompt = format!(
                "You are a task coordination AI. Given the following task and available subagents, \
                 select the most appropriate subagent to handle this task. \
                 Available subagents:\n{}\n\nTask: {}\n\n \
                 Return only the name of the selected subagent as a JSON string.",
                subagents_info, task
            );

            let request = agenticos_contracts::ModelRequest {
                request_id: uuid::Uuid::new_v4().to_string(),
                model: "default".to_string(),
                input: prompt,
                parameters: None,
            };

            match provider.execute(request).await {
                Ok(response) => {
                    // Try to parse LLM response as JSON string
                    if let Ok(subagent_name) = serde_json::from_str::<String>(&response.output) {
                        if self.subagents.contains_key(&subagent_name) {
                            return Some(subagent_name);
                        }
                    }
                    // Fallback if parsing fails or subagent not found
                }
                Err(_) => {
                    // Fallback on error
                }
            }
        }

        // Fallback: return None (no decision logic implemented)
        None
    }
}

impl Default for Supervisor {
    fn default() -> Self {
        Self::new()
    }
}
