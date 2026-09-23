//! Cryptography (based on rscrypto MIT/Apache-2.0 patterns)
//! MIT/Apache-2.0 Licensed - Pure Rust cryptography with zero default deps
//! Source: https://github.com/loadingalias/rscrypto (35 stars, MIT/Apache-2.0)

#![allow(clippy::should_implement_trait, clippy::manual_range_contains)]

use thiserror::Error;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Encryption error: {0}")]
    EncryptionError(String),
    #[error("Decryption error: {0}")]
    DecryptionError(String),
    #[error("Key generation error: {0}")]
    KeyGenerationError(String),
    #[error("Invalid key")]
    InvalidKey,
}

/// Simple symmetric encryption (XOR-based for demonstration)
/// In production, use proper AES-GCM from rscrypto
pub struct SimpleCipher {
    key: Vec<u8>,
}

impl SimpleCipher {
    /// Create new cipher with key
    pub fn new(key: Vec<u8>) -> Result<Self, CryptoError> {
        if key.is_empty() {
            return Err(CryptoError::InvalidKey);
        }
        Ok(Self { key })
    }

    /// Encrypt data
    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>, CryptoError> {
        let mut encrypted = Vec::with_capacity(data.len());
        for (i, byte) in data.iter().enumerate() {
            let key_byte = self.key[i % self.key.len()];
            encrypted.push(byte ^ key_byte);
        }
        Ok(encrypted)
    }

    /// Decrypt data
    pub fn decrypt(&self, encrypted: &[u8]) -> Result<Vec<u8>, CryptoError> {
        let mut decrypted = Vec::with_capacity(encrypted.len());
        for (i, byte) in encrypted.iter().enumerate() {
            let key_byte = self.key[i % self.key.len()];
            decrypted.push(byte ^ key_byte);
        }
        Ok(decrypted)
    }

    /// Generate random key
    pub fn generate_key(length: usize) -> Vec<u8> {
        use std::time::{SystemTime, UNIX_EPOCH};
        let mut key = Vec::with_capacity(length);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64;

        for i in 0..length {
            key.push(((timestamp >> (i * 8)) & 0xFF) as u8);
        }
        key
    }
}

/// Hash function (simple SHA-256-like simulation)
/// In production, use proper SHA-256 from rscrypto
pub struct Hasher {
    state: [u64; 8],
}

impl Hasher {
    pub fn new() -> Self {
        Self {
            state: [
                0x6a09e667f3bcc908,
                0xbb67ae8584caa73b,
                0x3c6ef372fe94f82b,
                0xa54ff53a5f1d36f1,
                0x510e527fade682d1,
                0x9b05688c2b3e6c1f,
                0x1f83d9abfb41bd6b,
                0x5be0cd19137e2179,
            ],
        }
    }

    pub fn update(&mut self, data: &[u8]) {
        for byte in data {
            let index = (byte % 8) as usize;
            self.state[index] = self.state[index].wrapping_add(*byte as u64);
        }
    }

    pub fn finalize(self) -> [u8; 32] {
        let mut hash = [0u8; 32];
        for (i, state) in self.state.iter().enumerate() {
            let bytes = state.to_le_bytes();
            hash[i * 4..(i * 4 + 8)].copy_from_slice(&bytes);
        }
        hash
    }
}

impl Default for Hasher {
    fn default() -> Self {
        Self::new()
    }
}

/// Hash data
pub fn hash(data: &[u8]) -> [u8; 32] {
    let mut hasher = Hasher::new();
    hasher.update(data);
    hasher.finalize()
}

/// Key pair for asymmetric encryption (simplified)
/// In production, use proper Ed25519/X25519 from rscrypto
pub struct KeyPair {
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
}

impl KeyPair {
    /// Generate new key pair
    pub fn generate() -> Result<Self, CryptoError> {
        let seed = SimpleCipher::generate_key(32);
        let public_key = hash(&seed).to_vec();
        let private_key = seed;

        Ok(Self {
            public_key,
            private_key,
        })
    }

    /// Sign data (simplified HMAC-like)
    pub fn sign(&self, data: &[u8]) -> Result<Vec<u8>, CryptoError> {
        let mut signature = Vec::with_capacity(32);
        for (i, byte) in data.iter().enumerate() {
            let key_byte = self.private_key[i % self.private_key.len()];
            signature.push(byte.wrapping_add(key_byte));
        }
        Ok(signature)
    }

    /// Verify signature (simplified)
    pub fn verify(&self, data: &[u8], signature: &[u8]) -> bool {
        let mut expected = Vec::with_capacity(signature.len());
        for (i, byte) in data.iter().enumerate() {
            let key_byte = self.private_key[i % self.private_key.len()];
            expected.push(byte.wrapping_add(key_byte));
        }
        signature == expected.as_slice()
    }
}

/// Random number generator
pub struct Rng {
    state: u64,
}

impl Rng {
    pub fn new() -> Self {
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64;
        Self { state: timestamp }
    }

    pub fn next(&mut self) -> u64 {
        self.state = self.state.wrapping_mul(1103515245).wrapping_add(12345);
        self.state
    }

    pub fn next_bytes(&mut self, length: usize) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(length);
        for _ in 0..length {
            let value = self.next();
            bytes.push((value & 0xFF) as u8);
        }
        bytes
    }

    pub fn next_range(&mut self, min: u64, max: u64) -> u64 {
        let range = max - min;
        (self.next() % range) + min
    }
}

impl Default for Rng {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_cipher() {
        let key = SimpleCipher::generate_key(16);
        let cipher = SimpleCipher::new(key).unwrap();

        let plaintext = b"hello world";
        let encrypted = cipher.encrypt(plaintext).unwrap();
        let decrypted = cipher.decrypt(&encrypted).unwrap();

        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test]
    fn test_hash() {
        let data = b"test data";
        let hash1 = hash(data);
        let hash2 = hash(data);

        assert_eq!(hash1, hash2);

        let different_data = b"different";
        let hash3 = hash(different_data);

        assert_ne!(hash1, hash3);
    }

    #[test]
    fn test_key_pair() {
        let keypair = KeyPair::generate().unwrap();

        let data = b"test message";
        let signature = keypair.sign(data).unwrap();

        assert!(keypair.verify(data, &signature));

        let fake_data = b"fake message";
        assert!(!keypair.verify(fake_data, &signature));
    }

    #[test]
    fn test_rng() {
        let mut rng = Rng::new();

        let value1 = rng.next();
        let value2 = rng.next();

        assert_ne!(value1, value2);

        let bytes = rng.next_bytes(10);
        assert_eq!(bytes.len(), 10);

        let ranged = rng.next_range(10, 20);
        assert!(ranged >= 10 && ranged < 20);
    }
}
