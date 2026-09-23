//! WebSockets (based on tokio-tungstenite MIT patterns)
//! MIT Licensed - Async WebSocket implementation for Tokio
//! Source: https://github.com/snapview/tokio-tungstenite (2481 stars, MIT)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{mpsc, RwLock};

#[derive(Error, Debug, Clone)]
pub enum WebSocketError {
    #[error("Connection error: {0}")]
    ConnectionError(String),
    #[error("Send error: {0}")]
    SendError(String),
    #[error("Receive error: {0}")]
    ReceiveError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Client not found: {0}")]
    ClientNotFound(String),
}

/// WebSocket message type
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum WsMessage {
    Text(String),
    Binary(Vec<u8>),
    Ping(Vec<u8>),
    Pong(Vec<u8>),
    Close { code: u16, reason: String },
}

impl WsMessage {
    pub fn text(text: String) -> Self {
        Self::Text(text)
    }

    pub fn binary(data: Vec<u8>) -> Self {
        Self::Binary(data)
    }

    pub fn ping(data: Vec<u8>) -> Self {
        Self::Ping(data)
    }

    pub fn pong(data: Vec<u8>) -> Self {
        Self::Pong(data)
    }

    pub fn close(code: u16, reason: String) -> Self {
        Self::Close { code, reason }
    }

    pub fn is_text(&self) -> bool {
        matches!(self, Self::Text(_))
    }

    pub fn is_binary(&self) -> bool {
        matches!(self, Self::Binary(_))
    }

    pub fn is_close(&self) -> bool {
        matches!(self, Self::Close { .. })
    }
}

/// WebSocket client handle
#[derive(Clone)]
pub struct WsClient {
    id: String,
    sender: mpsc::UnboundedSender<WsMessage>,
}

impl WsClient {
    pub fn new(id: String, sender: mpsc::UnboundedSender<WsMessage>) -> Self {
        Self { id, sender }
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn send(&self, message: WsMessage) -> Result<(), WebSocketError> {
        self.sender
            .send(message)
            .map_err(|e| WebSocketError::SendError(e.to_string()))
    }

    pub fn send_text(&self, text: String) -> Result<(), WebSocketError> {
        self.send(WsMessage::Text(text))
    }

    pub fn send_binary(&self, data: Vec<u8>) -> Result<(), WebSocketError> {
        self.send(WsMessage::Binary(data))
    }

    pub fn close(&self, code: u16, reason: String) -> Result<(), WebSocketError> {
        self.send(WsMessage::Close { code, reason })
    }
}

/// WebSocket event
#[derive(Clone, Debug)]
pub enum WsEvent {
    Connected(String),
    Disconnected(String),
    Message(String, WsMessage),
    Error(String, WebSocketError),
}

/// WebSocket server
pub struct WsServer {
    clients: Arc<RwLock<HashMap<String, WsClient>>>,
    event_sender: mpsc::UnboundedSender<WsEvent>,
    event_receiver: Option<mpsc::UnboundedReceiver<WsEvent>>,
}

impl WsServer {
    pub fn new() -> Self {
        let (event_sender, event_receiver) = mpsc::unbounded_channel();
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            event_sender,
            event_receiver: Some(event_receiver),
        }
    }

    /// Add client
    pub async fn add_client(&self, client: WsClient) {
        let id = client.id().to_string();
        self.clients.write().await.insert(id.clone(), client);
        let _ = self.event_sender.send(WsEvent::Connected(id));
    }

    /// Remove client
    pub async fn remove_client(&self, id: &str) {
        self.clients.write().await.remove(id);
        let _ = self
            .event_sender
            .send(WsEvent::Disconnected(id.to_string()));
    }

    /// Get client
    pub async fn get_client(&self, id: &str) -> Option<WsClient> {
        self.clients.read().await.get(id).cloned()
    }

    /// Get all clients
    pub async fn get_all_clients(&self) -> Vec<WsClient> {
        self.clients.read().await.values().cloned().collect()
    }

    /// Broadcast message to all clients
    pub async fn broadcast(&self, message: WsMessage) {
        let clients = self.clients.read().await;
        for client in clients.values() {
            let _ = client.send(message.clone());
        }
    }

    /// Broadcast text to all clients
    pub async fn broadcast_text(&self, text: String) {
        self.broadcast(WsMessage::Text(text)).await;
    }

    /// Send message to specific client
    pub async fn send_to(&self, id: &str, message: WsMessage) -> Result<(), WebSocketError> {
        let clients = self.clients.read().await;
        let client = clients
            .get(id)
            .ok_or_else(|| WebSocketError::ClientNotFound(id.to_string()))?;
        client.send(message)
    }

    /// Get client count
    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    /// Subscribe to events
    pub fn subscribe_events(&mut self) -> mpsc::UnboundedReceiver<WsEvent> {
        self.event_receiver.take().unwrap()
    }

    /// Check if client exists
    pub async fn has_client(&self, id: &str) -> bool {
        self.clients.read().await.contains_key(id)
    }
}

impl Default for WsServer {
    fn default() -> Self {
        Self::new()
    }
}

/// WebSocket client (simplified)
pub struct WsClientConnection {
    id: String,
    receiver: mpsc::UnboundedReceiver<WsMessage>,
}

impl WsClientConnection {
    pub fn new(id: String, receiver: mpsc::UnboundedReceiver<WsMessage>) -> Self {
        Self { id, receiver }
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub async fn receive(&mut self) -> Option<WsMessage> {
        self.receiver.recv().await
    }

    pub async fn receive_text(&mut self) -> Option<String> {
        match self.receive().await {
            Some(WsMessage::Text(text)) => Some(text),
            _ => None,
        }
    }
}

/// Message handler trait
#[async_trait::async_trait]
pub trait MessageHandler: Send + Sync {
    async fn handle_message(
        &self,
        client_id: String,
        message: WsMessage,
    ) -> Result<(), WebSocketError>;
    async fn handle_connect(&self, client_id: String);
    async fn handle_disconnect(&self, client_id: String);
}

/// Default message handler
pub struct DefaultMessageHandler;

#[async_trait::async_trait]
impl MessageHandler for DefaultMessageHandler {
    async fn handle_message(
        &self,
        _client_id: String,
        _message: WsMessage,
    ) -> Result<(), WebSocketError> {
        Ok(())
    }

    async fn handle_connect(&self, _client_id: String) {}

    async fn handle_disconnect(&self, _client_id: String) {}
}

/// Room-based broadcasting
#[derive(Clone)]
pub struct WsRoom {
    name: String,
    clients: Arc<RwLock<HashMap<String, WsClient>>>,
}

impl WsRoom {
    pub fn new(name: String) -> Self {
        Self {
            name,
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub async fn join(&self, client: WsClient) {
        let id = client.id().to_string();
        self.clients.write().await.insert(id, client);
    }

    pub async fn leave(&self, id: &str) {
        self.clients.write().await.remove(id);
    }

    pub async fn broadcast(&self, message: WsMessage) {
        let clients = self.clients.read().await;
        for client in clients.values() {
            let _ = client.send(message.clone());
        }
    }

    pub async fn member_count(&self) -> usize {
        self.clients.read().await.len()
    }

    pub async fn is_member(&self, id: &str) -> bool {
        self.clients.read().await.contains_key(id)
    }
}

/// Room manager
pub struct WsRoomManager {
    rooms: Arc<RwLock<HashMap<String, WsRoom>>>,
}

impl WsRoomManager {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_room(&self, name: String) -> WsRoom {
        let room = WsRoom::new(name.clone());
        self.rooms.write().await.insert(name, room.clone());
        room
    }

    pub async fn get_room(&self, name: &str) -> Option<WsRoom> {
        self.rooms.read().await.get(name).cloned()
    }

    pub async fn remove_room(&self, name: &str) {
        self.rooms.write().await.remove(name);
    }

    pub async fn list_rooms(&self) -> Vec<String> {
        self.rooms.read().await.keys().cloned().collect()
    }

    pub async fn room_count(&self) -> usize {
        self.rooms.read().await.len()
    }
}

impl Default for WsRoomManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ws_message_creation() {
        let msg = WsMessage::text("hello".to_string());
        assert!(msg.is_text());
        assert!(!msg.is_binary());
    }

    #[test]
    fn test_ws_message_close() {
        let msg = WsMessage::close(1000, "normal".to_string());
        assert!(msg.is_close());
    }

    #[tokio::test]
    async fn test_ws_server() {
        let server = WsServer::new();
        assert_eq!(server.client_count().await, 0);
        assert!(!server.has_client("test").await);
    }

    #[tokio::test]
    async fn test_ws_server_add_client() {
        let server = WsServer::new();
        let (sender, _receiver) = mpsc::unbounded_channel();
        let client = WsClient::new("test".to_string(), sender);
        server.add_client(client).await;
        assert_eq!(server.client_count().await, 1);
        assert!(server.has_client("test").await);
    }

    #[tokio::test]
    async fn test_ws_server_broadcast() {
        let server = WsServer::new();
        let (sender, mut receiver) = mpsc::unbounded_channel();
        let client = WsClient::new("test".to_string(), sender);
        server.add_client(client).await;

        server.broadcast_text("hello".to_string()).await;

        let msg = receiver.recv().await.unwrap();
        assert!(matches!(msg, WsMessage::Text(_)));
    }

    #[tokio::test]
    async fn test_ws_room() {
        let room = WsRoom::new("test-room".to_string());
        assert_eq!(room.name(), "test-room");
        assert_eq!(room.member_count().await, 0);
    }

    #[tokio::test]
    async fn test_ws_room_join() {
        let room = WsRoom::new("test-room".to_string());
        let (sender, _receiver) = mpsc::unbounded_channel();
        let client = WsClient::new("test".to_string(), sender);
        room.join(client).await;
        assert_eq!(room.member_count().await, 1);
        assert!(room.is_member("test").await);
    }

    #[tokio::test]
    async fn test_ws_room_manager() {
        let manager = WsRoomManager::new();
        let room = manager.create_room("test-room".to_string()).await;
        assert_eq!(room.name(), "test-room");
        assert_eq!(manager.room_count().await, 1);
    }

    #[tokio::test]
    async fn test_ws_room_manager_list() {
        let manager = WsRoomManager::new();
        manager.create_room("room1".to_string()).await;
        manager.create_room("room2".to_string()).await;
        let rooms = manager.list_rooms().await;
        assert_eq!(rooms.len(), 2);
    }
}
