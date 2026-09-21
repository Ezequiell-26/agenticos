use agenticos_contracts::{ContractError, ModelProvider, ModelRequest, ModelResponse};
use agenticos_kernel::{ReactAgent, Skill};
use std::sync::Arc;
use tokio::time::{timeout, Duration};

struct TestProvider;

#[async_trait::async_trait]
impl ModelProvider for TestProvider {
    fn provider_id(&self) -> &str {
        "test-provider"
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        Ok(ModelResponse {
            request_id: request.request_id,
            output: format!("Thought for {}", request.input),
            metadata: Some("regression-test".to_string()),
            tokens_used: Some(1),
        })
    }
}

#[tokio::test]
async fn react_agent_mutable_state_is_preserved() {
    let mut agent = ReactAgent::new("Test agent".to_string());

    agent.set_memory_md("Persistent memory".to_string());
    agent.set_user_md("Persistent preferences".to_string());
    agent.add_skill(Skill {
        name: "regression".to_string(),
        description: "Regression test skill".to_string(),
        version: "1.0".to_string(),
        author: "test".to_string(),
        platforms: vec!["all".to_string()],
        procedure: "test".to_string(),
    });

    let prompt = agent.build_system_prompt().await;
    assert!(prompt.contains("Persistent memory"));
    assert!(prompt.contains("Persistent preferences"));
    assert!(prompt.contains("regression"));
}

#[tokio::test]
async fn react_agent_execute_turn_does_not_deadlock_on_mutex() {
    let agent = ReactAgent::new("Test agent".to_string());
    agent.set_model_provider(Arc::new(TestProvider));

    let result = timeout(Duration::from_secs(2), agent.execute_turn("hello"))
        .await
        .expect("execute_turn timed out; mutex likely held across an await")
        .expect("execute_turn should succeed with the test provider");

    assert!(result.contains("Observation:"));
}
