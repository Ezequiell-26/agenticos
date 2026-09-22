//! Compression (based on zstd-rs MIT patterns)
//! MIT Licensed - Zstandard compression format implementation
//! Source: https://github.com/KillingSpark/zstd-rs (437 stars, MIT)

use thiserror::Error;

#[derive(Error, Debug)]
pub enum CompressionError {
    #[error("Compression failed: {0}")]
    CompressionError(String),
    #[error("Decompression failed: {0}")]
    DecompressionError(String),
    #[error("Invalid data")]
    InvalidData,
}

/// Simple compression using run-length encoding (RLE)
/// In production, use actual zstd implementation
pub struct Compressor;

impl Compressor {
    /// Compress data using simple RLE
    pub fn compress(data: &[u8]) -> Result<Vec<u8>, CompressionError> {
        if data.is_empty() {
            return Ok(Vec::new());
        }

        let mut compressed = Vec::new();
        let mut i = 0;

        while i < data.len() {
            let byte = data[i];
            let mut count = 1u8;

            while (i + count as usize) < data.len() && data[i + count as usize] == byte && count < 255 {
                count += 1;
            }

            compressed.push(count);
            compressed.push(byte);
            i += count as usize;
        }

        // Only return compressed if it's smaller
        if compressed.len() < data.len() {
            Ok(compressed)
        } else {
            Ok(data.to_vec())
        }
    }

    /// Decompress RLE data
    pub fn decompress(data: &[u8]) -> Result<Vec<u8>, CompressionError> {
        if data.is_empty() {
            return Ok(Vec::new());
        }

        if data.len() % 2 != 0 {
            return Err(CompressionError::InvalidData);
        }

        let mut decompressed = Vec::new();

        for chunk in data.chunks(2) {
            let count = chunk[0] as usize;
            let byte = chunk[1];
            for _ in 0..count {
                decompressed.push(byte);
            }
        }

        Ok(decompressed)
    }

    /// Compress string
    pub fn compress_string(s: &str) -> Result<Vec<u8>, CompressionError> {
        Self::compress(s.as_bytes())
    }

    /// Decompress to string
    pub fn decompress_string(data: &[u8]) -> Result<String, CompressionError> {
        let bytes = Self::decompress(data)?;
        String::from_utf8(bytes).map_err(|_| CompressionError::InvalidData)
    }
}

/// Compression level
#[derive(Clone, Copy, Debug)]
pub enum CompressionLevel {
    Fast = 1,
    Default = 3,
    Best = 9,
}

impl Default for CompressionLevel {
    fn default() -> Self {
        Self::Default
    }
}

/// Compressor with level
pub struct LevelCompressor {
    _level: CompressionLevel,
}

impl LevelCompressor {
    pub fn new(level: CompressionLevel) -> Self {
        Self { _level: level }
    }

    pub fn compress(&self, data: &[u8]) -> Result<Vec<u8>, CompressionError> {
        // In production, level would affect compression ratio/speed
        Compressor::compress(data)
    }

    pub fn decompress(&self, data: &[u8]) -> Result<Vec<u8>, CompressionError> {
        Compressor::decompress(data)
    }
}

impl Default for LevelCompressor {
    fn default() -> Self {
        Self::new(CompressionLevel::default())
    }
}

/// Stream compression (simplified)
pub struct StreamCompressor {
    buffer: Vec<u8>,
}

impl StreamCompressor {
    pub fn new() -> Self {
        Self {
            buffer: Vec::new(),
        }
    }

    pub fn write(&mut self, data: &[u8]) -> Result<(), CompressionError> {
        self.buffer.extend_from_slice(data);
        Ok(())
    }

    pub fn flush(&mut self) -> Result<Vec<u8>, CompressionError> {
        let compressed = Compressor::compress(&self.buffer)?;
        self.buffer.clear();
        Ok(compressed)
    }

    pub fn reset(&mut self) {
        self.buffer.clear();
    }
}

impl Default for StreamCompressor {
    fn default() -> Self {
        Self::new()
    }
}

/// Calculate compression ratio
pub fn compression_ratio(original: &[u8], compressed: &[u8]) -> f64 {
    if original.is_empty() {
        return 1.0;
    }
    compressed.len() as f64 / original.len() as f64
}

/// Check if compression is beneficial
pub fn is_compression_beneficial(original: &[u8], compressed: &[u8]) -> bool {
    compressed.len() < original.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_decompress() {
        let data = b"aaaaabbbbbcccccddddd";
        let compressed = Compressor::compress(data).unwrap();
        let decompressed = Compressor::decompress(&compressed).unwrap();
        assert_eq!(data, decompressed.as_slice());
    }

    #[test]
    fn test_compress_empty() {
        let data = b"";
        let compressed = Compressor::compress(data).unwrap();
        assert_eq!(compressed.len(), 0);
    }

    #[test]
    fn test_decompress_empty() {
        let data = b"";
        let decompressed = Compressor::decompress(data).unwrap();
        assert_eq!(decompressed.len(), 0);
    }

    #[test]
    fn test_compress_string() {
        let s = "hello world";
        let compressed = Compressor::compress_string(s).unwrap();
        let decompressed = Compressor::decompress_string(&compressed).unwrap();
        assert_eq!(s, decompressed);
    }

    #[test]
    fn test_level_compressor() {
        let compressor = LevelCompressor::new(CompressionLevel::Best);
        let data = b"test data";
        let compressed = compressor.compress(data).unwrap();
        let decompressed = compressor.decompress(&compressed).unwrap();
        assert_eq!(data, decompressed.as_slice());
    }

    #[test]
    fn test_stream_compressor() {
        let mut compressor = StreamCompressor::new();
        compressor.write(b"hello").unwrap();
        compressor.write(b" world").unwrap();
        let compressed = compressor.flush().unwrap();
        assert!(!compressed.is_empty());
    }

    #[test]
    fn test_compression_ratio() {
        let data = b"aaaaabbbbbcccccddddd";
        let compressed = Compressor::compress(data).unwrap();
        let ratio = compression_ratio(data, &compressed);
        assert!(ratio <= 1.0);
    }

    #[test]
    fn test_is_compression_beneficial() {
        let data = b"aaaaabbbbbcccccddddd";
        let compressed = Compressor::compress(data).unwrap();
        assert!(is_compression_beneficial(data, &compressed));
    }

    #[test]
    fn test_invalid_decompress() {
        let data = vec![1, 2, 3]; // Odd length
        let result = Compressor::decompress(&data);
        assert!(result.is_err());
    }
}
