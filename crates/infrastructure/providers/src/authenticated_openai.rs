use super::{
    normalize_chat_url, openai_chat_message_content, shared_http_client, StreamUsageRecorder,
};
use agenticos_contracts::{ContractError, ModelProvider, ModelRequest, ModelResponse};
use futures::StreamExt;

struct AuthenticatedOpenAiProvider {
    provider_id: String,
    base_url: String,
    api_key: Option<String>,
    client: reqwest::Client,
}

impl AuthenticatedOpenAiProvider {
    fn new(
        provider_id: String,
        base_url: String,
        api_key: Option<String>,
    ) -> Result<Self, ContractError> {
        let client = shared_http_client();
        Ok(Self {
            provider_id,
            base_url: normalize_chat_url(&base_url),
            api_key,
            client,
        })
    }
}

impl AuthenticatedOpenAiProvider {
    async fn list_models(&self) -> Result<Vec<String>, ContractError> {
        let mut request = self.client.get(self.models_url());
        if let Some(api_key) = &self.api_key {
            request = request.bearer_auth(api_key);
        }
        let response = request.send().await.map_err(|error| {
            ContractError::ParseError(format!("provider model discovery failed: {error}"))
        })?;
        let status = response.status();
        let body = response.text().await.map_err(|error| {
            ContractError::ParseError(format!("provider model discovery response failed: {error}"))
        })?;
        if !status.is_success() {
            return Err(ContractError::ParseError(format!(
                "provider_http_status={}; model discovery returned HTTP {status}: {body}",
                status.as_u16()
            )));
        }

        let json: serde_json::Value = serde_json::from_str(&body).map_err(|error| {
            ContractError::ParseError(format!("invalid provider model catalog: {error}"))
        })?;
        let values = json
            .get("data")
            .and_then(|value| value.as_array())
            .cloned()
            .or_else(|| json.as_array().cloned())
            .ok_or_else(|| {
                ContractError::ParseError(
                    "provider model catalog response has no data array".to_string(),
                )
            })?;

        Ok(values
            .iter()
            .filter_map(|item| item.get("id").and_then(|value| value.as_str()))
            .map(ToOwned::to_owned)
            .collect())
    }

    fn models_url(&self) -> String {
        if self.base_url.ends_with("/chat/completions") {
            return self
                .base_url
                .trim_end_matches("/chat/completions")
                .to_string()
                + "/models";
        }
        if self.base_url.ends_with("/v1") {
            return self.base_url.clone() + "/models";
        }
        self.base_url
            .clone()
            .replace("/chat/completions", "/models")
    }

    /// Stream an OpenAI-compatible chat completion as normalized text deltas.
    pub async fn stream(
        &self,
        request: ModelRequest,
        usage_recorder: Option<StreamUsageRecorder>,
    ) -> Result<
        std::pin::Pin<Box<dyn futures::Stream<Item = Result<String, ContractError>> + Send>>,
        ContractError,
    > {
        let request_id = request.request_id.clone();
        let mut payload = serde_json::json!({
            "model": request.model,
            "messages": [{
                "role": "user",
                "content": openai_chat_message_content(&request.input, request.parameters.as_deref())?,
            }],
            "stream": true,
        });

        if let Some(parameters) = &request.parameters {
            let extra = serde_json::from_str::<serde_json::Value>(parameters).map_err(|error| {
                ContractError::ParseError(format!(
                    "provider parameters must be valid JSON: {error}"
                ))
            })?;
            let extra_object = extra.as_object().ok_or_else(|| {
                ContractError::ParseError("provider parameters must be a JSON object".to_string())
            })?;
            let payload_object = payload.as_object_mut().ok_or_else(|| {
                ContractError::ParseError("provider request payload is not an object".to_string())
            })?;
            for (key, value) in extra_object {
                if !matches!(key.as_str(), "model" | "messages" | "stream" | "request_id") {
                    payload_object.insert(key.clone(), value.clone());
                }
            }
        }

        let mut request_builder = self
            .client
            .post(&self.base_url)
            .header("x-request-id", &request_id)
            .json(&payload);
        if let Some(api_key) = &self.api_key {
            request_builder = request_builder.bearer_auth(api_key);
        }
        let response = request_builder.send().await.map_err(|error| {
            ContractError::ParseError(format!("provider stream request failed: {error}"))
        })?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "failed to read provider streaming error response".to_string());
            let mut detail = body;
            if detail.len() > 4_096 {
                detail.truncate(4_096);
                detail.push_str("...");
            }
            return Err(ContractError::ParseError(format!(
                "provider_http_status={}; provider stream returned HTTP {status}: {detail}",
                status.as_u16()
            )));
        }

        let provider_id = self.provider_id.clone();
        let mut bytes_stream = response.bytes_stream();
        let stream = async_stream::try_stream! {
            use futures::StreamExt;

            let mut buffer = String::new();
            let mut usage_recorded = false;
            while let Some(next) = bytes_stream.next().await {
                let chunk = next.map_err(|error| {
                    ContractError::ParseError(format!(
                        "provider stream transport failed for {provider_id}: {error}"
                    ))
                })?;
                buffer.push_str(&String::from_utf8_lossy(&chunk));

                while let Some(newline) = buffer.find('\n') {
                    let line = buffer[..newline].trim_end_matches('\r').to_string();
                    buffer.drain(..=newline);

                    let Some(data) = line.strip_prefix("data:") else {
                        continue;
                    };
                    let data = data.trim();
                    if data.is_empty() {
                        continue;
                    }
                    if data == "[DONE]" {
                        yield "[DONE]".to_string();
                        continue;
                    }

                    let json = serde_json::from_str::<serde_json::Value>(data).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid provider stream chunk for {provider_id}: {error}"
                        ))
                    })?;

                    if !usage_recorded {
                        if let Some(usage) = json.get("usage") {
                            let input_tokens = usage
                                .get("prompt_tokens")
                                .and_then(|value| value.as_u64())
                                .unwrap_or(0);
                            let output_tokens = usage
                                .get("completion_tokens")
                                .and_then(|value| value.as_u64())
                                .unwrap_or(0);
                            let total_tokens = usage
                                .get("total_tokens")
                                .and_then(|value| value.as_u64())
                                .unwrap_or_else(|| input_tokens.saturating_add(output_tokens));
                            if total_tokens > 0 {
                                if let Some(recorder) = &usage_recorder {
                                    recorder
                                        .record(input_tokens, output_tokens, total_tokens)
                                        .await;
                                }
                                usage_recorded = true;
                            }
                        }
                    }
                    if let Some(delta) = json
                        .get("choices")
                        .and_then(|value| value.as_array())
                        .and_then(|choices| choices.first())
                        .and_then(|choice| choice.get("delta"))
                        .and_then(|delta| delta.get("content"))
                        .and_then(|content| content.as_str())
                    {
                        if !delta.is_empty() {
                            yield delta.to_string();
                        }
                    }
                    if json
                        .get("choices")
                        .and_then(|value| value.as_array())
                        .and_then(|choices| choices.first())
                        .and_then(|choice| choice.get("finish_reason"))
                        .and_then(|value| value.as_str())
                        .is_some()
                    {
                        yield "[DONE]".to_string();
                    }
                }
            }

            if !buffer.trim().is_empty() {
                for line in buffer.lines() {
                    let data = line.trim().strip_prefix("data:").map(str::trim);
                    if let Some(data) = data.filter(|value| !value.is_empty() && *value != "[DONE]") {
                        let json = serde_json::from_str::<serde_json::Value>(data).map_err(|error| {
                            ContractError::ParseError(format!(
                                "invalid trailing provider stream chunk for {provider_id}: {error}"
                            ))
                        })?;
                        if !usage_recorded {
                            if let Some(usage) = json.get("usage") {
                                let input_tokens = usage
                                    .get("prompt_tokens")
                                    .and_then(|value| value.as_u64())
                                    .unwrap_or(0);
                                let output_tokens = usage
                                    .get("completion_tokens")
                                    .and_then(|value| value.as_u64())
                                    .unwrap_or(0);
                                let total_tokens = usage
                                    .get("total_tokens")
                                    .and_then(|value| value.as_u64())
                                    .unwrap_or_else(|| input_tokens.saturating_add(output_tokens));
                                if total_tokens > 0 {
                                    if let Some(recorder) = &usage_recorder {
                                        recorder
                                            .record(input_tokens, output_tokens, total_tokens)
                                            .await;
                                    }
                                    usage_recorded = true;
                                }
                            }
                        }
                        if let Some(delta) = json
                            .get("choices")
                            .and_then(|value| value.as_array())
                            .and_then(|choices| choices.first())
                            .and_then(|choice| choice.get("delta"))
                            .and_then(|delta| delta.get("content"))
                            .and_then(|content| content.as_str())
                        {
                            if !delta.is_empty() {
                                yield delta.to_string();
                            }
                        }
                    }
                }
            }

            yield "[DONE]".to_string();
        };

        Ok(Box::pin(stream))
    }
}

#[async_trait::async_trait]
impl ModelProvider for AuthenticatedOpenAiProvider {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        let request_id = request.request_id.clone();
        let mut payload = serde_json::json!({
            "model": request.model,
            "messages": [{"role": "user", "content": request.input}],
            "stream": false
        });

        if let Some(parameters) = &request.parameters {
            let extra = serde_json::from_str::<serde_json::Value>(parameters).map_err(|error| {
                ContractError::ParseError(format!(
                    "provider parameters must be valid JSON: {error}"
                ))
            })?;
            let extra_object = extra.as_object().ok_or_else(|| {
                ContractError::ParseError("provider parameters must be a JSON object".to_string())
            })?;
            let payload_object = payload.as_object_mut().ok_or_else(|| {
                ContractError::ParseError("provider request payload is not an object".to_string())
            })?;
            for (key, value) in extra_object {
                if !matches!(key.as_str(), "model" | "messages" | "stream" | "request_id") {
                    payload_object.insert(key.clone(), value.clone());
                }
            }
        }

        let mut request_builder = self
            .client
            .post(&self.base_url)
            .header("x-request-id", &request_id)
            .json(&payload);
        if let Some(api_key) = &self.api_key {
            request_builder = request_builder.bearer_auth(api_key);
        }
        let response = request_builder.send().await.map_err(|error| {
            ContractError::ParseError(format!("provider request failed: {error}"))
        })?;

        let status = response.status();
        let body = response.text().await.map_err(|error| {
            ContractError::ParseError(format!("provider response failed: {error}"))
        })?;
        if !status.is_success() {
            let mut detail = body;
            if detail.len() > 4_096 {
                detail.truncate(4_096);
                detail.push_str("...");
            }
            return Err(ContractError::ParseError(format!(
                "provider_http_status={}; provider returned HTTP {status}: {detail}",
                status.as_u16()
            )));
        }
        let json: serde_json::Value = serde_json::from_str(&body).map_err(|error| {
            ContractError::ParseError(format!("invalid provider response: {error}"))
        })?;
        let output = json
            .get("choices")
            .and_then(|value| value.as_array())
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_str())
            .filter(|content| !content.trim().is_empty())
            .or_else(|| json.get("output").and_then(|value| value.as_str()))
            .ok_or_else(|| {
                ContractError::ParseError("provider response has no text output".to_string())
            })?;
        Ok(ModelResponse {
            request_id,
            output: output.to_string(),
            metadata: Some(format!("provider={}", self.provider_id)),
            tokens_used: json
                .get("usage")
                .and_then(|usage| usage.get("total_tokens"))
                .and_then(|v| v.as_u64()),
        })
    }
}

