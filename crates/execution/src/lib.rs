#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! execution boundary and workers boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    AgentEngine, ContractError, ModelProvider, ModelRequest, ModelResponse, RunId, RunState,
};
use agenticos_kernel::KernelRuntime;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-execution";

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
    ) -> Self {
        Self {
            engine_id,
            runtime,
            model_provider,
            runs: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Create a basic agent engine with a kernel runtime.
    pub fn with_kernel(engine_id: String, runtime: Arc<KernelRuntime>) -> Self {
        let model_provider = Arc::new(InMemoryModelProvider::default());
        Self::new(engine_id, runtime, model_provider)
    }
}

#[async_trait::async_trait]
impl AgentEngine for BasicAgentEngine {
    fn engine_id(&self) -> &str {
        &self.engine_id
    }

    async fn start_run(&self, run_id: RunId, _objective: String) -> Result<(), ContractError> {
        // Create the run in the kernel
        self.runtime.create_run(run_id.clone()).await?;

        // Transition to Admitted
        self.runtime
            .transition_run(&run_id, RunState::Admitted, 1)
            .await?;

        // Register the run
        let mut runs = self.runs.write().await;
        runs.push(run_id);

        Ok(())
    }

    async fn resume_run(&self, run_id: RunId) -> Result<(), ContractError> {
        // Check if run exists in our registry
        let runs = self.runs.read().await;
        if !runs.contains(&run_id) {
            return Err(ContractError::MissingCapability);
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
                ("tokens_used".to_string(), response.tokens_used.unwrap_or(0).to_string()),
            ],
            correlation_id: Some(run_id.as_str().to_string()),
        };
        self.runtime.logger.log(log_entry).await?;

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
}
