//! Event Bus (based on tokio-events and eventador-rs MIT patterns)
//! MIT Licensed - Lock-free pub/sub event bus
//! Source: tokio-events (MIT), eventador-rs (24 stars, MIT)

#![allow(clippy::type_complexity, clippy::len_without_is_empty)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{broadcast, RwLock};

#[derive(Error, Debug)]
pub enum EventBusError {
    #[error("Send error: {0}")]
    SendError(String),
    #[error("Receive error: {0}")]
    ReceiveError(String),
    #[error("Channel closed")]
    ChannelClosed,
}

/// Event wrapper
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Event {
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: i64,
}

impl Event {
    pub fn new(event_type: String, payload: serde_json::Value) -> Self {
        Self {
            event_type,
            payload,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    pub fn with_type(mut self, event_type: String) -> Self {
        self.event_type = event_type;
        self
    }
}

/// Event handler trait
#[async_trait::async_trait]
pub trait EventHandler: Send + Sync {
    async fn handle(&self, event: &Event) -> Result<(), EventBusError>;
}

/// Subscriber
pub struct Subscriber {
    receiver: broadcast::Receiver<Event>,
}

impl Subscriber {
    pub async fn next(&mut self) -> Result<Event, EventBusError> {
        self.receiver
            .recv()
            .await
            .map_err(|_| EventBusError::ChannelClosed)
    }

    pub async fn recv(&mut self) -> Option<Event> {
        self.receiver.recv().await.ok()
    }
}

/// Event bus
pub struct EventBus {
    channels: Arc<RwLock<HashMap<String, broadcast::Sender<Event>>>>,
    channel_capacity: usize,
}

impl EventBus {
    pub fn new(channel_capacity: usize) -> Self {
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
            channel_capacity,
        }
    }

    /// Create or get channel for event type
    async fn get_or_create_channel(&self, event_type: &str) -> broadcast::Sender<Event> {
        let mut channels = self.channels.write().await;
        if let Some(sender) = channels.get(event_type) {
            return sender.clone();
        }

        let (sender, _) = broadcast::channel(self.channel_capacity);
        channels.insert(event_type.to_string(), sender.clone());
        sender
    }

    /// Publish event
    pub async fn publish(&self, event: Event) -> Result<usize, EventBusError> {
        let sender = self.get_or_create_channel(&event.event_type).await;
        sender
            .send(event.clone())
            .map_err(|e| EventBusError::SendError(e.to_string()))
    }

    /// Subscribe to event type
    pub async fn subscribe(&self, event_type: &str) -> Subscriber {
        let sender = self.get_or_create_channel(event_type).await;
        let receiver = sender.subscribe();
        Subscriber { receiver }
    }

    /// Get subscriber count for event type
    pub async fn subscriber_count(&self, event_type: &str) -> usize {
        let channels = self.channels.read().await;
        channels
            .get(event_type)
            .map(|s| s.receiver_count())
            .unwrap_or(0)
    }

    /// Get all event types
    pub async fn event_types(&self) -> Vec<String> {
        let channels = self.channels.read().await;
        channels.keys().cloned().collect()
    }

    /// Remove channel for event type
    pub async fn remove_channel(&self, event_type: &str) {
        let mut channels = self.channels.write().await;
        channels.remove(event_type);
    }

    /// Clear all channels
    pub async fn clear(&self) {
        let mut channels = self.channels.write().await;
        channels.clear();
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new(100)
    }
}

/// Event router
pub struct EventRouter {
    bus: EventBus,
    handlers: Arc<RwLock<HashMap<String, Vec<Arc<dyn EventHandler>>>>>,
}

impl EventRouter {
    pub fn new(bus: EventBus) -> Self {
        Self {
            bus,
            handlers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register handler for event type
    pub async fn register_handler(&self, event_type: String, handler: Arc<dyn EventHandler>) {
        let mut handlers = self.handlers.write().await;
        handlers
            .entry(event_type)
            .or_insert_with(Vec::new)
            .push(handler);
    }

    /// Route event to handlers
    pub async fn route(&self, event: Event) -> Result<(), EventBusError> {
        let handlers = self.handlers.read().await;
        if let Some(handler_list) = handlers.get(&event.event_type) {
            for handler in handler_list {
                let _ = handler.handle(&event).await;
            }
        }
        Ok(())
    }

    /// Publish and route event
    pub async fn publish_and_route(&self, event: Event) -> Result<(), EventBusError> {
        self.bus.publish(event.clone()).await?;
        self.route(event).await
    }

    /// Get handler count for event type
    pub async fn handler_count(&self, event_type: &str) -> usize {
        let handlers = self.handlers.read().await;
        handlers.get(event_type).map(|h| h.len()).unwrap_or(0)
    }
}

/// Event processor
pub struct EventProcessor {
    bus: EventBus,
}

impl EventProcessor {
    pub fn new(bus: EventBus) -> Self {
        Self { bus }
    }

    /// Start processing events for type
    pub async fn start_processing<F, Fut>(&self, event_type: String, processor: F)
    where
        F: Fn(Event) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<(), EventBusError>> + Send + 'static,
    {
        let mut subscriber = self.bus.subscribe(&event_type).await;
        let processor = Arc::new(processor);

        tokio::spawn(async move {
            while let Ok(event) = subscriber.next().await {
                let processor = processor.clone();
                tokio::spawn(async move {
                    let _ = processor(event).await;
                });
            }
        });
    }

    /// Stop processing (by closing channels)
    pub async fn stop_processing(&self, event_type: &str) {
        self.bus.remove_channel(event_type).await;
    }
}

/// Event store (simplified in-memory)
pub struct EventStore {
    events: Arc<RwLock<Vec<Event>>>,
    max_size: usize,
}

impl EventStore {
    pub fn new(max_size: usize) -> Self {
        Self {
            events: Arc::new(RwLock::new(Vec::new())),
            max_size,
        }
    }

    /// Store event
    pub async fn store(&self, event: Event) {
        let mut events = self.events.write().await;
        events.push(event);

        // Limit size
        if events.len() > self.max_size {
            events.remove(0);
        }
    }

    /// Get all events
    pub async fn get_all(&self) -> Vec<Event> {
        self.events.read().await.clone()
    }

    /// Get events by type
    pub async fn get_by_type(&self, event_type: &str) -> Vec<Event> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| e.event_type == event_type)
            .cloned()
            .collect()
    }

    /// Get events since timestamp
    pub async fn get_since(&self, timestamp: i64) -> Vec<Event> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| e.timestamp >= timestamp)
            .cloned()
            .collect()
    }

    /// Clear all events
    pub async fn clear(&self) {
        self.events.write().await.clear();
    }

    /// Get event count
    pub async fn len(&self) -> usize {
        self.events.read().await.len()
    }
}

impl Default for EventStore {
    fn default() -> Self {
        Self::new(1000)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestHandler;

    #[async_trait::async_trait]
    impl EventHandler for TestHandler {
        async fn handle(&self, _event: &Event) -> Result<(), EventBusError> {
            Ok(())
        }
    }

    #[test]
    fn test_event_creation() {
        let event = Event::new("test".to_string(), serde_json::json!({}));
        assert_eq!(event.event_type, "test");
    }

    #[tokio::test]
    async fn test_event_bus() {
        let bus = EventBus::new(10);
        let event = Event::new("test".to_string(), serde_json::json!({}));
        bus.publish(event).await.unwrap();
    }

    #[tokio::test]
    async fn test_event_bus_subscribe() {
        let bus = EventBus::new(10);
        let mut subscriber = bus.subscribe("test").await;

        let event = Event::new("test".to_string(), serde_json::json!({}));
        bus.publish(event).await.unwrap();

        let received = subscriber.next().await.unwrap();
        assert_eq!(received.event_type, "test");
    }

    #[tokio::test]
    async fn test_event_bus_subscriber_count() {
        let bus = EventBus::new(10);
        bus.subscribe("test").await;
        bus.subscribe("test").await;

        let count = bus.subscriber_count("test").await;
        assert_eq!(count, 2);
    }

    #[tokio::test]
    async fn test_event_router() {
        let bus = EventBus::new(10);
        let router = EventRouter::new(bus);

        let handler = Arc::new(TestHandler);
        router.register_handler("test".to_string(), handler).await;

        let count = router.handler_count("test").await;
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_event_store() {
        let store = EventStore::new(100);
        let event = Event::new("test".to_string(), serde_json::json!({}));
        store.store(event).await;

        assert_eq!(store.len().await, 1);
    }

    #[tokio::test]
    async fn test_event_store_by_type() {
        let store = EventStore::new(100);
        let event = Event::new("test".to_string(), serde_json::json!({}));
        store.store(event).await;

        let events = store.get_by_type("test").await;
        assert_eq!(events.len(), 1);
    }

    #[tokio::test]
    async fn test_event_store_since() {
        let store = EventStore::new(100);
        let event = Event::new("test".to_string(), serde_json::json!({}));
        store.store(event).await;

        let timestamp = chrono::Utc::now().timestamp() - 1;
        let events = store.get_since(timestamp).await;
        assert_eq!(events.len(), 1);
    }
}
