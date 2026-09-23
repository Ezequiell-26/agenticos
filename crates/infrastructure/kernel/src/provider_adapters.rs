#![forbid(unsafe_code)]

//! Provider adapters for LLM providers.
//! Inspired by FreeLLMAPI's provider adapter architecture.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::sleep;

/// Chat completion request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

/// Chat message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Chat completion response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub model: String,
    pub choices: Vec<Choice>,
    pub usage: Option<Usage>,
}

/// Choice in completion response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    pub index: u32,
    pub message: ChatMessage,
    pub finish_reason: Option<String>,
}

/// Token usage information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Retry configuration for provider calls.
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(10),
            backoff_multiplier: 2.0,
        }
    }
}

/// Execute an async operation with exponential backoff retry.
pub async fn retry_with_backoff<F, T, E>(operation: F, config: &RetryConfig) -> Result<T, E>
where
    F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>>,
    E: std::fmt::Display,
{
    let mut delay = config.initial_delay;
    let mut last_error = None;

    for attempt in 0..=config.max_retries {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_error = Some(e);
                if attempt < config.max_retries {
                    sleep(delay).await;
                    delay = std::cmp::min(
                        Duration::from_millis(
                            (delay.as_millis() as f64 * config.backoff_multiplier) as u64,
                        ),
                        config.max_delay,
                    );
                }
            }
        }
    }

    Err(last_error.unwrap())
}

/// Execute an async operation with timeout.
pub async fn with_timeout<F, T>(operation: F, timeout: Duration) -> Result<T, TimeoutError>
where
    F: std::future::Future<Output = T>,
{
    match tokio::time::timeout(timeout, operation).await {
        Ok(result) => Ok(result),
        Err(_) => Err(TimeoutError::OperationTimedOut),
    }
}

/// Timeout error types.
#[derive(Debug, Clone)]
pub enum TimeoutError {
    OperationTimedOut,
}

impl std::fmt::Display for TimeoutError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TimeoutError::OperationTimedOut => write!(f, "Operation timed out"),
        }
    }
}

impl std::error::Error for TimeoutError {}

/// Health check status.
#[derive(Debug, Clone, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

/// Health check result.
#[derive(Debug, Clone)]
pub struct HealthCheck {
    pub status: HealthStatus,
    pub message: String,
    pub timestamp: u64,
}

impl HealthCheck {
    /// Create a new health check.
    pub fn new(status: HealthStatus, message: String) -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        Self {
            status,
            message,
            timestamp,
        }
    }

    /// Create a healthy check.
    pub fn healthy(message: String) -> Self {
        Self::new(HealthStatus::Healthy, message)
    }

    /// Create a degraded check.
    pub fn degraded(message: String) -> Self {
        Self::new(HealthStatus::Degraded, message)
    }

    /// Create an unhealthy check.
    pub fn unhealthy(message: String) -> Self {
        Self::new(HealthStatus::Unhealthy, message)
    }
}

/// Rate limiter for API calls.
#[derive(Debug)]
pub struct RateLimiter {
    requests_per_second: u32,
    last_request_time: std::sync::Mutex<std::time::Instant>,
}

impl RateLimiter {
    /// Create a new rate limiter.
    pub fn new(requests_per_second: u32) -> Self {
        Self {
            requests_per_second,
            last_request_time: std::sync::Mutex::new(std::time::Instant::now()),
        }
    }

    /// Check if a request is allowed.
    pub fn allow(&self) -> bool {
        let mut last_time = self.last_request_time.lock().unwrap();
        let now = std::time::Instant::now();
        let elapsed = now.duration_since(*last_time);

        if elapsed.as_secs_f64() >= 1.0 / self.requests_per_second as f64 {
            *last_time = now;
            true
        } else {
            false
        }
    }

    /// Wait until the next request is allowed.
    pub async fn wait(&self) {
        while !self.allow() {
            sleep(Duration::from_millis(10)).await;
        }
    }
}

/// Circuit breaker state.
#[derive(Debug, Clone, PartialEq)]
pub enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

/// Circuit breaker error.
#[derive(Debug, Clone)]
pub enum CircuitBreakerError<E> {
    CircuitOpen,
    OperationFailed(E),
}

impl<E: std::fmt::Display> std::fmt::Display for CircuitBreakerError<E> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CircuitBreakerError::CircuitOpen => write!(f, "Circuit breaker is open"),
            CircuitBreakerError::OperationFailed(e) => write!(f, "Operation failed: {}", e),
        }
    }
}

impl<E: std::error::Error> std::error::Error for CircuitBreakerError<E> {}

/// Circuit breaker for provider calls.
#[derive(Debug)]
pub struct CircuitBreaker {
    state: CircuitBreakerState,
    failure_count: u32,
    failure_threshold: u32,
    timeout: Duration,
    last_failure_time: Option<std::time::Instant>,
}

impl CircuitBreaker {
    /// Create a new circuit breaker.
    pub fn new(failure_threshold: u32, timeout: Duration) -> Self {
        Self {
            state: CircuitBreakerState::Closed,
            failure_count: 0,
            failure_threshold,
            timeout,
            last_failure_time: None,
        }
    }

    /// Check if circuit allows calls.
    pub fn allow_call(&mut self) -> bool {
        if self.state == CircuitBreakerState::Open {
            if let Some(last_failure) = self.last_failure_time {
                if last_failure.elapsed() >= self.timeout {
                    // Timeout passed, move to half-open
                    self.state = CircuitBreakerState::HalfOpen;
                    return true;
                }
            }
            return false;
        }
        true
    }

    /// Record a successful call.
    pub fn record_success(&mut self) {
        if self.state == CircuitBreakerState::HalfOpen {
            self.state = CircuitBreakerState::Closed;
            self.failure_count = 0;
        } else if self.state == CircuitBreakerState::Closed {
            self.failure_count = 0;
        }
    }

    /// Record a failed call.
    pub fn record_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure_time = Some(std::time::Instant::now());

        if self.failure_count >= self.failure_threshold {
            self.state = CircuitBreakerState::Open;
        }
    }

    /// Get current circuit breaker state.
    pub fn state(&self) -> CircuitBreakerState {
        self.state.clone()
    }

    /// Reset circuit breaker to closed state.
    pub fn reset(&mut self) {
        self.state = CircuitBreakerState::Closed;
        self.failure_count = 0;
        self.last_failure_time = None;
    }
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self::new(5, Duration::from_secs(60))
    }
}

/// Streaming chunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub id: String,
    pub choices: Vec<StreamChoice>,
}

/// Stream choice.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChoice {
    pub index: u32,
    pub delta: Option<ChatMessage>,
    pub finish_reason: Option<String>,
}

/// Provider error.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderError {
    pub message: String,
    pub error_type: String,
    pub is_rate_limit: bool,
}

impl ProviderError {
    /// Create a new provider error.
    pub fn new(message: String, error_type: String, is_rate_limit: bool) -> Self {
        Self {
            message,
            error_type,
            is_rate_limit,
        }
    }

    /// Create a rate limit error.
    pub fn rate_limit(message: String) -> Self {
        Self::new(message, "rate_limit_error".to_string(), true)
    }

    /// Create an authentication error.
    pub fn auth(message: String) -> Self {
        Self::new(message, "authentication_error".to_string(), false)
    }

    /// Create a generic error.
    pub fn generic(message: String) -> Self {
        Self::new(message, "generic_error".to_string(), false)
    }
}

/// Base trait for LLM providers.
#[async_trait]
pub trait Provider: Send + Sync {
    /// Get provider name.
    fn name(&self) -> &str;

    /// Execute a chat completion request.
    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
        _api_key: &str,
    ) -> Result<ChatCompletionResponse, ProviderError>;

    /// Stream a chat completion request.
    async fn stream_chat_completion(
        &self,
        _request: ChatCompletionRequest,
        _api_key: &str,
    ) -> Result<
        Box<dyn futures::Stream<Item = Result<StreamChunk, ProviderError>> + Send>,
        ProviderError,
    > {
        Err(ProviderError::generic(
            "Streaming not implemented".to_string(),
        ))
    }
}

/// Google Gemini provider adapter.
#[allow(dead_code)]
pub struct GoogleProvider {
    base_url: String,
    timeout_secs: u64,
}

impl GoogleProvider {
    /// Create a new Google provider.
    pub fn new() -> Self {
        Self {
            base_url: "https://generativeai.googleapis.com/v1beta".to_string(),
            timeout_secs: 30,
        }
    }

    /// Create a new Google provider with custom timeout.
    pub fn with_timeout(timeout_secs: u64) -> Self {
        Self {
            base_url: "https://generativeai.googleapis.com/v1beta".to_string(),
            timeout_secs,
        }
    }
}

impl Default for GoogleProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for GoogleProvider {
    fn name(&self) -> &str {
        "google"
    }

    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
        api_key: &str,
    ) -> Result<ChatCompletionResponse, ProviderError> {
        // Build HTTP client with timeout
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(self.timeout_secs))
            .build()
            .map_err(|e| ProviderError::generic(format!("Failed to build HTTP client: {}", e)))?;

        // Build Google Gemini API request
        let model = request.model.as_str();
        let url = format!(
            "{}/models/{}:generateContent?key={}",
            self.base_url, model, api_key
        );

        // Convert OpenAI-style request to Google format
        let last_message = request
            .messages
            .last()
            .map(|m| m.content.clone())
            .unwrap_or_else(String::new);

        let google_request = serde_json::json!({
            "contents": [{
                "parts": [{
                    "text": last_message
                }]
            }],
            "generationConfig": {
                "temperature": request.temperature.unwrap_or(0.7),
                "maxOutputTokens": request.max_tokens.unwrap_or(1024),
            }
        });

        // Make HTTP request
        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&google_request)
            .send()
            .await
            .map_err(|e| ProviderError::generic(format!("HTTP request failed: {}", e)))?;

        // Check response status
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Failed to read error response".to_string());
            return Err(ProviderError::generic(format!(
                "Google API error: {} - {}",
                status, error_text
            )));
        }

        // Parse response
        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| ProviderError::generic(format!("Failed to parse response: {}", e)))?;

        // Extract content from Google response format
        let content = response_json
            .get("candidates")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|cand| cand.get("content"))
            .and_then(|content| content.get("parts"))
            .and_then(|parts| parts.as_array())
            .and_then(|arr| arr.first())
            .and_then(|part| part.get("text"))
            .and_then(|t| t.as_str())
            .ok_or_else(|| ProviderError::generic("Missing content in response".to_string()))?;

        // Extract token usage if available
        let usage = response_json.get("usageMetadata").map(|um| Usage {
            prompt_tokens: um
                .get("promptTokenCount")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            completion_tokens: um
                .get("candidatesTokenCount")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            total_tokens: um
                .get("totalTokenCount")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
        });

        Ok(ChatCompletionResponse {
            id: response_json
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("google-response")
                .to_string(),
            model: request.model.clone(),
            choices: vec![Choice {
                index: 0,
                message: ChatMessage {
                    role: "assistant".to_string(),
                    content: content.to_string(),
                },
                finish_reason: Some("stop".to_string()),
            }],
            usage,
        })
    }
}

/// Groq provider adapter.
#[allow(dead_code)]
pub struct GroqProvider {
    base_url: String,
    timeout_secs: u64,
}

impl GroqProvider {
    /// Create a new Groq provider.
    pub fn new() -> Self {
        Self {
            base_url: "https://api.groq.com/openai/v1".to_string(),
            timeout_secs: 30,
        }
    }

    /// Create a new Groq provider with custom timeout.
    pub fn with_timeout(timeout_secs: u64) -> Self {
        Self {
            base_url: "https://api.groq.com/openai/v1".to_string(),
            timeout_secs,
        }
    }
}

impl Default for GroqProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for GroqProvider {
    fn name(&self) -> &str {
        "groq"
    }

    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
        api_key: &str,
    ) -> Result<ChatCompletionResponse, ProviderError> {
        // Build HTTP client with timeout
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(self.timeout_secs))
            .build()
            .map_err(|e| ProviderError::generic(format!("Failed to build HTTP client: {}", e)))?;

        // Build Groq API request (OpenAI-compatible)
        let url = format!("{}/chat/completions", self.base_url);

        // Convert to OpenAI format (Groq is OpenAI-compatible)
        let groq_request = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature.unwrap_or(0.7),
            "max_tokens": request.max_tokens.unwrap_or(1024),
            "stream": request.stream.unwrap_or(false),
        });

        // Make HTTP request
        let response = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&groq_request)
            .send()
            .await
            .map_err(|e| ProviderError::generic(format!("HTTP request failed: {}", e)))?;

        // Check response status
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Failed to read error response".to_string());
            return Err(ProviderError::generic(format!(
                "Groq API error: {} - {}",
                status, error_text
            )));
        }

        // Parse response (OpenAI-compatible format)
        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| ProviderError::generic(format!("Failed to parse response: {}", e)))?;

        // Extract content from OpenAI-compatible response
        let content = response_json
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|msg| msg.get("content"))
            .and_then(|c| c.as_str())
            .ok_or_else(|| ProviderError::generic("Missing content in response".to_string()))?;

        // Extract token usage
        let usage = response_json.get("usage").map(|u| Usage {
            prompt_tokens: u.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            completion_tokens: u
                .get("completion_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            total_tokens: u.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        });

        Ok(ChatCompletionResponse {
            id: response_json
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("groq-response")
                .to_string(),
            model: request.model.clone(),
            choices: vec![Choice {
                index: 0,
                message: ChatMessage {
                    role: "assistant".to_string(),
                    content: content.to_string(),
                },
                finish_reason: Some("stop".to_string()),
            }],
            usage,
        })
    }
}

/// Provider registry.
#[allow(dead_code)]
pub struct ProviderRegistry {
    providers: HashMap<String, Box<dyn Provider>>,
}

impl ProviderRegistry {
    /// Create a new provider registry.
    pub fn new() -> Self {
        let mut registry = Self {
            providers: HashMap::new(),
        };

        // Register default providers
        registry.register("google".to_string(), Box::new(GoogleProvider::new()));
        registry.register("groq".to_string(), Box::new(GroqProvider::new()));

        registry
    }

    /// Register a provider.
    pub fn register(&mut self, name: String, provider: Box<dyn Provider>) {
        self.providers.insert(name, provider);
    }

    /// Get a provider by name.
    pub fn get(&self, name: &str) -> Option<&dyn Provider> {
        self.providers.get(name).map(|p| p.as_ref())
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_google_provider() {
        let provider = GoogleProvider::new();
        let request = ChatCompletionRequest {
            model: "gemini-pro".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            temperature: Some(0.7),
            max_tokens: Some(100),
            stream: Some(false),
        };

        let response = provider.chat_completion(request, "test-key").await;
        assert!(response.is_ok());
    }

    #[tokio::test]
    async fn test_groq_provider() {
        let provider = GroqProvider::new();
        let request = ChatCompletionRequest {
            model: "llama3-8b-8192".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            temperature: Some(0.7),
            max_tokens: Some(100),
            stream: Some(false),
        };

        let response = provider.chat_completion(request, "test-key").await;
        assert!(response.is_ok());
    }

    #[test]
    fn test_provider_registry() {
        let registry = ProviderRegistry::new();

        assert!(registry.get("google").is_some());
        assert!(registry.get("groq").is_some());
        assert!(registry.get("unknown").is_none());
    }
}
