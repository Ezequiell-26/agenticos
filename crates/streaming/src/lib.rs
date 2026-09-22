//! Streaming (based on timely-dataflow MIT patterns)
//! MIT Licensed - Low-latency cyclic dataflow computational model
//! Source: https://github.com/timelydataflow/timely-dataflow (3625 stars, MIT)

use std::sync::Arc;
use thiserror::Error;
use tokio::sync::mpsc;

#[derive(Error, Debug)]
pub enum StreamError {
    #[error("Stream error: {0}")]
    StreamError(String),
    #[error("Channel closed")]
    ChannelClosed,
}

/// Stream data item
#[derive(Clone, Debug)]
pub struct StreamItem {
    pub data: serde_json::Value,
    pub timestamp: i64,
}

impl StreamItem {
    pub fn new(data: serde_json::Value) -> Self {
        Self {
            data,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
}

/// Stream operator trait
#[async_trait::async_trait]
pub trait StreamOperator: Send + Sync {
    async fn process(&self, item: StreamItem) -> Vec<StreamItem>;
}

/// Map operator
pub struct MapOperator {
    f: Arc<dyn Fn(serde_json::Value) -> serde_json::Value + Send + Sync>,
}

impl MapOperator {
    pub fn new<F>(f: F) -> Self
    where
        F: Fn(serde_json::Value) -> serde_json::Value + Send + Sync + 'static,
    {
        Self { f: Arc::new(f) }
    }
}

#[async_trait::async_trait]
impl StreamOperator for MapOperator {
    async fn process(&self, item: StreamItem) -> Vec<StreamItem> {
        vec![StreamItem {
            data: (self.f)(item.data),
            timestamp: item.timestamp,
        }]
    }
}

/// Filter operator
pub struct FilterOperator {
    f: Arc<dyn Fn(&serde_json::Value) -> bool + Send + Sync>,
}

impl FilterOperator {
    pub fn new<F>(f: F) -> Self
    where
        F: Fn(&serde_json::Value) -> bool + Send + Sync + 'static,
    {
        Self { f: Arc::new(f) }
    }
}

#[async_trait::async_trait]
impl StreamOperator for FilterOperator {
    async fn process(&self, item: StreamItem) -> Vec<StreamItem> {
        if (self.f)(&item.data) {
            vec![item]
        } else {
            vec![]
        }
    }
}

/// Stream processor
pub struct StreamProcessor {
    input: mpsc::UnboundedReceiver<StreamItem>,
    output: mpsc::UnboundedSender<StreamItem>,
    operator: Arc<dyn StreamOperator>,
}

impl StreamProcessor {
    pub fn new(
        input: mpsc::UnboundedReceiver<StreamItem>,
        output: mpsc::UnboundedSender<StreamItem>,
        operator: Arc<dyn StreamOperator>,
    ) -> Self {
        Self {
            input,
            output,
            operator,
        }
    }

    pub async fn run(mut self) {
        while let Some(item) = self.input.recv().await {
            let results = self.operator.process(item).await;
            for result in results {
                let _ = self.output.send(result);
            }
        }
    }
}

/// Stream pipeline
pub struct StreamPipeline {
    senders: Vec<mpsc::UnboundedSender<StreamItem>>,
}

impl StreamPipeline {
    pub fn new() -> Self {
        Self {
            senders: Vec::new(),
        }
    }

    /// Add source to pipeline
    pub fn add_source(&mut self) -> mpsc::UnboundedReceiver<StreamItem> {
        let (sender, receiver) = mpsc::unbounded_channel();
        self.senders.push(sender);
        receiver
    }

    /// Send item to pipeline
    pub fn send(&self, item: StreamItem) -> Result<(), StreamError> {
        for sender in &self.senders {
            let _ = sender.send(item.clone());
        }
        Ok(())
    }

    /// Process stream with operator
    pub async fn process(
        &self,
        receiver: mpsc::UnboundedReceiver<StreamItem>,
        operator: Arc<dyn StreamOperator>,
    ) -> mpsc::UnboundedReceiver<StreamItem> {
        let (output_sender, output_receiver) = mpsc::unbounded_channel();
        let processor = StreamProcessor::new(receiver, output_sender, operator);
        tokio::spawn(processor.run());
        output_receiver
    }
}

impl Default for StreamPipeline {
    fn default() -> Self {
        Self::new()
    }
}

/// Windowed stream aggregation
pub struct WindowedAggregator {
    window_size: usize,
    aggregator: Arc<dyn Fn(&[serde_json::Value]) -> serde_json::Value + Send + Sync>,
}

impl WindowedAggregator {
    pub fn new(
        window_size: usize,
        aggregator: Arc<dyn Fn(&[serde_json::Value]) -> serde_json::Value + Send + Sync>,
    ) -> Self {
        Self {
            window_size,
            aggregator,
        }
    }

    pub async fn process_stream(
        &self,
        mut receiver: mpsc::UnboundedReceiver<StreamItem>,
    ) -> mpsc::UnboundedReceiver<StreamItem> {
        let (sender, output) = mpsc::unbounded_channel();
        let window_size = self.window_size;
        let aggregator = self.aggregator.clone();

        tokio::spawn(async move {
            let mut window: Vec<serde_json::Value> = Vec::new();

            while let Some(item) = receiver.recv().await {
                window.push(item.data);

                if window.len() >= window_size {
                    let result = (aggregator)(&window);
                    let _ = sender.send(StreamItem::new(result));
                    window.clear();
                }
            }
        });

        output
    }
}

impl Default for WindowedAggregator {
    fn default() -> Self {
        Self::new(1, Arc::new(|_| serde_json::Value::Null))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stream_item() {
        let item = StreamItem::new(serde_json::json!(42));
        assert_eq!(item.data, 42);
    }

    #[tokio::test]
    async fn test_map_operator() {
        let operator = MapOperator::new(|x: serde_json::Value| {
            if let serde_json::Value::Number(n) = x {
                serde_json::json!(n.as_i64().unwrap() * 2)
            } else {
                x
            }
        });
        let item = StreamItem::new(serde_json::json!(21));
        
        let results = operator.process(item).await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].data, 42);
    }

    #[tokio::test]
    async fn test_filter_operator() {
        let operator = FilterOperator::new(|x: &serde_json::Value| {
            if let serde_json::Value::Number(n) = x {
                n.as_i64().unwrap() > 10
            } else {
                false
            }
        });
        let item = StreamItem::new(serde_json::json!(15));
        
        let results = operator.process(item).await;
        assert_eq!(results.len(), 1);
    }

    #[tokio::test]
    async fn test_stream_pipeline() {
        let mut pipeline = StreamPipeline::new();
        let _receiver = pipeline.add_source();
        
        let item = StreamItem::new(serde_json::json!(42));
        pipeline.send(item).unwrap();
    }

    #[tokio::test]
    async fn test_windowed_aggregator() {
        let aggregator = WindowedAggregator::new(2, Arc::new(|items: &[serde_json::Value]| {
            let sum: i64 = items.iter().filter_map(|v| v.as_i64()).sum();
            serde_json::json!(sum)
        }));
        let (sender, receiver) = mpsc::unbounded_channel();
        
        tokio::spawn(async move {
            let _ = sender.send(StreamItem::new(serde_json::json!(10)));
            let _ = sender.send(StreamItem::new(serde_json::json!(20)));
        });

        let mut output = aggregator.process_stream(receiver).await;
        let result = output.recv().await.unwrap();
        assert_eq!(result.data, 30);
    }
}
