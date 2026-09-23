//! Notifications (based on rok-notification MIT patterns)
//! MIT Licensed - Multi-channel notification system
//! Source: rok-notification (MIT), missive (MIT)

use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{mpsc, RwLock};

#[derive(Error, Debug)]
pub enum NotificationError {
    #[error("Send error: {0}")]
    SendError(String),
    #[error("Channel error: {0}")]
    ChannelError(String),
}

/// Notification channel
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum Channel {
    Email,
    Sms,
    Webhook,
    InApp,
    Slack,
    Discord,
}

/// Notification priority
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3,
}

impl Default for Priority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Notification message
#[derive(Clone, Debug)]
pub struct Notification {
    pub id: String,
    pub title: String,
    pub body: String,
    pub channels: Vec<Channel>,
    pub priority: Priority,
    pub metadata: HashMap<String, String>,
    pub timestamp: i64,
}

impl Notification {
    pub fn new(title: String, body: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            body,
            channels: vec![Channel::InApp],
            priority: Priority::default(),
            metadata: HashMap::new(),
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    pub fn with_channel(mut self, channel: Channel) -> Self {
        self.channels.push(channel);
        self
    }

    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// Notification handler trait
#[async_trait::async_trait]
pub trait NotificationHandler: Send + Sync {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError>;
}

/// In-memory notification handler
pub struct InMemoryHandler {
    notifications: Arc<RwLock<Vec<Notification>>>,
}

impl InMemoryHandler {
    pub fn new() -> Self {
        Self {
            notifications: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn get_all(&self) -> Vec<Notification> {
        self.notifications.read().await.clone()
    }

    pub async fn clear(&self) {
        self.notifications.write().await.clear();
    }
}

#[async_trait::async_trait]
impl NotificationHandler for InMemoryHandler {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError> {
        let mut notifications = self.notifications.write().await;
        notifications.push(notification.clone());
        Ok(())
    }
}

impl Default for InMemoryHandler {
    fn default() -> Self {
        Self::new()
    }
}

/// Email notification handler (placeholder)
pub struct EmailHandler {
    _sender: String,
}

impl EmailHandler {
    pub fn new(sender: String) -> Self {
        Self { _sender: sender }
    }
}

#[async_trait::async_trait]
impl NotificationHandler for EmailHandler {
    async fn send(&self, _notification: &Notification) -> Result<(), NotificationError> {
        // Placeholder: In production, use actual email sending
        Ok(())
    }
}

/// Webhook notification handler
pub struct WebhookHandler {
    url: String,
}

impl WebhookHandler {
    pub fn new(url: String) -> Self {
        Self { url }
    }
}

#[async_trait::async_trait]
impl NotificationHandler for WebhookHandler {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError> {
        // Placeholder: In production, make actual HTTP request
        println!("Webhook to {}: {}", self.url, notification.title);
        Ok(())
    }
}

/// Notification manager
pub struct NotificationManager {
    handlers: Arc<RwLock<HashMap<Channel, Arc<dyn NotificationHandler>>>>,
    queue: mpsc::UnboundedSender<Notification>,
}

impl NotificationManager {
    pub fn new() -> Self {
        let (queue_sender, _queue_receiver) = mpsc::unbounded_channel();
        
        let manager = Self {
            handlers: Arc::new(RwLock::new(HashMap::new())),
            queue: queue_sender,
        };

        // Start queue processor
        let handlers_clone = manager.handlers.clone();
        tokio::spawn(async move {
            let mut queue_receiver = _queue_receiver;
            while let Some(notification) = queue_receiver.recv().await {
                let handlers = handlers_clone.read().await;
                for channel in &notification.channels {
                    if let Some(handler) = handlers.get(channel) {
                        let _ = handler.send(&notification).await;
                    }
                }
            }
        });

        manager
    }

    /// Register handler for channel
    pub async fn register_handler(&self, channel: Channel, handler: Arc<dyn NotificationHandler>) {
        let mut handlers = self.handlers.write().await;
        handlers.insert(channel, handler);
    }

    /// Send notification
    pub async fn send(&self, notification: Notification) -> Result<(), NotificationError> {
        self.queue.send(notification)
            .map_err(|_| NotificationError::SendError("Queue closed".to_string()))
    }

    /// Send simple notification
    pub async fn notify(&self, title: String, body: String) -> Result<(), NotificationError> {
        let notification = Notification::new(title, body);
        self.send(notification).await
    }

    /// Send notification with specific channels
    pub async fn notify_channels(
        &self,
        title: String,
        body: String,
        channels: Vec<Channel>,
    ) -> Result<(), NotificationError> {
        let notification = Notification::new(title, body);
        let notification = channels.into_iter().fold(notification, |n, c| n.with_channel(c));
        self.send(notification).await
    }

    /// Send urgent notification
    pub async fn notify_urgent(&self, title: String, body: String) -> Result<(), NotificationError> {
        let notification = Notification::new(title, body)
            .with_priority(Priority::Urgent)
            .with_channel(Channel::Email)
            .with_channel(Channel::InApp);
        self.send(notification).await
    }
}

impl Default for NotificationManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Notification builder
pub struct NotificationBuilder {
    title: String,
    body: String,
    channels: Vec<Channel>,
    priority: Priority,
    metadata: HashMap<String, String>,
}

impl NotificationBuilder {
    pub fn new(title: String, body: String) -> Self {
        Self {
            title,
            body,
            channels: vec![Channel::InApp],
            priority: Priority::default(),
            metadata: HashMap::new(),
        }
    }

    pub fn with_channel(mut self, channel: Channel) -> Self {
        self.channels.push(channel);
        self
    }

    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }

    pub fn build(self) -> Notification {
        let mut notification = Notification::new(self.title, self.body);
        notification = self.channels.into_iter().fold(notification, |n, c| n.with_channel(c));
        notification = notification.with_priority(self.priority);
        for (key, value) in self.metadata {
            notification = notification.with_metadata(key, value);
        }
        notification
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_creation() {
        let notification = Notification::new("Test".to_string(), "Body".to_string());
        assert_eq!(notification.title, "Test");
        assert_eq!(notification.channels.len(), 1);
    }

    #[test]
    fn test_notification_with_channel() {
        let notification = Notification::new("Test".to_string(), "Body".to_string())
            .with_channel(Channel::Email);
        assert!(notification.channels.contains(&Channel::Email));
    }

    #[test]
    fn test_notification_priority() {
        assert!(Priority::Urgent > Priority::High);
        assert!(Priority::High > Priority::Normal);
        assert!(Priority::Normal > Priority::Low);
    }

    #[tokio::test]
    async fn test_in_memory_handler() {
        let handler = InMemoryHandler::new();
        let notification = Notification::new("Test".to_string(), "Body".to_string());
        handler.send(&notification).await.unwrap();
        
        let notifications = handler.get_all().await;
        assert_eq!(notifications.len(), 1);
    }

    #[tokio::test]
    async fn test_notification_manager() {
        let manager = NotificationManager::new();
        let handler = Arc::new(InMemoryHandler::new());
        manager.register_handler(Channel::InApp, handler).await;
        
        manager.notify("Test".to_string(), "Body".to_string()).await.unwrap();
    }

    #[tokio::test]
    async fn test_notification_manager_channels() {
        let manager = NotificationManager::new();
        let handler = Arc::new(InMemoryHandler::new());
        manager.register_handler(Channel::InApp, handler).await;
        
        manager.notify_channels(
            "Test".to_string(),
            "Body".to_string(),
            vec![Channel::InApp, Channel::Email],
        ).await.unwrap();
    }

    #[tokio::test]
    async fn test_notification_builder() {
        let notification = NotificationBuilder::new("Test".to_string(), "Body".to_string())
            .with_channel(Channel::Email)
            .with_priority(Priority::High)
            .build();
        
        assert_eq!(notification.title, "Test");
        assert!(notification.channels.contains(&Channel::Email));
        assert_eq!(notification.priority, Priority::High);
    }
}
