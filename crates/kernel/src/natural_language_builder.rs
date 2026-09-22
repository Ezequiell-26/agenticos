//! Natural Language Agent Builder adapted from AutoAgent
//!
//! A zero-code framework for creating and deploying LLM agents through
//! natural language alone. Enables users to create agents, tools, and
//! workflows using natural language descriptions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Agent description in natural language
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDescription {
    /// Agent name
    pub name: String,
    /// Natural language description of the agent
    pub description: String,
    /// Capabilities of the agent
    pub capabilities: Vec<String>,
    /// Tools this agent can use
    pub tools: Vec<String>,
    /// Agent role (e.g., "researcher", "coder", "analyst")
    pub role: String,
}

/// Generated agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedAgent {
    /// Agent ID
    pub id: String,
    /// Agent name
    pub name: String,
    /// System prompt generated from description
    pub system_prompt: String,
    /// Available tools
    pub tools: Vec<NLToolDefinition>,
    /// Agent capabilities
    pub capabilities: Vec<String>,
    /// Agent role
    pub role: String,
}

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NLToolDefinition {
    /// Tool name
    pub name: String,
    /// Tool description
    pub description: String,
    /// Tool parameters (JSON schema)
    pub parameters: serde_json::Value,
}

/// Workflow step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    /// Step ID
    pub id: String,
    /// Agent to use for this step
    pub agent_id: String,
    /// Step description
    pub description: String,
    /// Tools needed for this step
    pub tools: Vec<String>,
    /// Output of this step
    pub output: String,
}

/// Workflow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    /// Workflow ID
    pub id: String,
    /// Workflow name
    pub name: String,
    /// Natural language description
    pub description: String,
    /// Workflow steps
    pub steps: Vec<WorkflowStep>,
    /// Input requirements
    pub inputs: Vec<String>,
    /// Expected output
    pub output: String,
}

/// Result of agent generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationResult {
    /// Generated agent
    pub agent: GeneratedAgent,
    /// Confidence score (0.0 to 1.0)
    pub confidence: f64,
    /// Warnings or suggestions
    pub warnings: Vec<String>,
}

/// Trait for natural language agent builder
#[async_trait::async_trait]
pub trait NaturalLanguageBuilder: Send + Sync {
    /// Generate an agent from natural language description
    async fn generate_agent(
        &self,
        description: &AgentDescription,
    ) -> Result<GenerationResult, BuilderError>;

    /// Generate a workflow from natural language description
    async fn generate_workflow(
        &self,
        description: &str,
        available_agents: &[GeneratedAgent],
    ) -> Result<Workflow, BuilderError>;

    /// Validate an agent configuration
    fn validate_agent(&self, agent: &GeneratedAgent) -> Result<(), BuilderError>;
}

/// Builder errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BuilderError {
    /// LLM API error
    LLMError(String),
    /// Invalid description
    InvalidDescription(String),
    /// Generation failed
    GenerationFailed(String),
    /// Validation failed
    ValidationFailed(String),
    /// Missing required field
    MissingField(String),
}

/// Simple natural language builder implementation
#[allow(dead_code)]
pub struct SimpleNaturalLanguageBuilder {
    /// LLM client for generation
    llm_client: Arc<dyn BuilderLLMClient>,
}

impl SimpleNaturalLanguageBuilder {
    /// Create a new simple builder
    pub fn new(llm_client: Arc<dyn BuilderLLMClient>) -> Self {
        Self { llm_client }
    }

    /// Generate system prompt from description
    async fn generate_system_prompt(&self, description: &AgentDescription) -> String {
        format!(
            "You are {}, a {}. 

Description: {}

Capabilities: {}

You have access to the following tools: {}

Your role is to help users accomplish tasks using your capabilities and tools. Be direct, efficient, and helpful.",
            description.name,
            description.role,
            description.description,
            description.capabilities.join(", "),
            description.tools.join(", ")
        )
    }

    /// Generate tool definitions from tool names
    fn generate_tool_definitions(&self, tool_names: &[String]) -> Vec<NLToolDefinition> {
        tool_names
            .iter()
            .map(|name| NLToolDefinition {
                name: name.clone(),
                description: format!("Tool for {}", name),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            })
            .collect()
    }
}

#[async_trait::async_trait]
impl NaturalLanguageBuilder for SimpleNaturalLanguageBuilder {
    async fn generate_agent(
        &self,
        description: &AgentDescription,
    ) -> Result<GenerationResult, BuilderError> {
        let system_prompt = self.generate_system_prompt(description).await;
        let tools = self.generate_tool_definitions(&description.tools);

        let agent = GeneratedAgent {
            id: uuid::Uuid::new_v4().to_string(),
            name: description.name.clone(),
            system_prompt,
            tools,
            capabilities: description.capabilities.clone(),
            role: description.role.clone(),
        };

        Ok(GenerationResult {
            agent,
            confidence: 0.8,
            warnings: vec![],
        })
    }

    async fn generate_workflow(
        &self,
        description: &str,
        available_agents: &[GeneratedAgent],
    ) -> Result<Workflow, BuilderError> {
        // Simple workflow generation: use the first available agent
        if available_agents.is_empty() {
            return Err(BuilderError::GenerationFailed(
                "No available agents".to_string(),
            ));
        }

        let agent = &available_agents[0];

        Ok(Workflow {
            id: uuid::Uuid::new_v4().to_string(),
            name: format!("Workflow for {}", description),
            description: description.to_string(),
            steps: vec![WorkflowStep {
                id: uuid::Uuid::new_v4().to_string(),
                agent_id: agent.id.clone(),
                description: description.to_string(),
                tools: agent.tools.iter().map(|t| t.name.clone()).collect(),
                output: "result".to_string(),
            }],
            inputs: vec![],
            output: "result".to_string(),
        })
    }

    fn validate_agent(&self, agent: &GeneratedAgent) -> Result<(), BuilderError> {
        if agent.name.is_empty() {
            return Err(BuilderError::MissingField("name".to_string()));
        }
        if agent.system_prompt.is_empty() {
            return Err(BuilderError::MissingField("system_prompt".to_string()));
        }
        Ok(())
    }
}

/// LLM client trait for natural language builder
#[async_trait::async_trait]
pub trait BuilderLLMClient: Send + Sync {
    /// Generate text from prompt
    async fn generate(&self, prompt: &str) -> Result<String, BuilderError>;
}

/// Agent registry for managing generated agents
pub struct AgentRegistry {
    /// Registered agents
    agents: HashMap<String, GeneratedAgent>,
    /// Registered workflows
    workflows: HashMap<String, Workflow>,
}

impl AgentRegistry {
    /// Create a new agent registry
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
            workflows: HashMap::new(),
        }
    }

    /// Register an agent
    pub fn register_agent(&mut self, agent: GeneratedAgent) {
        self.agents.insert(agent.id.clone(), agent);
    }

    /// Get an agent by ID
    pub fn get_agent(&self, id: &str) -> Option<&GeneratedAgent> {
        self.agents.get(id)
    }

    /// List all agents
    pub fn list_agents(&self) -> Vec<&GeneratedAgent> {
        self.agents.values().collect()
    }

    /// Register a workflow
    pub fn register_workflow(&mut self, workflow: Workflow) {
        self.workflows.insert(workflow.id.clone(), workflow);
    }

    /// Get a workflow by ID
    pub fn get_workflow(&self, id: &str) -> Option<&Workflow> {
        self.workflows.get(id)
    }

    /// List all workflows
    pub fn list_workflows(&self) -> Vec<&Workflow> {
        self.workflows.values().collect()
    }

    /// Search agents by capability
    pub fn search_agents_by_capability(&self, capability: &str) -> Vec<&GeneratedAgent> {
        self.agents
            .values()
            .filter(|agent| agent.capabilities.iter().any(|c| c.contains(capability)))
            .collect()
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockLLMClient;
    #[async_trait::async_trait]
    impl BuilderLLMClient for MockLLMClient {
        async fn generate(&self, _prompt: &str) -> Result<String, BuilderError> {
            Ok("generated response".to_string())
        }
    }

    #[tokio::test]
    async fn test_generate_agent() {
        let llm_client = Arc::new(MockLLMClient);
        let builder = SimpleNaturalLanguageBuilder::new(llm_client);

        let description = AgentDescription {
            name: "Test Agent".to_string(),
            description: "A test agent".to_string(),
            capabilities: vec!["testing".to_string()],
            tools: vec!["test_tool".to_string()],
            role: "tester".to_string(),
        };

        let result = builder.generate_agent(&description).await;
        assert!(result.is_ok());
        let agent = result.unwrap().agent;
        assert_eq!(agent.name, "Test Agent");
        assert_eq!(agent.role, "tester");
    }

    #[test]
    fn test_agent_registry() {
        let mut registry = AgentRegistry::new();

        let agent = GeneratedAgent {
            id: "test-id".to_string(),
            name: "Test Agent".to_string(),
            system_prompt: "You are a test agent".to_string(),
            tools: vec![],
            capabilities: vec!["testing".to_string()],
            role: "tester".to_string(),
        };

        registry.register_agent(agent);
        assert_eq!(registry.list_agents().len(), 1);
        assert!(registry.get_agent("test-id").is_some());
    }
}
