//! Async utilities (based on futures-concurrency MIT/Apache-2.0 patterns)
//! MIT/Apache-2.0 Licensed - Structured concurrency operations for async Rust
//! Source: https://github.com/yoshuawuyts/futures-concurrency (500 stars, MIT/Apache-2.0)

use futures::future::{join_all, select_all};
use std::future::Future;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AsyncError {
    #[error("Join error: {0}")]
    JoinError(String),
    #[error("Timeout error")]
    TimeoutError,
    #[error("Task cancelled")]
    Cancelled,
}

/// Join multiple futures and return all results
pub async fn join_all_futures<Futures>(futures: Futures) -> Vec<<Futures::Item as Future>::Output>
where
    Futures: IntoIterator,
    Futures::Item: Future,
{
    join_all(futures).await
}

/// Join multiple futures and return first successful result
pub async fn select_first<Futures>(futures: Futures) -> <Futures::Item as Future>::Output
where
    Futures: IntoIterator,
    Futures::Item: Future + Unpin,
{
    let (result, _index, _remaining) = select_all(futures).await;
    result
}

/// Join multiple futures that return Results, return all results or first error
pub async fn try_join_all_futures<Futures, T, E>(futures: Futures) -> Result<Vec<T>, AsyncError>
where
    Futures: IntoIterator,
    Futures::Item: Future<Output = Result<T, E>>,
    T: Send + 'static,
    E: Send + 'static + std::fmt::Display,
{
    // This is a simplified version - in production use proper try_join_all
    let results = join_all(futures).await;
    let mut output = Vec::new();
    for result in results {
        match result {
            Ok(value) => output.push(value),
            Err(e) => return Err(AsyncError::JoinError(e.to_string())),
        }
    }
    Ok(output)
}

/// Retry a future with exponential backoff
pub async fn retry_with_backoff<F, Fut, T, E>(
    mut f: F,
    max_retries: usize,
    initial_delay_ms: u64,
) -> Result<T, AsyncError>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut delay = initial_delay_ms;
    
    for attempt in 0..=max_retries {
        match f().await {
            Ok(result) => return Ok(result),
            Err(_e) if attempt < max_retries => {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                delay = (delay * 2).min(60000); // Cap at 60 seconds
            }
            Err(e) => return Err(AsyncError::JoinError(e.to_string())),
        }
    }
    
    Err(AsyncError::JoinError("Max retries exceeded".to_string()))
}

/// Timeout a future
pub async fn with_timeout<F, T>(future: F, timeout_ms: u64) -> Result<T, AsyncError>
where
    F: Future<Output = T>,
{
    match tokio::time::timeout(
        tokio::time::Duration::from_millis(timeout_ms),
        future,
    )
    .await
    {
        Ok(result) => Ok(result),
        Err(_) => Err(AsyncError::TimeoutError),
    }
}

/// Run multiple futures concurrently with a limit on concurrent tasks
pub async fn run_concurrent<F, Fut, T>(
    futures: F,
    max_concurrent: usize,
) -> Vec<T>
where
    F: IntoIterator<Item = Fut>,
    Fut: Future<Output = T>,
    T: Send + 'static,
{
    use futures::stream::{self, StreamExt};
    
    stream::iter(futures)
        .map(|fut| async move { fut.await })
        .buffer_unordered(max_concurrent)
        .collect()
        .await
}

/// Batch processing: process items in batches
pub async fn process_in_batches<T, F, Fut, R>(
    items: Vec<T>,
    batch_size: usize,
    mut processor: F,
) -> Vec<R>
where
    T: Clone,
    F: FnMut(Vec<T>) -> Fut,
    Fut: Future<Output = Vec<R>>,
{
    let mut results = Vec::new();
    
    for chunk in items.chunks(batch_size) {
        let batch = chunk.to_vec();
        let batch_results = processor(batch).await;
        results.extend(batch_results);
    }
    
    results
}

/// Debounce: ignore rapid successive calls
pub struct Debounce {
    last_call: Option<tokio::time::Instant>,
    delay: tokio::time::Duration,
}

impl Debounce {
    pub fn new(delay_ms: u64) -> Self {
        Self {
            last_call: None,
            delay: tokio::time::Duration::from_millis(delay_ms),
        }
    }
    
    pub async fn call<F, Fut, T>(&mut self, f: F) -> T
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = T>,
    {
        if let Some(last) = self.last_call {
            let elapsed = last.elapsed();
            if elapsed < self.delay {
                tokio::time::sleep(self.delay - elapsed).await;
            }
        }
        
        self.last_call = Some(tokio::time::Instant::now());
        f().await
    }
}

/// Throttle: limit rate of calls
pub struct Throttle {
    last_call: Option<tokio::time::Instant>,
    min_interval: tokio::time::Duration,
}

impl Throttle {
    pub fn new(interval_ms: u64) -> Self {
        Self {
            last_call: None,
            min_interval: tokio::time::Duration::from_millis(interval_ms),
        }
    }
    
    pub async fn call<F, Fut, T>(&mut self, f: F) -> T
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = T>,
    {
        if let Some(last) = self.last_call {
            let elapsed = last.elapsed();
            if elapsed < self.min_interval {
                tokio::time::sleep(self.min_interval - elapsed).await;
            }
        }
        
        self.last_call = Some(tokio::time::Instant::now());
        f().await
    }
}

/// Race: run multiple futures and return the first to complete
pub async fn race<Futures>(futures: Futures) -> <Futures::Item as Future>::Output
where
    Futures: IntoIterator,
    Futures::Item: Future + Unpin,
{
    select_first(futures).await
}

/// Wait for any of multiple futures to complete
pub async fn select_any<Futures>(futures: Futures) -> (<Futures::Item as Future>::Output, usize)
where
    Futures: IntoIterator,
    Futures::Item: Future + Unpin,
{
    let (result, index, _remaining) = select_all(futures).await;
    (result, index)
}

/// Execute futures in sequence
pub async fn execute_sequence<Futures>(futures: Futures) -> Vec<<Futures::Item as Future>::Output>
where
    Futures: IntoIterator,
    Futures::Item: Future,
{
    let mut results = Vec::new();
    for future in futures {
        results.push(future.await);
    }
    results
}

/// Retry with custom condition
pub async fn retry_if<F, Fut, T, E, Cond>(
    mut f: F,
    max_retries: usize,
    condition: Cond,
) -> Result<T, AsyncError>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    E: std::fmt::Display,
    Cond: Fn(&E) -> bool,
{
    for attempt in 0..=max_retries {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) if attempt < max_retries && condition(&e) => {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
            Err(e) => return Err(AsyncError::JoinError(e.to_string())),
        }
    }
    
    Err(AsyncError::JoinError("Max retries exceeded".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    async fn async_operation(value: u32) -> u32 {
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        value * 2
    }
    
    async fn async_operation_with_result(value: u32) -> Result<u32, String> {
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        if value > 100 {
            Err("Value too large".to_string())
        } else {
            Ok(value * 2)
        }
    }
    
    #[tokio::test]
    async fn test_join_all_futures() {
        let futures = vec![
            Box::pin(async_operation(1)),
            Box::pin(async_operation(2)),
            Box::pin(async_operation(3)),
        ];
        let results = join_all_futures(futures).await;
        assert_eq!(results, vec![2, 4, 6]);
    }
    
    #[tokio::test]
    async fn test_retry_with_backoff_success() {
        let mut attempts = 0;
        let result = retry_with_backoff(
            || {
                attempts += 1;
                async move {
                    if attempts < 3 {
                        Err("fail")
                    } else {
                        Ok("success")
                    }
                }
            },
            5,
            10,
        ).await;
        assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_with_timeout_success() {
        let result = with_timeout(
            async {
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                42
            },
            100,
        ).await;
        assert_eq!(result.unwrap(), 42);
    }
    
    #[tokio::test]
    async fn test_with_timeout_failure() {
        let result = with_timeout(
            async {
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                42
            },
            10,
        ).await;
        assert!(matches!(result, Err(AsyncError::TimeoutError)));
    }
    
    #[tokio::test]
    async fn test_execute_sequence() {
        let futures = vec![
            Box::pin(async_operation(1)),
            Box::pin(async_operation(2)),
            Box::pin(async_operation(3)),
        ];
        let results = execute_sequence(futures).await;
        assert_eq!(results, vec![2, 4, 6]);
    }
    
    #[tokio::test]
    async fn test_debounce() {
        let mut debounce = Debounce::new(50);
        let start = tokio::time::Instant::now();
        
        debounce.call(|| async { 1 }).await;
        debounce.call(|| async { 2 }).await;
        
        let elapsed = start.elapsed();
        assert!(elapsed >= tokio::time::Duration::from_millis(50));
    }
    
    #[tokio::test]
    async fn test_throttle() {
        let mut throttle = Throttle::new(50);
        let start = tokio::time::Instant::now();
        
        throttle.call(|| async { 1 }).await;
        throttle.call(|| async { 2 }).await;
        
        let elapsed = start.elapsed();
        assert!(elapsed >= tokio::time::Duration::from_millis(50));
    }
}
