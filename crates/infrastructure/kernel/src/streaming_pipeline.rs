#![forbid(unsafe_code)]

//! Streaming pipeline for SSE (Server-Sent Events).
//! Inspired by FreeLLMAPI's streaming pipeline architecture.

use async_trait::async_trait;
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

/// SSE event type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SSEEvent {
    /// Chat completion chunk
    ChatChunk(String),
    /// Done event
    Done,
    /// Error event
    Error(String),
}

/// SSE event format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSEMessage {
    pub event: Option<String>,
    pub data: String,
    pub id: Option<String>,
    pub retry: Option<u32>,
}

impl SSEMessage {
    /// Create a new SSE message.
    pub fn new(data: String) -> Self {
        Self {
            event: None,
            data,
            id: None,
            retry: None,
        }
    }

    /// Set event type.
    pub fn with_event(mut self, event: String) -> Self {
        self.event = Some(event);
        self
    }

    /// Set event ID.
    pub fn with_id(mut self, id: String) -> Self {
        self.id = Some(id);
        self
    }

    /// Convert to SSE format string.
    pub fn to_sse_format(&self) -> String {
        let mut output = String::new();

        if let Some(event) = &self.event {
            output.push_str(&format!("event: {}\n", event));
        }

        if let Some(id) = &self.id {
            output.push_str(&format!("id: {}\n", id));
        }

        if let Some(retry) = self.retry {
            output.push_str(&format!("retry: {}\n", retry));
        }

        output.push_str(&format!("data: {}\n", self.data));
        output.push_str("\n");

        output
    }
}

/// Streaming context.
#[derive(Debug, Clone)]
pub struct StreamingContext {
    pub request_id: String,
    pub model: String,
    pub start_timestamp: u64,
}

impl StreamingContext {
    /// Create a new streaming context.
    pub fn new(request_id: String, model: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            request_id,
            model,
            start_timestamp: now,
        }
    }
}

/// Streaming pipeline trait.
#[async_trait]
pub trait StreamingPipeline: Send + Sync {
    /// Stream chat completion as SSE events.
    async fn stream_chat_completion(
        &self,
        request: super::provider_adapters::ChatCompletionRequest,
        context: StreamingContext,
    ) -> Result<
        Pin<Box<dyn Stream<Item = SSEEvent> + Send>>,
        Box<dyn std::error::Error + Send + Sync>,
    >;
}

/// Basic streaming pipeline implementation.
#[allow(missing_debug_implementations)]
pub struct BasicStreamingPipeline {
    provider_registry: super::provider_adapters::ProviderRegistry,
}

impl BasicStreamingPipeline {
    /// Create a new basic streaming pipeline.
    pub fn new(provider_registry: super::provider_adapters::ProviderRegistry) -> Self {
        Self { provider_registry }
    }
}

#[async_trait]
impl StreamingPipeline for BasicStreamingPipeline {
    async fn stream_chat_completion(
        &self,
        request: super::provider_adapters::ChatCompletionRequest,
        _context: StreamingContext,
    ) -> Result<
        Pin<Box<dyn Stream<Item = SSEEvent> + Send>>,
        Box<dyn std::error::Error + Send + Sync>,
    > {
        // Extract provider name from model ID (e.g., "google:gemini-pro" -> "google")
        let provider_name = request.model.split(':').next().unwrap_or("google");

        let _provider = self
            .provider_registry
            .get(provider_name)
            .ok_or_else(|| format!("Provider not found: {}", provider_name))?;

        // For now, return a mock stream for testing
        // Production implementation will call provider's streaming API
        let model_name = request.model.clone();

        let stream = async_stream::stream! {
            // Simulate streaming chunks
            for i in 0..5 {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                yield SSEEvent::ChatChunk(format!("Chunk {} from {}", i + 1, model_name));
            }
            yield SSEEvent::Done;
        };

        Ok(Box::pin(stream))
    }
}

/// SSE encoder for converting events to SSE format.
#[allow(missing_debug_implementations)]
pub struct SSEEncoder;

impl SSEEncoder {
    /// Encode an SSE event to SSE format.
    pub fn encode(event: &SSEEvent) -> String {
        match event {
            SSEEvent::ChatChunk(data) => {
                let sse_msg = SSEMessage::new(data.clone()).with_event("chat.chunk".to_string());
                sse_msg.to_sse_format()
            }
            SSEEvent::Done => {
                let sse_msg = SSEMessage::new("[DONE]".to_string()).with_event("done".to_string());
                sse_msg.to_sse_format()
            }
            SSEEvent::Error(error) => {
                let sse_msg = SSEMessage::new(error.clone()).with_event("error".to_string());
                sse_msg.to_sse_format()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sse_message_format() {
        let msg = SSEMessage::new("test data".to_string())
            .with_event("test".to_string())
            .with_id("123".to_string());

        let sse = msg.to_sse_format();
        assert!(sse.contains("event: test"));
        assert!(sse.contains("id: 123"));
        assert!(sse.contains("data: test data"));
    }

    #[test]
    fn test_sse_encoder() {
        let event = SSEEvent::ChatChunk("test chunk".to_string());
        let encoded = SSEEncoder::encode(&event);

        assert!(encoded.contains("event: chat.chunk"));
        assert!(encoded.contains("data: test chunk"));
    }

    #[test]
    fn test_streaming_context() {
        let context = StreamingContext::new("req-123".to_string(), "google:gemini-pro".to_string());

        assert_eq!(context.request_id, "req-123");
        assert_eq!(context.model, "google:gemini-pro");
        assert!(context.start_timestamp > 0);
    }
}
