//! HTTP Client (based on reqwest MIT/Apache-2.0 patterns)
//! MIT/Apache-2.0 Licensed - Easy and powerful HTTP Client for Rust
//! Source: https://github.com/seanmonstar/reqwest (11,809 stars, MIT/Apache-2.0)

use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, USER_AGENT},
    Client, Error as ReqwestError, Method, Response,
};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HttpClientError {
    #[error("Request failed: {0}")]
    RequestError(#[from] ReqwestError),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Deserialization error: {0}")]
    DeserializationError(String),
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),
    #[error("HTTP error: {0}")]
    HttpError(u16, String),
}

/// HTTP Client with configuration
pub struct HttpClient {
    client: Client,
    default_headers: HeaderMap,
}

impl HttpClient {
    /// Create new HTTP client with default settings
    pub fn new() -> Result<Self, HttpClientError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(HttpClientError::RequestError)?;

        Ok(Self {
            client,
            default_headers: HeaderMap::new(),
        })
    }

    /// Create new HTTP client with custom timeout
    pub fn with_timeout(timeout: Duration) -> Result<Self, HttpClientError> {
        let client = Client::builder()
            .timeout(timeout)
            .build()
            .map_err(HttpClientError::RequestError)?;

        Ok(Self {
            client,
            default_headers: HeaderMap::new(),
        })
    }

    /// Set default user agent
    pub fn with_user_agent(mut self, user_agent: &str) -> Result<Self, HttpClientError> {
        let value = HeaderValue::from_str(user_agent).map_err(
            |e: reqwest::header::InvalidHeaderValue| {
                HttpClientError::SerializationError(e.to_string())
            },
        )?;
        self.default_headers.insert(USER_AGENT, value);
        Ok(self)
    }

    /// Set default authorization header
    pub fn with_auth(mut self, auth: &str) -> Result<Self, HttpClientError> {
        let value =
            HeaderValue::from_str(auth).map_err(|e: reqwest::header::InvalidHeaderValue| {
                HttpClientError::SerializationError(e.to_string())
            })?;
        self.default_headers.insert(AUTHORIZATION, value);
        Ok(self)
    }

    /// Set default header
    pub fn with_header(mut self, name: &str, value: &str) -> Result<Self, HttpClientError> {
        let header_name: reqwest::header::HeaderName =
            name.parse()
                .map_err(|e: reqwest::header::InvalidHeaderName| {
                    HttpClientError::SerializationError(e.to_string())
                })?;
        let header_value =
            HeaderValue::from_str(value).map_err(|e: reqwest::header::InvalidHeaderValue| {
                HttpClientError::SerializationError(e.to_string())
            })?;
        self.default_headers.insert(header_name, header_value);
        Ok(self)
    }

    /// GET request
    pub async fn get(&self, url: &str) -> Result<Response, HttpClientError> {
        let mut request = self.client.get(url);
        for (name, value) in self.default_headers.iter() {
            request = request.header(name, value);
        }
        request.send().await.map_err(HttpClientError::RequestError)
    }

    /// POST request with JSON body
    pub async fn post<T: Serialize>(
        &self,
        url: &str,
        body: &T,
    ) -> Result<Response, HttpClientError> {
        let json = serde_json::to_string(body)
            .map_err(|e| HttpClientError::SerializationError(e.to_string()))?;

        let mut request = self
            .client
            .post(url)
            .header(CONTENT_TYPE, "application/json");
        for (name, value) in self.default_headers.iter() {
            request = request.header(name, value);
        }
        request
            .body(json)
            .send()
            .await
            .map_err(HttpClientError::RequestError)
    }

    /// PUT request with JSON body
    pub async fn put<T: Serialize>(
        &self,
        url: &str,
        body: &T,
    ) -> Result<Response, HttpClientError> {
        let json = serde_json::to_string(body)
            .map_err(|e| HttpClientError::SerializationError(e.to_string()))?;

        let mut request = self
            .client
            .put(url)
            .header(CONTENT_TYPE, "application/json");
        for (name, value) in self.default_headers.iter() {
            request = request.header(name, value);
        }
        request
            .body(json)
            .send()
            .await
            .map_err(HttpClientError::RequestError)
    }

    /// DELETE request
    pub async fn delete(&self, url: &str) -> Result<Response, HttpClientError> {
        let mut request = self.client.delete(url);
        for (name, value) in self.default_headers.iter() {
            request = request.header(name, value);
        }
        request.send().await.map_err(HttpClientError::RequestError)
    }

    /// PATCH request with JSON body
    pub async fn patch<T: Serialize>(
        &self,
        url: &str,
        body: &T,
    ) -> Result<Response, HttpClientError> {
        let json = serde_json::to_string(body)
            .map_err(|e| HttpClientError::SerializationError(e.to_string()))?;

        let mut request = self
            .client
            .patch(url)
            .header(CONTENT_TYPE, "application/json");
        for (name, value) in self.default_headers.iter() {
            request = request.header(name, value);
        }
        request
            .body(json)
            .send()
            .await
            .map_err(HttpClientError::RequestError)
    }

    /// Custom request with method
    pub async fn request(&self, method: Method, url: &str) -> Result<Response, HttpClientError> {
        let mut request = self.client.request(method, url);
        for (name, value) in self.default_headers.iter() {
            request = request.header(name, value);
        }
        request.send().await.map_err(HttpClientError::RequestError)
    }

    /// GET request and parse JSON response
    pub async fn get_json<T: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
    ) -> Result<T, HttpClientError> {
        let response = self.get(url).await?;
        self.check_status(&response)?;
        response.json().await.map_err(HttpClientError::RequestError)
    }

    /// POST request with JSON body and parse JSON response
    pub async fn post_json<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
        body: &T,
    ) -> Result<R, HttpClientError> {
        let response = self.post(url, body).await?;
        self.check_status(&response)?;
        response.json().await.map_err(HttpClientError::RequestError)
    }

    /// PUT request with JSON body and parse JSON response
    pub async fn put_json<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
        body: &T,
    ) -> Result<R, HttpClientError> {
        let response = self.put(url, body).await?;
        self.check_status(&response)?;
        response.json().await.map_err(HttpClientError::RequestError)
    }

    /// DELETE request and parse JSON response
    pub async fn delete_json<T: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
    ) -> Result<T, HttpClientError> {
        let response = self.delete(url).await?;
        self.check_status(&response)?;
        response.json().await.map_err(HttpClientError::RequestError)
    }

    /// Check response status
    fn check_status(&self, response: &Response) -> Result<(), HttpClientError> {
        let status = response.status();
        if !status.is_success() {
            return Err(HttpClientError::HttpError(
                status.as_u16(),
                status.to_string(),
            ));
        }
        Ok(())
    }

    /// Get response text
    pub async fn get_text(&self, url: &str) -> Result<String, HttpClientError> {
        let response = self.get(url).await?;
        self.check_status(&response)?;
        response.text().await.map_err(HttpClientError::RequestError)
    }

    /// Get response bytes
    pub async fn get_bytes(&self, url: &str) -> Result<Vec<u8>, HttpClientError> {
        let response = self.get(url).await?;
        self.check_status(&response)?;
        let bytes = response
            .bytes()
            .await
            .map_err(HttpClientError::RequestError)?;
        Ok(bytes.to_vec())
    }
}

impl Default for HttpClient {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| panic!("Failed to create HTTP client"))
    }
}

/// Simple GET request
pub async fn get(url: &str) -> Result<Response, HttpClientError> {
    let client = HttpClient::new()?;
    client.get(url).await
}

/// Simple POST request with JSON body
pub async fn post<T: Serialize>(url: &str, body: &T) -> Result<Response, HttpClientError> {
    let client = HttpClient::new()?;
    client.post(url, body).await
}

/// Simple GET request and parse JSON
pub async fn get_json<T: for<'de> Deserialize<'de>>(url: &str) -> Result<T, HttpClientError> {
    let client = HttpClient::new()?;
    client.get_json(url).await
}

/// Simple POST request with JSON body and parse JSON
pub async fn post_json<T: Serialize, R: for<'de> Deserialize<'de>>(
    url: &str,
    body: &T,
) -> Result<R, HttpClientError> {
    let client = HttpClient::new()?;
    client.post_json(url, body).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_http_client_creation() {
        let client = HttpClient::new();
        assert!(client.is_ok());
    }

    #[test]
    fn test_http_client_with_timeout() {
        let client = HttpClient::with_timeout(Duration::from_secs(60));
        assert!(client.is_ok());
    }

    #[test]
    fn test_http_client_with_user_agent() {
        let client = HttpClient::new().and_then(|c| c.with_user_agent("test-agent"));
        assert!(client.is_ok());
    }

    #[test]
    fn test_http_client_with_auth() {
        let client = HttpClient::new().and_then(|c| c.with_auth("Bearer token"));
        assert!(client.is_ok());
    }

    #[test]
    fn test_http_client_with_header() {
        let client = HttpClient::new().and_then(|c| c.with_header("X-Custom", "value"));
        assert!(client.is_ok());
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct TestData {
        name: String,
        value: i32,
    }

    #[test]
    fn test_serialization() {
        let data = TestData {
            name: "test".to_string(),
            value: 42,
        };
        let json = serde_json::to_string(&data);
        assert!(json.is_ok());
    }
}
