//! State Management (based on statig MIT patterns)
//! MIT Licensed - Hierarchical state machines
//! Source: https://github.com/mdeloof/statig (795 stars, MIT)

use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{RwLock, broadcast};

#[derive(Error, Debug)]
pub enum StateError {
    #[error("Invalid state transition: {from} -> {to}")]
    InvalidTransition { from: String, to: String },
    #[error("State not found: {0}")]
    StateNotFound(String),
    #[error("State machine error: {0}")]
    MachineError(String),
}

/// State transition event
#[derive(Clone, Debug)]
pub struct Event {
    pub event_type: String,
    pub payload: Option<serde_json::Value>,
}

impl Event {
    pub fn new(event_type: String) -> Self {
        Self {
            event_type,
            payload: None,
        }
    }

    pub fn with_payload(mut self, payload: serde_json::Value) -> Self {
        self.payload = Some(payload);
        self
    }
}

/// State context with local storage
#[derive(Clone, Debug)]
pub struct StateContext {
    pub data: HashMap<String, serde_json::Value>,
}

impl StateContext {
    pub fn new() -> Self {
        Self {
            data: HashMap::new(),
        }
    }

    pub fn get(&self, key: &str) -> Option<&serde_json::Value> {
        self.data.get(key)
    }

    pub fn set(&mut self, key: String, value: serde_json::Value) {
        self.data.insert(key, value);
    }

    pub fn remove(&mut self, key: &str) -> Option<serde_json::Value> {
        self.data.remove(key)
    }
}

impl Default for StateContext {
    fn default() -> Self {
        Self::new()
    }
}

/// State handler trait
#[async_trait::async_trait]
pub trait StateHandler: Send + Sync {
    async fn on_enter(&self, context: &mut StateContext);
    async fn on_exit(&self, context: &mut StateContext);
    async fn handle_event(&self, event: &Event, context: &mut StateContext) -> Option<String>;
}

/// Simple state handler
pub struct SimpleStateHandler {
    pub on_enter_fn: Option<Arc<dyn Fn(&mut StateContext) + Send + Sync>>,
    pub on_exit_fn: Option<Arc<dyn Fn(&mut StateContext) + Send + Sync>>,
    pub event_handlers: HashMap<String, Arc<dyn Fn(&Event, &mut StateContext) -> Option<String> + Send + Sync>>,
}

impl SimpleStateHandler {
    pub fn new() -> Self {
        Self {
            on_enter_fn: None,
            on_exit_fn: None,
            event_handlers: HashMap::new(),
        }
    }

    pub fn with_on_enter<F>(mut self, f: F) -> Self
    where
        F: Fn(&mut StateContext) + Send + Sync + 'static,
    {
        self.on_enter_fn = Some(Arc::new(f));
        self
    }

    pub fn with_on_exit<F>(mut self, f: F) -> Self
    where
        F: Fn(&mut StateContext) + Send + Sync + 'static,
    {
        self.on_exit_fn = Some(Arc::new(f));
        self
    }

    pub fn with_event_handler<F>(mut self, event_type: String, f: F) -> Self
    where
        F: Fn(&Event, &mut StateContext) -> Option<String> + Send + Sync + 'static,
    {
        self.event_handlers.insert(event_type, Arc::new(f));
        self
    }
}

impl Default for SimpleStateHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl StateHandler for SimpleStateHandler {
    async fn on_enter(&self, context: &mut StateContext) {
        if let Some(ref f) = self.on_enter_fn {
            f(context);
        }
    }

    async fn on_exit(&self, context: &mut StateContext) {
        if let Some(ref f) = self.on_exit_fn {
            f(context);
        }
    }

    async fn handle_event(&self, event: &Event, context: &mut StateContext) -> Option<String> {
        if let Some(handler) = self.event_handlers.get(&event.event_type) {
            handler(event, context)
        } else {
            None
        }
    }
}

/// State definition
pub struct State {
    pub id: String,
    pub handler: Arc<dyn StateHandler>,
    pub parent: Option<String>,
}

impl State {
    pub fn new(id: String, handler: Arc<dyn StateHandler>) -> Self {
        Self {
            id,
            handler,
            parent: None,
        }
    }

    pub fn with_parent(mut self, parent: String) -> Self {
        self.parent = Some(parent);
        self
    }
}

/// State machine
pub struct StateMachine {
    states: Arc<RwLock<HashMap<String, State>>>,
    current_state: Arc<RwLock<Option<String>>>,
    context: Arc<RwLock<StateContext>>,
    state_change_sender: broadcast::Sender<String>,
}

impl StateMachine {
    pub fn new() -> Self {
        let (state_change_sender, _) = broadcast::channel(100);
        Self {
            states: Arc::new(RwLock::new(HashMap::new())),
            current_state: Arc::new(RwLock::new(None)),
            context: Arc::new(RwLock::new(StateContext::new())),
            state_change_sender,
        }
    }

    /// Add state to machine
    pub async fn add_state(&self, state: State) {
        let mut states = self.states.write().await;
        states.insert(state.id.clone(), state);
    }

    /// Set initial state
    pub async fn set_initial(&self, state_id: &str) -> Result<(), StateError> {
        let states = self.states.read().await;
        if !states.contains_key(state_id) {
            return Err(StateError::StateNotFound(state_id.to_string()));
        }

        let mut current = self.current_state.write().await;
        *current = Some(state_id.to_string());

        // Call on_enter
        if let Some(state) = states.get(state_id) {
            let mut context = self.context.write().await;
            state.handler.on_enter(&mut context).await;
        }

        // Notify state change
        let _ = self.state_change_sender.send(state_id.to_string());

        Ok(())
    }

    /// Handle event
    pub async fn handle_event(&self, event: Event) -> Result<(), StateError> {
        let current = self.current_state.read().await;
        let current_id = current.as_ref()
            .ok_or_else(|| StateError::MachineError("No current state".to_string()))?;

        let states = self.states.read().await;
        let state = states.get(current_id)
            .ok_or_else(|| StateError::StateNotFound(current_id.clone()))?;

        let mut context = self.context.write().await;
        let next_state = state.handler.handle_event(&event, &mut context).await;

        if let Some(next_id) = next_state {
            drop(current);
            drop(states);
            self.transition(&next_id).await?;
        }

        Ok(())
    }

    /// Transition to new state
    async fn transition(&self, new_state_id: &str) -> Result<(), StateError> {
        let states = self.states.read().await;
        if !states.contains_key(new_state_id) {
            return Err(StateError::StateNotFound(new_state_id.to_string()));
        }

        // Exit current state
        let current = self.current_state.read().await;
        if let Some(current_id) = current.as_ref() {
            if let Some(state) = states.get(current_id) {
                let mut context = self.context.write().await;
                state.handler.on_exit(&mut context).await;
            }
        }
        drop(current);

        // Enter new state
        let mut current = self.current_state.write().await;
        *current = Some(new_state_id.to_string());

        if let Some(state) = states.get(new_state_id) {
            let mut context = self.context.write().await;
            state.handler.on_enter(&mut context).await;
        }

        // Notify state change
        let _ = self.state_change_sender.send(new_state_id.to_string());

        Ok(())
    }

    /// Get current state
    pub async fn current_state(&self) -> Option<String> {
        self.current_state.read().await.clone()
    }

    /// Get context
    pub async fn context(&self) -> StateContext {
        self.context.read().await.clone()
    }

    /// Subscribe to state changes
    pub fn subscribe_state_changes(&self) -> broadcast::Receiver<String> {
        self.state_change_sender.subscribe()
    }
}

impl Default for StateMachine {
    fn default() -> Self {
        Self::new()
    }
}

/// Global state manager (Redux-inspired)
pub struct GlobalState<T: Clone + Send + Sync> {
    state: Arc<RwLock<T>>,
    change_sender: broadcast::Sender<T>,
}

impl<T: Clone + Send + Sync> GlobalState<T> {
    pub fn new(initial: T) -> Self {
        let (change_sender, _) = broadcast::channel(100);
        Self {
            state: Arc::new(RwLock::new(initial)),
            change_sender,
        }
    }

    /// Get current state
    pub async fn get(&self) -> T {
        self.state.read().await.clone()
    }

    /// Update state
    pub async fn update<F, R>(&self, updater: F) -> R
    where
        F: FnOnce(&mut T) -> R,
    {
        let mut state = self.state.write().await;
        let result = updater(&mut state);
        let new_state = state.clone();
        drop(state);
        
        // Notify change
        let _ = self.change_sender.send(new_state);
        
        result
    }

    /// Subscribe to state changes
    pub fn subscribe(&self) -> broadcast::Receiver<T> {
        self.change_sender.subscribe()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_creation() {
        let event = Event::new("test".to_string());
        assert_eq!(event.event_type, "test");
    }

    #[test]
    fn test_state_context() {
        let mut context = StateContext::new();
        context.set("key".to_string(), serde_json::json!("value"));
        assert_eq!(context.get("key"), Some(&serde_json::json!("value")));
    }

    #[test]
    fn test_simple_state_handler() {
        let handler = SimpleStateHandler::new()
            .with_on_enter(|ctx| ctx.set("entered".to_string(), serde_json::json!(true)));
        
        let mut context = StateContext::new();
        let _ = handler.on_enter(&mut context);
        assert_eq!(context.get("entered"), Some(&serde_json::json!(true)));
    }

    #[tokio::test]
    async fn test_state_machine() {
        let machine = StateMachine::new();
        
        let handler = Arc::new(SimpleStateHandler::new());
        let state = State::new("idle".to_string(), handler);
        machine.add_state(state).await;
        
        machine.set_initial("idle").await.unwrap();
        assert_eq!(machine.current_state().await, Some("idle".to_string()));
    }

    #[tokio::test]
    async fn test_state_machine_transition() {
        let machine = StateMachine::new();
        
        let idle_handler = Arc::new(SimpleStateHandler::new()
            .with_event_handler("start".to_string(), |_event, _ctx| Some("running".to_string())));
        
        let running_handler = Arc::new(SimpleStateHandler::new());
        
        machine.add_state(State::new("idle".to_string(), idle_handler)).await;
        machine.add_state(State::new("running".to_string(), running_handler)).await;
        
        machine.set_initial("idle").await.unwrap();
        
        let event = Event::new("start".to_string());
        machine.handle_event(event).await.unwrap();
        
        assert_eq!(machine.current_state().await, Some("running".to_string()));
    }

    #[tokio::test]
    async fn test_global_state() {
        let state = GlobalState::new(42);
        assert_eq!(state.get().await, 42);
        
        state.update(|s| *s += 1).await;
        assert_eq!(state.get().await, 43);
    }
}
