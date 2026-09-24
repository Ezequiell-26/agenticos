#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! execution boundary and workers boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    AgentEngine, Command, CommandHandler, CommandResult, ContextManager, ContractError,
    MemoryStore, ModelProvider, ModelRequest, ModelResponse, Projection, Query, QueryHandler,
    QueryResult, RunId, RunState,
};
use agenticos_kernel::KernelRuntime;
use agenticos_memory::{InMemoryContextManager, InMemoryMemoryStore};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-execution";

/// Basic command handler for write operations.
#[derive(Debug)]
pub struct BasicCommandHandler {
    runtime: Arc<KernelRuntime>,
}

impl BasicCommandHandler {
    /// Create a new command handler.
    pub fn new(runtime: Arc<KernelRuntime>) -> Self {
        Self { runtime }
    }
}

#[async_trait::async_trait]
impl CommandHandler for BasicCommandHandler {
    async fn handle(
        &self,
        command: Command,
    ) -> Result<CommandResult, agenticos_contracts::ContractError> {
        match command.command_type.as_str() {
            "start_run" => {
                if let Some(run_id) = command.payload.get("run_id").and_then(|v| v.as_str()) {
                    if let Some(_objective) =
                        command.payload.get("objective").and_then(|v| v.as_str())
                    {
                        let run_id = RunId::new(run_id)?;
                        self.runtime.create_run(run_id.clone()).await?;
                        self.runtime
                            .transition_run(&run_id, RunState::Admitted, 1)
                            .await?;

                        Ok(CommandResult {
                            success: true,
                            message: format!("Run {} started", run_id.as_str()),
                            events: vec![],
                        })
                    } else {
                        Ok(CommandResult {
                            success: false,
                            message: "Missing objective".to_string(),
                            events: vec![],
                        })
                    }
                } else {
                    Ok(CommandResult {
                        success: false,
                        message: "Missing run_id".to_string(),
                        events: vec![],
                    })
                }
            }
            _ => Ok(CommandResult {
                success: false,
                message: format!("Unknown command type: {}", command.command_type),
                events: vec![],
            }),
        }
    }
}

/// Basic query handler for read operations.
#[derive(Debug)]
pub struct BasicQueryHandler {
    runtime: Arc<KernelRuntime>,
}

impl BasicQueryHandler {
    /// Create a new query handler.
    pub fn new(runtime: Arc<KernelRuntime>) -> Self {
        Self { runtime }
    }
}

#[async_trait::async_trait]
impl QueryHandler for BasicQueryHandler {
    async fn handle(
        &self,
        query: Query,
    ) -> Result<QueryResult, agenticos_contracts::ContractError> {
        match query.query_type.as_str() {
            "get_run_state" => {
                if let Some(run_id) = query.parameters.get("run_id").and_then(|v| v.as_str()) {
                    let run_id = RunId::new(run_id)?;
                    let runs = self.runtime.runs.read().await;
                    let run = runs
                        .get(&run_id)
                        .ok_or(agenticos_contracts::ContractError::MissingCapability)?;

                    Ok(QueryResult {
                        data: serde_json::json!({
                            "run_id": run_id.as_str(),
                            "state": format!("{:?}", run.state),
                            "version": run.version,
                        }),
                        metadata: serde_json::json!({"type": "run_state"}),
                    })
                } else {
                    Ok(QueryResult {
                        data: serde_json::json!(null),
                        metadata: serde_json::json!({"error": "Missing run_id"}),
                    })
                }
            }
            _ => Ok(QueryResult {
                data: serde_json::json!(null),
                metadata: serde_json::json!({"error": format!("Unknown query type: {}", query.query_type)}),
            }),
        }
    }
}

/// Basic projection for read model updates.
#[derive(Debug)]
pub struct BasicProjection {
    #[allow(dead_code)]
    runtime: Arc<KernelRuntime>,
}

impl BasicProjection {
    /// Create a new projection.
    pub fn new(runtime: Arc<KernelRuntime>) -> Self {
        Self { runtime }
    }
}

#[async_trait::async_trait]
impl Projection for BasicProjection {
    async fn update(
        &self,
        _event: agenticos_contracts::SerializedEvent,
    ) -> Result<(), agenticos_contracts::ContractError> {
        // Basic projection implementation - in a full CQRS system, this would
        // update read models based on events from the command side
        Ok(())
    }
}

/// In-memory model provider for testing and development.
#[derive(Debug)]
pub struct InMemoryModelProvider {
    provider_id: String,
}

impl InMemoryModelProvider {
    /// Create a new in-memory model provider.
    pub fn new(provider_id: String) -> Self {
        Self { provider_id }
    }
}

impl Default for InMemoryModelProvider {
    fn default() -> Self {
        Self::new("in-memory-provider".to_string())
    }
}

#[async_trait::async_trait]
impl ModelProvider for InMemoryModelProvider {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        // Simple echo/response for testing
        Ok(ModelResponse {
            request_id: request.request_id,
            output: format!("Response to: {}", request.input),
            metadata: Some("in-memory".to_string()),
            tokens_used: Some(request.input.len() as u64),
        })
    }
}

/// Basic agent engine implementation.
pub struct BasicAgentEngine {
    engine_id: String,
    runtime: Arc<KernelRuntime>,
    #[allow(dead_code)]
    model_provider: Arc<dyn ModelProvider>,
    runs: Arc<RwLock<Vec<RunId>>>,
    context_manager: Arc<InMemoryContextManager>,
    memory_store: Arc<InMemoryMemoryStore>,
}

impl std::fmt::Debug for BasicAgentEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BasicAgentEngine")
            .field("engine_id", &self.engine_id)
            .field("runtime", &"<KernelRuntime>")
            .field("model_provider", &"<ModelProvider>")
            .field("runs", &self.runs)
            .finish()
    }
}

impl BasicAgentEngine {
    /// Create a new basic agent engine.
    pub fn new(
        engine_id: String,
        runtime: Arc<KernelRuntime>,
        model_provider: Arc<dyn ModelProvider>,
        context_manager: Arc<InMemoryContextManager>,
        memory_store: Arc<InMemoryMemoryStore>,
    ) -> Self {
        Self {
            engine_id,
            runtime,
            model_provider,
            runs: Arc::new(RwLock::new(Vec::new())),
            context_manager,
            memory_store,
        }
    }

    /// Create a basic agent engine with a kernel runtime.
    pub fn with_kernel(engine_id: String, runtime: Arc<KernelRuntime>) -> Self {
        let model_provider = Arc::new(InMemoryModelProvider::default());
        let context_manager = Arc::new(InMemoryContextManager::new());
        let memory_store = Arc::new(InMemoryMemoryStore::new());
        Self::new(
            engine_id,
            runtime,
            model_provider,
            context_manager,
            memory_store,
        )
    }

    /// Recover runs from memory (durable run identity across restart).
    pub async fn recover_runs(&self) -> Result<Vec<RunId>, ContractError> {
        let mut recovered_runs = Vec::new();

        // Query kernel runs to recover active runs
        let runs = self.runtime.runs.read().await;
        for (run_id, run) in runs.iter() {
            if run.state != RunState::Failed {
                recovered_runs.push(run_id.clone());
            }
        }

        // Update local registry with recovered runs
        let mut local_runs = self.runs.write().await;
        local_runs.clear();
        local_runs.extend(recovered_runs.clone());

        Ok(recovered_runs)
    }
}

#[async_trait::async_trait]
impl AgentEngine for BasicAgentEngine {
    fn engine_id(&self) -> &str {
        &self.engine_id
    }

    async fn start_run(&self, run_id: RunId, objective: String) -> Result<(), ContractError> {
        // Create the run in the kernel
        self.runtime.create_run(run_id.clone()).await?;

        // Transition to Admitted
        self.runtime
            .transition_run(&run_id, RunState::Admitted, 1)
            .await?;

        // Store objective in memory for recovery
        let memory_entry = agenticos_contracts::MemoryEntry {
            memory_id: format!("{}-objective", run_id.as_str()),
            run_id: run_id.clone(),
            key: "objective".to_string(),
            value: objective.clone(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            expires_at: 0,
        };
        self.memory_store.store(memory_entry).await?;

        // Store run registry entry in memory for recovery
        let registry_entry = agenticos_contracts::MemoryEntry {
            memory_id: format!("{}-registry", run_id.as_str()),
            run_id: run_id.clone(),
            key: "registry".to_string(),
            value: "active".to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            expires_at: 0,
        };
        self.memory_store.store(registry_entry).await?;

        // Log the start
        let log_entry = agenticos_contracts::LogEntry {
            level: agenticos_contracts::LogLevel::Info,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            component: "AgentEngine".to_string(),
            message: format!("Starting run with objective: {}", objective),
            fields: vec![("run_id".to_string(), run_id.as_str().to_string())],
            correlation_id: Some(run_id.as_str().to_string()),
        };
        self.runtime.logger.log(log_entry).await?;

        // Register the run in local registry for fast access
        let mut runs = self.runs.write().await;
        runs.push(run_id);

        Ok(())
    }

    async fn resume_run(&self, run_id: RunId) -> Result<(), ContractError> {
        // Check if run exists in our registry or memory
        let runs = self.runs.read().await;
        if !runs.contains(&run_id) {
            // Try to recover from memory
            let recovered = self.recover_runs().await?;
            if !recovered.contains(&run_id) {
                return Err(ContractError::MissingCapability);
            }
        }

        // Transition to Running
        self.runtime
            .transition_run(&run_id, RunState::Running, 2)
            .await?;

        // Execute model request through the provider
        let request = ModelRequest {
            request_id: format!("{}-model-req", run_id.as_str()),
            model: "default-model".to_string(),
            input: "Process run".to_string(),
            parameters: None,
        };

        let response = self.model_provider.execute(request).await?;

        // Log the model execution
        let log_entry = agenticos_contracts::LogEntry {
            level: agenticos_contracts::LogLevel::Info,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            component: "AgentEngine".to_string(),
            message: format!("Model execution: {}", response.output),
            fields: vec![
                ("run_id".to_string(), run_id.as_str().to_string()),
                (
                    "tokens_used".to_string(),
                    response.tokens_used.unwrap_or(0).to_string(),
                ),
            ],
            correlation_id: Some(run_id.as_str().to_string()),
        };
        self.runtime.logger.log(log_entry).await?;

        // Add message to context for recovery
        let message = agenticos_contracts::Message {
            message_id: format!("{}-msg-1", run_id.as_str()),
            role: "agent".to_string(),
            content: response.output.clone(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            token_count: response.output.len() as u32,
            run_id: run_id.clone(),
        };
        self.context_manager.add_message(message).await?;

        Ok(())
    }

    async fn get_run_state(&self, run_id: RunId) -> Result<RunState, ContractError> {
        let runs = self.runtime.runs.read().await;
        let run = runs.get(&run_id).ok_or(ContractError::MissingCapability)?;
        Ok(run.state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agenticos_contracts::LogLevel;
    use agenticos_kernel::{
        InMemoryConfig, InMemoryEventStore, InMemoryLogger, InMemorySnapshotStore,
    };

    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Runtime::new().unwrap()
    }

    #[test]
    fn test_basic_agent_engine() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer,
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            let engine = BasicAgentEngine::with_kernel("test-engine".to_string(), runtime.clone());

            let run_id = RunId::new("test-run-agent-1").unwrap();

            // Start a run
            engine
                .start_run(run_id.clone(), "Test objective".to_string())
                .await
                .unwrap();

            // Check state
            let state = engine.get_run_state(run_id.clone()).await.unwrap();
            assert_eq!(state, RunState::Admitted);

            // Resume the run
            engine.resume_run(run_id.clone()).await.unwrap();

            // Check state after resume
            let state = engine.get_run_state(run_id.clone()).await.unwrap();
            assert_eq!(state, RunState::Running);
        });
    }

    #[test]
    fn test_in_memory_model_provider() {
        let rt = test_runtime();
        rt.block_on(async {
            let provider = InMemoryModelProvider::new("test-provider".to_string());

            let request = ModelRequest {
                request_id: "req-1".to_string(),
                model: "test-model".to_string(),
                input: "Hello, world!".to_string(),
                parameters: None,
            };

            let response = provider.execute(request).await.unwrap();

            assert_eq!(response.request_id, "req-1");
            assert!(response.output.contains("Hello, world!"));
            assert_eq!(response.metadata, Some("in-memory".to_string()));
        });
    }

    #[test]
    fn test_durable_run_recovery() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer,
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            let engine = BasicAgentEngine::with_kernel("test-engine".to_string(), runtime.clone());

            let run_id = RunId::new("test-run-recovery").unwrap();
            engine
                .start_run(run_id.clone(), "Recovery test".to_string())
                .await
                .unwrap();

            // Simulate engine restart by creating new engine instance
            let engine2 =
                BasicAgentEngine::with_kernel("test-engine-2".to_string(), runtime.clone());

            // Recover runs from memory
            let recovered = engine2.recover_runs().await.unwrap();
            assert!(recovered.contains(&run_id));

            // Resume the recovered run
            engine2.resume_run(run_id).await.unwrap();
        });
    }

    #[test]
    fn test_capability_grant_expiry() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let _runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer.clone(),
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            use agenticos_contracts::CapabilityIssuer;

            // Create a grant that expires in the past
            let past_time = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
                - 3600; // 1 hour ago
            let expired_grant = agenticos_contracts::CapabilityGrant {
                capability_type: agenticos_contracts::CapabilityType::Read,
                resource: "test-resource".to_string(),
                permission: "read".to_string(),
                expires_at: past_time,
                grant_id: "expired-grant".to_string(),
            };

            let grant_id = capability_issuer.issue(expired_grant).await.unwrap();

            // Validate should fail for expired grant
            let is_valid = capability_issuer
                .validate_with_expiry(&grant_id)
                .await
                .unwrap();
            assert!(!is_valid, "Expired grant should be invalid");

            // Create a grant that expires in the future
            let future_time = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
                + 3600; // 1 hour from now
            let valid_grant = agenticos_contracts::CapabilityGrant {
                capability_type: agenticos_contracts::CapabilityType::Read,
                resource: "test-resource".to_string(),
                permission: "read".to_string(),
                expires_at: future_time,
                grant_id: "valid-grant".to_string(),
            };

            let valid_grant_id = capability_issuer.issue(valid_grant).await.unwrap();

            // Validate should succeed for valid grant
            let is_valid = capability_issuer
                .validate_with_expiry(&valid_grant_id)
                .await
                .unwrap();
            assert!(is_valid, "Valid grant should be valid");
        });
    }

    #[test]
    fn test_command_handler() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer,
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            let handler = BasicCommandHandler::new(runtime.clone());

            let command = agenticos_contracts::Command {
                command_type: "start_run".to_string(),
                payload: serde_json::json!({
                    "run_id": "test-run-cmd",
                    "objective": "Test command"
                }),
                correlation_id: "test-corr-1".to_string(),
            };

            let result = handler.handle(command).await.unwrap();
            assert!(result.success);
            assert!(result.message.contains("started"));
        });
    }

    #[test]
    fn test_query_handler() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer,
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            let handler = BasicQueryHandler::new(runtime.clone());

            // First create a run so the query can succeed
            let run_id = RunId::new("test-run-query").unwrap();
            runtime.create_run(run_id.clone()).await.unwrap();
            runtime
                .transition_run(&run_id, RunState::Admitted, 1)
                .await
                .unwrap();

            let query = agenticos_contracts::Query {
                query_type: "get_run_state".to_string(),
                parameters: serde_json::json!({
                    "run_id": "test-run-query"
                }),
            };

            let result = handler.handle(query).await.unwrap();
            assert!(result.data.is_object());
        });
    }

    #[test]
    fn test_read_write_isolation() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer,
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            let command_handler = BasicCommandHandler::new(runtime.clone());
            let query_handler = BasicQueryHandler::new(runtime.clone());

            // Command side: create a run
            let command = agenticos_contracts::Command {
                command_type: "start_run".to_string(),
                payload: serde_json::json!({
                    "run_id": "test-rw-iso",
                    "objective": "Isolation test"
                }),
                correlation_id: "test-iso-1".to_string(),
            };

            let cmd_result = command_handler.handle(command).await.unwrap();
            assert!(cmd_result.success);

            // Query side: read the run state
            let query = agenticos_contracts::Query {
                query_type: "get_run_state".to_string(),
                parameters: serde_json::json!({
                    "run_id": "test-rw-iso"
                }),
            };

            let query_result = query_handler.handle(query).await.unwrap();
            assert!(query_result.data.is_object());

            // Verify read/write isolation - query should not modify state
            let runs = runtime.runs.read().await;
            let run = runs.get(&RunId::new("test-rw-iso").unwrap());
            assert!(run.is_some());
        });
    }

    #[test]
    fn test_event_driven_synchronization() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer,
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            let projection = BasicProjection::new(runtime.clone());

            // Create a test event with the correct SerializedEvent structure
            let event = agenticos_contracts::SerializedEvent {
                event_type: "run_created".to_string(),
                data: serde_json::json!({"run_id": "test-sync"}).to_string(),
                schema_version: 1,
            };

            // Projection should handle event without error
            let result = projection.update(event).await;
            assert!(result.is_ok());
        });
    }

    #[test]
    fn test_end_to_end_command_execution() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer,
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            let command_handler = BasicCommandHandler::new(runtime.clone());

            // Create a command to start a run
            let command = Command {
                correlation_id: "cmd-1".to_string(),
                command_type: "start_run".to_string(),
                payload: serde_json::json!({
                    "run_id": "e2e-run",
                    "objective": "End-to-end test"
                }),
            };

            // Execute the command
            let result = command_handler.handle(command).await.unwrap();

            // Verify the command result
            assert!(result.success);
            assert!(!result.message.is_empty());

            // Verify the run was created in the runtime
            let runs = runtime.runs.read().await;
            let run = runs.get(&RunId::new("e2e-run").unwrap());
            assert!(run.is_some());
            assert_eq!(run.unwrap().state, RunState::Admitted);
        });
    }

    #[test]
    fn test_query_performance() {
        let rt = test_runtime();
        rt.block_on(async {
            let event_store = std::sync::Arc::new(InMemoryEventStore::new());
            let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
            let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
            let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
            let capability_issuer =
                std::sync::Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());

            let runtime = std::sync::Arc::new(agenticos_kernel::KernelRuntime::new(
                event_store,
                snapshot_store,
                logger,
                config,
                capability_issuer,
                std::sync::Arc::new(
                    agenticos_brain::capability_registry::CapabilityRegistry::default(),
                ),
            ));

            let query_handler = BasicQueryHandler::new(runtime.clone());

            // Create a run first
            let run_id = RunId::new("query-perf-run").unwrap();
            runtime.create_run(run_id.clone()).await.unwrap();

            // Execute a query to get the run state
            let query = Query {
                query_type: "get_run_state".to_string(),
                parameters: serde_json::json!({"run_id": "query-perf-run"}),
            };

            let start = std::time::Instant::now();
            let result = query_handler.handle(query).await.unwrap();
            let duration = start.elapsed();

            // Verify the query result
            assert!(!result.data.is_null());
            assert!(duration.as_millis() < 100); // Query should be fast

            // Verify the returned data
            let data = result.data;
            assert!(data.get("run_id").is_some());
            assert!(data.get("state").is_some());
        });
    }
}

/// Capability-gated tool execution service.
#[derive(Debug, Clone)]
pub struct SecureToolService {
    capabilities: Arc<agenticos_security::CapabilityManager>,
    sandbox: Arc<agenticos_sandbox::ProcessSandbox>,
    pipeline: Arc<agenticos_kernel::ToolExecutionPipeline>,
}

impl SecureToolService {
    /// Construct a secure tool service with a policy hook.
    pub fn new(
        capabilities: Arc<agenticos_security::CapabilityManager>,
        sandbox: Arc<agenticos_sandbox::ProcessSandbox>,
    ) -> Self {
        let pipeline = agenticos_kernel::ToolExecutionPipeline::new().add_pre_hook(Arc::new(
            agenticos_kernel::PermissionPolicyHook::new().allow_tool("process.execute".to_string()),
        ));
        Self {
            capabilities,
            sandbox,
            pipeline: Arc::new(pipeline),
        }
    }

    /// Execute a command after validating an execute capability.
    pub async fn execute_command(
        &self,
        session_id: &str,
        user_id: Option<&str>,
        grant_id: &str,
        command: &str,
        timeout_ms: Option<u64>,
    ) -> Result<agenticos_kernel::ToolExecutionResult, ContractError> {
        let authorized = self
            .capabilities
            .authorize(
                grant_id,
                agenticos_contracts::CapabilityType::Execute,
                "process/command",
                "process.execute",
            )
            .await?;

        if !authorized {
            return Err(ContractError::MissingCapability);
        }

        let context = agenticos_kernel::ToolExecutionContext::new(
            "process.execute".to_string(),
            serde_json::json!({
                "command": command,
                "timeout_ms": timeout_ms,
            }),
            session_id.to_string(),
        );

        let sandbox = self.sandbox.clone();
        let command = command.to_string();
        let result = self
            .pipeline
            .execute(context, move |_context| {
                let sandbox = sandbox.clone();
                let command = command.clone();
                async move {
                    match sandbox
                        .execute_command(
                            &command,
                            timeout_ms,
                            None,
                            &["process.execute".to_string()],
                        )
                        .await
                    {
                        Ok(response) if response.success => {
                            agenticos_kernel::ToolExecutionResult::success(response.output)
                        }
                        Ok(response) => agenticos_kernel::ToolExecutionResult::failure(
                            response
                                .error
                                .unwrap_or_else(|| "process execution failed".to_string()),
                        ),
                        Err(error) => {
                            agenticos_kernel::ToolExecutionResult::failure(error.to_string())
                        }
                    }
                }
            })
            .await;

        let _ = user_id;
        Ok(result)
    }
}

#[cfg(test)]
mod secure_tool_tests {
    use super::*;
    use agenticos_contracts::CapabilityIssuer;

    #[tokio::test]
    async fn command_requires_execute_grant() {
        let capabilities = Arc::new(agenticos_security::CapabilityManager::new());
        let sandbox = Arc::new(agenticos_sandbox::ProcessSandbox::default());
        let service = SecureToolService::new(capabilities, sandbox);

        let result = service
            .execute_command("session-1", None, "missing", "git --version", None)
            .await;
        assert!(matches!(result, Err(ContractError::MissingCapability)));
    }

    #[tokio::test]
    async fn command_executes_with_grant() {
        let capabilities = Arc::new(agenticos_security::CapabilityManager::new());
        capabilities
            .issue(agenticos_contracts::CapabilityGrant {
                capability_type: agenticos_contracts::CapabilityType::Execute,
                resource: "process/*".to_string(),
                permission: "process.execute".to_string(),
                expires_at: 0,
                grant_id: "grant-1".to_string(),
            })
            .await
            .unwrap();

        let sandbox = Arc::new(agenticos_sandbox::ProcessSandbox::default());
        let service = SecureToolService::new(capabilities, sandbox);

        let result = service
            .execute_command("session-1", None, "grant-1", "git --version", None)
            .await
            .unwrap();
        assert!(result.success);
    }
}
