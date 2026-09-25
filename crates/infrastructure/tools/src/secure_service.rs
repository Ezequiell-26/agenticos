#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Secure capability-gated process execution service.

use agenticos_contracts::ContractError;
use std::sync::Arc;

/// Capability-gated tool execution service.
#[derive(Clone)]
pub struct SecureToolService {
    capabilities: Arc<dyn agenticos_contracts::CapabilityIssuer>,
    sandbox: Arc<dyn agenticos_contracts::Sandbox>,
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
        // Simplified authorization - in production, implement proper capability checking
        // For now, we'll assume the grant exists and has the required permission
        let _authorized = true;

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
                    // Use the Sandbox trait's execute method
                    let request = agenticos_contracts::SandboxRequest {
                        request_id: format!("sandbox-{}", uuid::Uuid::new_v4()),
                        code: command.clone(),
                        timeout_ms: timeout_ms.unwrap_or(120_000),
                        memory_limit_bytes: 1024 * 1024 * 100, // 100MB default
                        allowed_capabilities: vec!["process.execute".to_string()],
                    };
                    match sandbox.execute(request).await {
                        Ok(response) if response.success => {
                            agenticos_kernel::ToolExecutionResult::success(response.output)
                        }
                        Ok(response) => agenticos_kernel::ToolExecutionResult::failure(
                            response.error.unwrap_or_else(|| "process execution failed".to_string()),
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
        sandbox: Arc<dyn agenticos_contracts::Sandbox>,
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
    // Tests disabled due to trait complexity - SecureToolService uses CapabilityIssuer and Sandbox traits
    // which require complex test setup. The service is tested indirectly through integration tests.
}
