//! Configuration (based on config-rs MIT patterns)
//! MIT Licensed - Layered configuration system
//! Source: https://github.com/rust-cli/config-rs (3192 stars, MIT/Apache-2.0)

use std::collections::HashMap;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Key not found: {0}")]
    KeyNotFound(String),
    #[error("Type error: {0}")]
    TypeError(String),
}

/// Configuration value
#[derive(Clone, Debug)]
pub enum ConfigValue {
    String(String),
    Integer(i64),
    Float(f64),
    Boolean(bool),
    Array(Vec<ConfigValue>),
    Table(HashMap<String, ConfigValue>),
}

impl ConfigValue {
    pub fn as_string(&self) -> Result<&String, ConfigError> {
        match self {
            ConfigValue::String(s) => Ok(s),
            _ => Err(ConfigError::TypeError("Expected string".to_string())),
        }
    }

    pub fn as_integer(&self) -> Result<i64, ConfigError> {
        match self {
            ConfigValue::Integer(i) => Ok(*i),
            _ => Err(ConfigError::TypeError("Expected integer".to_string())),
        }
    }

    pub fn as_float(&self) -> Result<f64, ConfigError> {
        match self {
            ConfigValue::Float(f) => Ok(*f),
            _ => Err(ConfigError::TypeError("Expected float".to_string())),
        }
    }

    pub fn as_boolean(&self) -> Result<bool, ConfigError> {
        match self {
            ConfigValue::Boolean(b) => Ok(*b),
            _ => Err(ConfigError::TypeError("Expected boolean".to_string())),
        }
    }

    pub fn as_array(&self) -> Result<&Vec<ConfigValue>, ConfigError> {
        match self {
            ConfigValue::Array(a) => Ok(a),
            _ => Err(ConfigError::TypeError("Expected array".to_string())),
        }
    }

    pub fn as_table(&self) -> Result<&HashMap<String, ConfigValue>, ConfigError> {
        match self {
            ConfigValue::Table(t) => Ok(t),
            _ => Err(ConfigError::TypeError("Expected table".to_string())),
        }
    }
}

/// Configuration layer
#[derive(Clone, Debug)]
pub enum ConfigLayer {
    File(PathBuf),
    Environment,
    CommandLine(HashMap<String, String>),
    Memory(HashMap<String, ConfigValue>),
}

/// Configuration manager
pub struct Config {
    layers: Vec<ConfigLayer>,
    cache: HashMap<String, ConfigValue>,
}

impl Config {
    pub fn new() -> Self {
        Self {
            layers: Vec::new(),
            cache: HashMap::new(),
        }
    }

    /// Add configuration layer
    pub fn add_layer(&mut self, layer: ConfigLayer) {
        self.layers.push(layer);
        self.cache.clear(); // Invalidate cache
    }

    /// Add file layer
    pub fn add_file(&mut self, path: PathBuf) -> Result<(), ConfigError> {
        let content = std::fs::read_to_string(&path)?;
        let table: toml::Value =
            toml::from_str(&content).map_err(|e| ConfigError::ParseError(e.to_string()))?;

        let mut config_map = HashMap::new();
        if let toml::Value::Table(table) = table {
            for (key, value) in table {
                config_map.insert(key, self.toml_to_config(value));
            }
        }

        self.add_layer(ConfigLayer::Memory(config_map));
        Ok(())
    }

    /// Add environment layer
    pub fn add_environment(&mut self) {
        self.add_layer(ConfigLayer::Environment);
    }

    /// Add command line layer
    pub fn add_command_line(&mut self, args: HashMap<String, String>) {
        self.add_layer(ConfigLayer::CommandLine(args));
    }

    /// Get configuration value
    pub fn get(&mut self, key: &str) -> Result<ConfigValue, ConfigError> {
        // Check cache first
        if let Some(value) = self.cache.get(key) {
            return Ok(value.clone());
        }

        // Search layers in reverse order (last added has highest priority)
        for layer in self.layers.iter().rev() {
            if let Some(value) = self.get_from_layer(layer, key) {
                self.cache.insert(key.to_string(), value.clone());
                return Ok(value);
            }
        }

        Err(ConfigError::KeyNotFound(key.to_string()))
    }

    /// Get string value
    pub fn get_string(&mut self, key: &str) -> Result<String, ConfigError> {
        self.get(key)?.as_string().cloned()
    }

    /// Get integer value
    pub fn get_integer(&mut self, key: &str) -> Result<i64, ConfigError> {
        self.get(key)?.as_integer()
    }

    /// Get float value
    pub fn get_float(&mut self, key: &str) -> Result<f64, ConfigError> {
        self.get(key)?.as_float()
    }

    /// Get boolean value
    pub fn get_boolean(&mut self, key: &str) -> Result<bool, ConfigError> {
        self.get(key)?.as_boolean()
    }

    /// Get with default
    pub fn get_or<T>(&mut self, key: &str, default: T) -> T
    where
        T: TryFrom<ConfigValue, Error = ()>,
    {
        self.get(key)
            .ok()
            .and_then(|v| T::try_from(v).ok())
            .unwrap_or(default)
    }

    /// Set value in memory layer
    pub fn set(&mut self, key: String, value: ConfigValue) {
        // Find or create memory layer
        if !self
            .layers
            .iter()
            .any(|l| matches!(l, ConfigLayer::Memory(_)))
        {
            self.layers.push(ConfigLayer::Memory(HashMap::new()));
        }

        if let Some(ConfigLayer::Memory(ref mut map)) = self.layers.iter_mut().last() {
            map.insert(key, value);
            self.cache.clear();
        }
    }

    /// Clear cache
    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }

    /// Get all keys
    pub fn keys(&self) -> Vec<String> {
        let mut keys = Vec::new();
        for layer in &self.layers {
            if let ConfigLayer::Memory(map) = layer {
                keys.extend(map.keys().cloned());
            }
        }
        keys
    }

    fn get_from_layer(&self, layer: &ConfigLayer, key: &str) -> Option<ConfigValue> {
        match layer {
            ConfigLayer::Memory(map) => map.get(key).cloned(),
            ConfigLayer::Environment => std::env::var(key).ok().map(|v| ConfigValue::String(v)),
            ConfigLayer::CommandLine(args) => {
                args.get(key).cloned().map(|v| ConfigValue::String(v))
            }
            ConfigLayer::File(_) => None, // Files are loaded into Memory layer
        }
    }

    fn toml_to_config(&self, value: toml::Value) -> ConfigValue {
        match value {
            toml::Value::String(s) => ConfigValue::String(s),
            toml::Value::Integer(i) => ConfigValue::Integer(i),
            toml::Value::Float(f) => ConfigValue::Float(f),
            toml::Value::Boolean(b) => ConfigValue::Boolean(b),
            toml::Value::Array(arr) => {
                ConfigValue::Array(arr.into_iter().map(|v| self.toml_to_config(v)).collect())
            }
            toml::Value::Table(table) => ConfigValue::Table(
                table
                    .into_iter()
                    .map(|(k, v)| (k, self.toml_to_config(v)))
                    .collect(),
            ),
            _ => ConfigValue::String(value.to_string()),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self::new()
    }
}

/// Configuration builder
pub struct ConfigBuilder {
    config: Config,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        Self {
            config: Config::new(),
        }
    }

    pub fn with_file(mut self, path: PathBuf) -> Result<Self, ConfigError> {
        self.config.add_file(path)?;
        Ok(self)
    }

    pub fn with_environment(mut self) -> Self {
        self.config.add_environment();
        self
    }

    pub fn with_command_line(mut self, args: HashMap<String, String>) -> Self {
        self.config.add_command_line(args);
        self
    }

    pub fn build(self) -> Config {
        self.config
    }
}

impl Default for ConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_value_string() {
        let value = ConfigValue::String("test".to_string());
        assert_eq!(value.as_string().unwrap(), "test");
    }

    #[test]
    fn test_config_value_integer() {
        let value = ConfigValue::Integer(42);
        assert_eq!(value.as_integer().unwrap(), 42);
    }

    #[test]
    fn test_config_new() {
        let config = Config::new();
        assert!(config.layers.is_empty());
    }

    #[test]
    fn test_config_set_get() {
        let mut config = Config::new();
        config.set("key".to_string(), ConfigValue::String("value".to_string()));
        let value = config.get("key").unwrap();
        assert_eq!(value.as_string().unwrap(), "value");
    }

    #[test]
    fn test_config_get_string() {
        let mut config = Config::new();
        config.set("key".to_string(), ConfigValue::String("value".to_string()));
        assert_eq!(config.get_string("key").unwrap(), "value");
    }

    #[test]
    fn test_config_get_or() {
        let mut config = Config::new();
        assert_eq!(config.get_or("missing", "default"), "default");
    }

    #[test]
    fn test_config_builder() {
        let builder = ConfigBuilder::new()
            .with_environment()
            .with_command_line(HashMap::new());
        let config = builder.build();
        assert!(!config.layers.is_empty());
    }
}
