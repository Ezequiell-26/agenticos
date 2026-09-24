#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! protocol boundary and agent communication. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    ContractError, ProtocolMessage, ProtocolSerializer, ProtocolTransport, ProtocolValidator,
};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-protocols";

/// JSON protocol serializer.
#[derive(Debug)]
pub struct JsonProtocolSerializer;

impl JsonProtocolSerializer {
    /// Create a new JSON protocol serializer.
    pub fn new() -> Self {
        Self
    }
}

impl Default for JsonProtocolSerializer {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl ProtocolSerializer for JsonProtocolSerializer {
    async fn serialize(&self, message: ProtocolMessage) -> Result<Vec<u8>, ContractError> {
        serde_json::to_vec(&message).map_err(|e| ContractError::ParseError(e.to_string()))
    }

    async fn deserialize(&self, data: Vec<u8>) -> Result<ProtocolMessage, ContractError> {
        serde_json::from_slice(&data).map_err(|e| ContractError::ParseError(e.to_string()))
    }
}

/// Basic protocol validator.
#[derive(Debug)]
pub struct BasicProtocolValidator {
    supported_versions: Arc<RwLock<Vec<String>>>,
}

impl BasicProtocolValidator {
    /// Create a new basic protocol validator.
    pub fn new() -> Self {
        Self {
            supported_versions: Arc::new(RwLock::new(vec!["1.0".to_string()])),
        }
    }

    /// Add a supported protocol version.
    pub async fn add_version(&self, version: String) -> Result<(), ContractError> {
        let mut versions = self.supported_versions.write().await;
        versions.push(version);
        Ok(())
    }
}

impl Default for BasicProtocolValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl ProtocolValidator for BasicProtocolValidator {
    async fn validate(&self, message: &ProtocolMessage) -> Result<bool, ContractError> {
        // Check required fields
        if message.message_id.is_empty() {
            return Ok(false);
        }
        if message.source.is_empty() {
            return Ok(false);
        }
        if message.destination.is_empty() {
            return Ok(false);
        }
        if message.message_type.is_empty() {
            return Ok(false);
        }

        // Check version compatibility
        self.check_version(&message.protocol_version).await
    }

    async fn check_version(&self, version: &str) -> Result<bool, ContractError> {
        let versions = self.supported_versions.read().await;
        Ok(versions.contains(&version.to_string()))
    }
}

/// In-memory protocol transport.
#[derive(Debug)]
pub struct InMemoryProtocolTransport {
    messages: Arc<RwLock<VecDeque<ProtocolMessage>>>,
}

impl InMemoryProtocolTransport {
    /// Create a new in-memory protocol transport.
    pub fn new() -> Self {
        Self {
            messages: Arc::new(RwLock::new(VecDeque::new())),
        }
    }

    /// Get all messages in the transport.
    pub async fn get_all_messages(&self) -> Vec<ProtocolMessage> {
        let messages = self.messages.read().await;
        messages.iter().cloned().collect()
    }
}

impl Default for InMemoryProtocolTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl ProtocolTransport for InMemoryProtocolTransport {
    async fn send(&self, message: ProtocolMessage) -> Result<(), ContractError> {
        let mut messages = self.messages.write().await;
        messages.push_back(message);
        Ok(())
    }

    async fn receive(&self) -> Result<Option<ProtocolMessage>, ContractError> {
        let mut messages = self.messages.write().await;
        Ok(messages.pop_front())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Runtime::new().unwrap()
    }

    #[test]
    fn test_json_protocol_serializer() {
        let rt = test_runtime();
        rt.block_on(async {
            let serializer = JsonProtocolSerializer::new();

            let message = ProtocolMessage {
                message_id: "msg-1".to_string(),
                protocol_version: "1.0".to_string(),
                source: "agent-1".to_string(),
                destination: "agent-2".to_string(),
                message_type: "request".to_string(),
                payload: "{}".to_string(),
                timestamp: 12345,
                correlation_id: Some("corr-1".to_string()),
            };

            let serialized = serializer.serialize(message.clone()).await.unwrap();
            let deserialized = serializer.deserialize(serialized).await.unwrap();

            assert_eq!(deserialized.message_id, message.message_id);
            assert_eq!(deserialized.source, message.source);
        });
    }

    #[test]
    fn test_basic_protocol_validator() {
        let rt = test_runtime();
        rt.block_on(async {
            let validator = BasicProtocolValidator::new();

            let valid_message = ProtocolMessage {
                message_id: "msg-1".to_string(),
                protocol_version: "1.0".to_string(),
                source: "agent-1".to_string(),
                destination: "agent-2".to_string(),
                message_type: "request".to_string(),
                payload: "{}".to_string(),
                timestamp: 12345,
                correlation_id: None,
            };

            let is_valid = validator.validate(&valid_message).await.unwrap();
            assert!(is_valid);

            let is_supported = validator.check_version("1.0").await.unwrap();
            assert!(is_supported);
        });
    }

    #[test]
    fn test_in_memory_protocol_transport() {
        let rt = test_runtime();
        rt.block_on(async {
            let transport = InMemoryProtocolTransport::new();

            let message = ProtocolMessage {
                message_id: "msg-1".to_string(),
                protocol_version: "1.0".to_string(),
                source: "agent-1".to_string(),
                destination: "agent-2".to_string(),
                message_type: "request".to_string(),
                payload: "{}".to_string(),
                timestamp: 12345,
                correlation_id: None,
            };

            transport.send(message.clone()).await.unwrap();

            let received = transport.receive().await.unwrap();
            assert!(received.is_some());
            assert_eq!(received.unwrap().message_id, "msg-1");
        });
    }
}
