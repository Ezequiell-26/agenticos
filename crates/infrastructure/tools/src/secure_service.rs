#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Secure capability-gated process execution service.

use agenticos_contracts::ContractError;
use std::sync::Arc;

/// Capability-gated tool execution service.
#[derive(Clone)]
pub struct SecureToolService {
    capabilities: Arc<dyn agenticos_contracts::CapabilityIssuer>,
    sandbox: Arc<dyn agenticos_sandbox::Sandbox>,
    pipeline: Arc<agenticos_kernel::ToolExecutionPipeline>,
}

impl std::fmt::Debug for SecureToolService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SecureToolService")
            .field("capabilities", &"<CapabilityManager>")
            .field("sandbox", &"<ProcessSandbox>")
            .field("pipeline", &"<ToolExecutionPipeline>")
            .finish()
    }
}

impl SecureToolService {
    /// Execute a command with explicit resource/permission scope and working directory.
    #[allow(clippy::too_many_arguments)]
    pub async fn execute_scoped(
        &self,
        session_id: &str,
        user_id: Option<&str>,
        grant_id: &str,
        command: &str,
        timeout_ms: Option<u64>,
        resource: &str,
        permission: &str,
        workdir: Option<&std::path::Path>,
    ) -> Result<agenticos_kernel::ToolExecutionResult, ContractError> {
        let authorized = self
            .capabilities
            .authorize(
                grant_id,
                agenticos_contracts::CapabilityType::Execute,
                resource,
                permission,
            )
            .await?;

        if !authorized {
            return Err(ContractError::MissingCapability);
        }

        let mut context = agenticos_kernel::ToolExecutionContext::new(
            "process.execute".to_string(),
            serde_json::json!({
                "command": command,
                "timeout_ms": timeout_ms,
                "resource": resource,
                "permission": permission,
            }),
            session_id.to_string(),
        );
        if let Some(user_id) = user_id.filter(|value| !value.trim().is_empty()) {
            context = context.with_user_id(user_id.to_string());
        }

        let sandbox = self.sandbox.clone();
        let command = command.to_string();
        let workdir = workdir.map(std::path::Path::to_path_buf);
        let result = self
            .pipeline
            .execute(context, move |_context| {
                let sandbox = sandbox.clone();
                let command = command.clone();
                let workdir = workdir.clone();
                async move {
                    match sandbox
                        .execute_command(
                            &command,
                            timeout_ms,
                            workdir.as_deref(),
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

        Ok(result)
    }

    /// Construct a secure tool service with a policy hook.
    pub fn new(
        capabilities: Arc<dyn agenticos_contracts::CapabilityIssuer>,
        sandbox: Arc<dyn agenticos_sandbox::Sandbox>,
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

    /// Execute a command after validating the default process capability.
    pub async fn execute_command(
        &self,
        session_id: &str,
        user_id: Option<&str>,
        grant_id: &str,
        command: &str,
        timeout_ms: Option<u64>,
    ) -> Result<agenticos_kernel::ToolExecutionResult, ContractError> {
        self.execute_scoped(
            session_id,
            user_id,
            grant_id,
            command,
            timeout_ms,
            "process/command",
            "process.execute",
            None,
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agenticos_contracts::CapabilityIssuer;

    /// Simple in-memory sandbox for testing.
    struct InMemorySandbox;

    impl InMemorySandbox {
        fn new() -> Self {
            Self
        }
    }

    #[async_trait::async_trait]
    impl agenticos_contracts::Sandbox for InMemorySandbox {
        async fn execute(
            &self,
            _request: SandboxRequest,
        ) -> Result<SandboxResponse, ContractError> {
            Ok(SandboxResponse {
                status: SandboxStatus::Success,
                output: "test output".to_string(),
                error: None,
                usage: ResourceUsage::default(),
            })
        }
    }

    #[tokio::test]
    async fn command_requires_execute_grant() {
        let capabilities = Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());
        let sandbox: Arc<dyn agenticos_contracts::Sandbox> = Arc::new(InMemorySandbox::new());
        let service = SecureToolService::new(capabilities, sandbox);

        let result = service
            .execute_command("session-1", None, "missing", "git --version", None)
            .await;
        assert!(matches!(result, Err(ContractError::MissingCapability)));
    }

    #[tokio::test]
    async fn command_executes_with_grant() {
        let capabilities = Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());
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

        let sandbox: Arc<dyn agenticos_contracts::Sandbox> = Arc::new(InMemorySandbox::new());
        let service = SecureToolService::new(capabilities, sandbox);

        let result = service
            .execute_command("session-1", None, "grant-1", "git --version", None)
            .await
            .unwrap();
        assert!(result.success);
    }
}
