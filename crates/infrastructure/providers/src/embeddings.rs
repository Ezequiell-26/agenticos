#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Provider-neutral embeddings implemented against OpenAI-compatible endpoints.

use agenticos_contracts::{
    ContractError, Credential, EmbeddingProvider, EmbeddingRequest, EmbeddingResponse,
};
use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;

/// OpenAI-compatible embedding provider adapter.
#[derive(Clone, Debug)]
pub struct OpenAiCompatibleEmbeddingProvider {
    provider_id: String,
    base_url: String,
    api_key: Option<String>,
    client: Client,
}

impl OpenAiCompatibleEmbeddingProvider {
    /// Build an embedding adapter.
    pub fn new(
        provider_id: String,
        base_url: String,
        api_key: Option<String>,
    ) -> Result<Self, ContractError> {
        let base_url = base_url.trim_end_matches('/').to_string();
        if base_url.is_empty() {
            return Err(ContractError::ParseError(
                "embedding provider base URL is empty".to_string(),
            ));
        }
        Ok(Self {
            provider_id,
            base_url,
            api_key,
            client: crate::shared_http_client(),
        })
    }

    /// Build an adapter from provider metadata and an optional credential.
    pub fn from_provider(
        provider_id: &str,
        base_url: &str,
        credential: Option<&Credential>,
    ) -> Result<Self, ContractError> {
        Self::new(
            provider_id.to_string(),
            base_url.to_string(),
            credential.map(|item| item.value.clone()),
        )
    }

    fn endpoint(&self) -> String {
        if self.base_url.ends_with("/embeddings") {
            self.base_url.clone()
        } else if self.base_url.ends_with("/v1") {
            format!("{}/embeddings", self.base_url)
        } else {
            format!("{}/v1/embeddings", self.base_url)
        }
    }
}

#[async_trait]
impl EmbeddingProvider for OpenAiCompatibleEmbeddingProvider {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    async fn embed(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse, ContractError> {
        if request.request_id.trim().is_empty()
            || request.request_id.len() > 256
            || request.model.trim().is_empty()
            || request.model.len() > 256
            || request.inputs.is_empty()
            || request.inputs.len() > 128
            || request.inputs.iter().any(|input| input.len() > 256_000)
        {
            return Err(ContractError::ParseError(
                "invalid embedding request".to_string(),
            ));
        }

        let mut builder = self.client.post(self.endpoint()).json(&serde_json::json!({
            "model": request.model,
            "input": request.inputs,
        }));
        if let Some(key) = self.api_key.as_deref().filter(|value| !value.is_empty()) {
            builder = builder.bearer_auth(key);
        }

        let response = builder
            .header("x-request-id", &request.request_id)
            .send()
            .await
            .map_err(|error| {
                ContractError::ParseError(format!(
                    "embedding provider request failed for {}: {error}",
                    self.provider_id
                ))
            })?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| ContractError::ParseError(format!(
                "embedding provider response read failed: {error}"
            )))?;

        if !status.is_success() {
            return Err(ContractError::ParseError(format!(
                "embedding provider {} returned HTTP {}: {}",
                self.provider_id, status, body
            )));
        }

        #[derive(Debug, Deserialize)]
        struct Item {
            index: usize,
            embedding: Vec<f32>,
        }
        #[derive(Debug, Deserialize)]
        struct Usage {
            total_tokens: Option<u64>,
        }
        #[derive(Debug, Deserialize)]
        struct Payload {
            data: Vec<Item>,
            usage: Option<Usage>,
        }

        let payload: Payload = serde_json::from_str(&body).map_err(|error| {
            ContractError::ParseError(format!(
                "invalid embedding response from {}: {error}",
                self.provider_id
            ))
        })?;

        if payload.data.is_empty() || payload.data.len() != request.inputs.len() {
            return Err(ContractError::ParseError(format!(
                "embedding provider {} returned {} vectors for {} inputs",
                self.provider_id,
                payload.data.len(),
                request.inputs.len()
            )));
        }

        let mut embeddings = vec![Vec::new(); request.inputs.len()];
        for item in payload.data {
            if item.index >= embeddings.len() || item.embedding.is_empty() {
                return Err(ContractError::ParseError(format!(
                    "embedding provider {} returned an invalid vector index",
                    self.provider_id
                )));
            }
            embeddings[item.index] = item.embedding;
        }

        if embeddings.iter().any(Vec::is_empty) {
            return Err(ContractError::ParseError(format!(
                "embedding provider {} omitted one or more vectors",
                self.provider_id
            )));
        }

        Ok(EmbeddingResponse {
            request_id: request.request_id,
            embeddings,
            metadata: Some(format!("provider={};model={}", self.provider_id, request.model)),
            tokens_used: payload.usage.and_then(|usage| usage.total_tokens),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_embedding_endpoint() {
        let provider = OpenAiCompatibleEmbeddingProvider::new(
            "test".to_string(),
            "http://localhost:8000".to_string(),
            None,
        )
        .unwrap();
        assert_eq!(
            provider.endpoint(),
            "http://localhost:8000/v1/embeddings"
        );
    }

    #[test]
    fn preserves_v1_embedding_endpoint() {
        let provider = OpenAiCompatibleEmbeddingProvider::new(
            "test".to_string(),
            "http://localhost:8000/v1".to_string(),
            None,
        )
        .unwrap();
        assert_eq!(
            provider.endpoint(),
            "http://localhost:8000/v1/embeddings"
        );
    }
}
