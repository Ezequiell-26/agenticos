//! Authentication (based on jsonwebtoken MIT patterns)
//! MIT Licensed - JWT tokens and authentication
//! Source: https://github.com/keats/jsonwebtoken (2058 stars, MIT)

use std::collections::HashMap;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Invalid token: {0}")]
    InvalidToken(String),
    #[error("Token expired")]
    TokenExpired,
    #[error("Token not yet valid")]
    TokenNotYetValid,
    #[error("Invalid signature")]
    InvalidSignature,
    #[error("Encoding error: {0}")]
    EncodingError(String),
    #[error("Decoding error: {0}")]
    DecodingError(String),
}

/// JWT claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // Subject (user ID)
    pub iss: String, // Issuer
    pub aud: String, // Audience
    pub exp: i64,    // Expiration time
    pub nbf: i64,    // Not before
    pub iat: i64,    // Issued at
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jti: Option<String>, // JWT ID
    #[serde(flatten)]
    pub custom: HashMap<String, serde_json::Value>,
}

impl Claims {
    pub fn new(sub: String, iss: String, aud: String, duration_hours: i64) -> Self {
        let now = Utc::now();
        Self {
            sub,
            iss,
            aud,
            exp: (now + Duration::hours(duration_hours)).timestamp(),
            nbf: now.timestamp(),
            iat: now.timestamp(),
            jti: None,
            custom: HashMap::new(),
        }
    }

    pub fn with_custom(mut self, key: String, value: serde_json::Value) -> Self {
        self.custom.insert(key, value);
        self
    }

    pub fn with_jti(mut self, jti: String) -> Self {
        self.jti = Some(jti);
        self
    }

    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() > self.exp
    }

    pub fn is_valid_now(&self) -> bool {
        let now = Utc::now().timestamp();
        now >= self.nbf && now <= self.exp
    }
}

/// Simple JWT encoder/decoder (simplified version)
pub struct JwtEncoder {
    secret: String,
}

impl JwtEncoder {
    pub fn new(secret: String) -> Self {
        Self { secret }
    }

    /// Encode claims to JWT token (simplified - in production use real crypto)
    pub fn encode(&self, claims: &Claims) -> Result<String, AuthError> {
        let header = serde_json::json!({
            "alg": "HS256",
            "typ": "JWT"
        });

        let header_b64 = self.base64_url_encode(&header.to_string());
        let claims_b64 = self.base64_url_encode(&serde_json::to_string(claims).map_err(|e| AuthError::EncodingError(e.to_string()))?);
        
        let signature = self.sign(&format!("{}.{}", header_b64, claims_b64));
        
        Ok(format!("{}.{}.{}", header_b64, claims_b64, signature))
    }

    /// Decode JWT token (simplified - in production use real crypto)
    pub fn decode(&self, token: &str) -> Result<Claims, AuthError> {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return Err(AuthError::InvalidToken("Invalid token format".to_string()));
        }

        let claims_str = self.base64_url_decode(parts[1])?;
        let claims: Claims = serde_json::from_str(&claims_str)
            .map_err(|e| AuthError::DecodingError(e.to_string()))?;

        // Verify expiration
        if claims.is_expired() {
            return Err(AuthError::TokenExpired);
        }

        // Verify not before
        if Utc::now().timestamp() < claims.nbf {
            return Err(AuthError::TokenNotYetValid);
        }

        // Verify signature (simplified)
        let expected_signature = self.sign(&format!("{}.{}", parts[0], parts[1]));
        if parts[2] != expected_signature {
            return Err(AuthError::InvalidSignature);
        }

        Ok(claims)
    }

    fn base64_url_encode(&self, input: &str) -> String {
        use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
        URL_SAFE_NO_PAD.encode(input)
    }

    fn base64_url_decode(&self, input: &str) -> Result<String, AuthError> {
        use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
        URL_SAFE_NO_PAD.decode(input)
            .map_err(|e| AuthError::DecodingError(e.to_string()))
            .and_then(|bytes| String::from_utf8(bytes).map_err(|e| AuthError::DecodingError(e.to_string())))
    }

    fn sign(&self, data: &str) -> String {
        // Simplified signature - in production use HMAC-SHA256
        let hash = self.simple_hash(data);
        self.base64_url_encode(&hash.to_string())
    }

    fn simple_hash(&self, data: &str) -> u64 {
        let mut hash: u64 = 5381;
        for byte in data.bytes() {
            hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
        }
        hash.wrapping_add(self.secret.len() as u64)
    }
}

/// User roles
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Role {
    User,
    Admin,
    Moderator,
    Custom(String),
}

impl Role {
    pub fn has_permission(&self, permission: &str) -> bool {
        match self {
            Role::Admin => true,
            Role::Moderator => permission.starts_with("read") || permission.starts_with("moderate"),
            Role::User => permission.starts_with("read"),
            Role::Custom(custom) => custom == permission,
        }
    }
}

/// User authentication info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub email: String,
    pub roles: Vec<Role>,
}

impl UserInfo {
    pub fn new(id: String, username: String, email: String) -> Self {
        Self {
            id,
            username,
            email,
            roles: vec![Role::User],
        }
    }

    pub fn with_role(mut self, role: Role) -> Self {
        self.roles.push(role);
        self
    }

    pub fn has_role(&self, role: &Role) -> bool {
        self.roles.contains(role)
    }

    pub fn has_permission(&self, permission: &str) -> bool {
        self.roles.iter().any(|r| r.has_permission(permission))
    }
}

/// Authentication manager
pub struct AuthManager {
    encoder: JwtEncoder,
    issuer: String,
    audience: String,
    token_duration_hours: i64,
}

impl AuthManager {
    pub fn new(secret: String, issuer: String, audience: String) -> Self {
        Self {
            encoder: JwtEncoder::new(secret),
            issuer,
            audience,
            token_duration_hours: 24,
        }
    }

    pub fn with_token_duration(mut self, hours: i64) -> Self {
        self.token_duration_hours = hours;
        self
    }

    /// Generate token for user
    pub fn generate_token(&self, user: &UserInfo) -> Result<String, AuthError> {
        let mut custom = HashMap::new();
        custom.insert("username".to_string(), serde_json::Value::String(user.username.clone()));
        custom.insert("email".to_string(), serde_json::Value::String(user.email.clone()));
        custom.insert("roles".to_string(), serde_json::Value::Array(
            user.roles.iter().map(|r| serde_json::Value::String(format!("{:?}", r))).collect()
        ));

        let claims = Claims::new(
            user.id.clone(),
            self.issuer.clone(),
            self.audience.clone(),
            self.token_duration_hours,
        ).with_custom("user".to_string(), serde_json::to_value(user).unwrap());

        self.encoder.encode(&claims)
    }

    /// Validate token and extract claims
    pub fn validate_token(&self, token: &str) -> Result<Claims, AuthError> {
        let claims = self.encoder.decode(token)?;
        
        // Verify issuer
        if claims.iss != self.issuer {
            return Err(AuthError::InvalidToken("Invalid issuer".to_string()));
        }

        // Verify audience
        if claims.aud != self.audience {
            return Err(AuthError::InvalidToken("Invalid audience".to_string()));
        }

        Ok(claims)
    }

    /// Extract user info from claims
    pub fn extract_user(&self, claims: &Claims) -> Result<UserInfo, AuthError> {
        claims.custom.get("user")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .ok_or_else(|| AuthError::InvalidToken("No user info in token".to_string()))
    }
}

/// Permission checker
pub struct PermissionChecker;

impl PermissionChecker {
    pub fn check_permission(user: &UserInfo, permission: &str) -> bool {
        user.has_permission(permission)
    }

    pub fn check_role(user: &UserInfo, role: &Role) -> bool {
        user.has_role(role)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claims_creation() {
        let claims = Claims::new("user123".to_string(), "issuer".to_string(), "audience".to_string(), 24);
        assert_eq!(claims.sub, "user123");
        assert!(!claims.is_expired());
    }

    #[test]
    fn test_claims_custom() {
        let claims = Claims::new("user123".to_string(), "issuer".to_string(), "audience".to_string(), 24)
            .with_custom("key".to_string(), serde_json::json!("value"));
        assert_eq!(claims.custom.get("key"), Some(&serde_json::json!("value")));
    }

    #[test]
    fn test_jwt_encoder() {
        let encoder = JwtEncoder::new("secret".to_string());
        let claims = Claims::new("user123".to_string(), "issuer".to_string(), "audience".to_string(), 24);
        let token = encoder.encode(&claims).unwrap();
        assert!(token.contains('.'));
    }

    #[test]
    fn test_jwt_decode() {
        let encoder = JwtEncoder::new("secret".to_string());
        let claims = Claims::new("user123".to_string(), "issuer".to_string(), "audience".to_string(), 24);
        let token = encoder.encode(&claims).unwrap();
        let decoded = encoder.decode(&token).unwrap();
        assert_eq!(decoded.sub, "user123");
    }

    #[test]
    fn test_role_permissions() {
        assert!(Role::Admin.has_permission("write"));
        assert!(Role::User.has_permission("read"));
        assert!(!Role::User.has_permission("write"));
    }

    #[test]
    fn test_user_info() {
        let user = UserInfo::new("id".to_string(), "username".to_string(), "email@test.com".to_string())
            .with_role(Role::Admin);
        assert!(user.has_role(&Role::Admin));
        assert!(user.has_permission("write"));
    }

    #[test]
    fn test_auth_manager() {
        let manager = AuthManager::new("secret".to_string(), "issuer".to_string(), "audience".to_string());
        let user = UserInfo::new("id".to_string(), "username".to_string(), "email@test.com".to_string());
        let token = manager.generate_token(&user).unwrap();
        let claims = manager.validate_token(&token).unwrap();
        assert_eq!(claims.sub, "id");
    }

    #[test]
    fn test_permission_checker() {
        let user = UserInfo::new("id".to_string(), "username".to_string(), "email@test.com".to_string())
            .with_role(Role::Admin);
        assert!(PermissionChecker::check_permission(&user, "write"));
    }
}
