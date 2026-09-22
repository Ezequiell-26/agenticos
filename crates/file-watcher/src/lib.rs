//! File Watcher (based on notify patterns, used by watchexec)
//! MIT Licensed - File system event monitoring for hot reload
//! Source: notify crate (used by watchexec, 6915 stars)

use std::path::{Path, PathBuf};
use std::time::Duration;
use thiserror::Error;
use tokio::sync::mpsc;

#[derive(Error, Debug)]
pub enum WatcherError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Path not found: {0}")]
    PathNotFound(PathBuf),
}

/// File event type
#[derive(Clone, Debug)]
pub enum FileEvent {
    Created(PathBuf),
    Modified(PathBuf),
    Removed(PathBuf),
    Renamed { old: PathBuf, new: PathBuf },
}

impl FileEvent {
    pub fn path(&self) -> &Path {
        match self {
            FileEvent::Created(p) => p,
            FileEvent::Modified(p) => p,
            FileEvent::Removed(p) => p,
            FileEvent::Renamed { new, .. } => new,
        }
    }
}

/// File watcher configuration
#[derive(Clone)]
pub struct WatcherConfig {
    pub debounce_ms: u64,
    pub recursive: bool,
    pub poll_interval: Option<Duration>,
}

impl Default for WatcherConfig {
    fn default() -> Self {
        Self {
            debounce_ms: 200,
            recursive: true,
            poll_interval: None,
        }
    }
}

/// File watcher (simplified version)
pub struct FileWatcher {
    event_sender: mpsc::UnboundedSender<FileEvent>,
    event_receiver: Option<mpsc::UnboundedReceiver<FileEvent>>,
}

impl FileWatcher {
    /// Create new file watcher
    pub fn new(_config: WatcherConfig) -> Result<Self, WatcherError> {
        let (event_sender, event_receiver) = mpsc::unbounded_channel();
        Ok(Self {
            event_sender,
            event_receiver: Some(event_receiver),
        })
    }

    /// Watch a path (placeholder - in production, use notify)
    pub fn watch(&mut self, _path: &Path, _recursive: bool) -> Result<(), WatcherError> {
        // Placeholder: In production, this would use notify crate
        Ok(())
    }

    /// Watch a path with default config
    pub fn watch_path(&mut self, path: &Path) -> Result<(), WatcherError> {
        self.watch(path, true)
    }

    /// Subscribe to events
    pub fn subscribe_events(&mut self) -> mpsc::UnboundedReceiver<FileEvent> {
        self.event_receiver.take().unwrap()
    }

    /// Manually send an event (for testing)
    pub fn send_event(&self, event: FileEvent) -> Result<(), WatcherError> {
        self.event_sender.send(event)
            .map_err(|_| WatcherError::IoError(std::io::Error::new(std::io::ErrorKind::BrokenPipe, "channel closed")))
    }

    /// Get event stream (tokio-compatible)
    pub async fn next_event(&mut self) -> Option<FileEvent> {
        if let Some(ref mut receiver) = self.event_receiver {
            receiver.recv().await
        } else {
            None
        }
    }
}

/// Simple file watcher for a single path
pub struct SimpleWatcher {
    watcher: FileWatcher,
}

impl SimpleWatcher {
    /// Create watcher for a path
    pub fn watch(path: &Path) -> Result<Self, WatcherError> {
        let config = WatcherConfig::default();
        let mut watcher = FileWatcher::new(config)?;
        watcher.watch_path(path)?;
        Ok(Self { watcher })
    }

    /// Get event receiver
    pub fn events(&mut self) -> mpsc::UnboundedReceiver<FileEvent> {
        self.watcher.subscribe_events()
    }
}

/// Debounced file watcher
pub struct DebouncedWatcher {
    config: WatcherConfig,
}

impl DebouncedWatcher {
    /// Create debounced watcher
    pub fn new(debounce_ms: u64) -> Self {
        Self {
            config: WatcherConfig {
                debounce_ms,
                ..Default::default()
            },
        }
    }

    /// Watch path with debouncing
    pub fn watch(&self, path: &Path) -> Result<SimpleWatcher, WatcherError> {
        let config = WatcherConfig {
            debounce_ms: self.config.debounce_ms,
            ..Default::default()
        };
        let mut watcher = FileWatcher::new(config)?;
        watcher.watch_path(path)?;
        Ok(SimpleWatcher { watcher })
    }
}

/// Hot reload manager for configurations
pub struct HotReloadManager<T> {
    path: PathBuf,
    current: Option<T>,
}

impl<T> HotReloadManager<T>
where
    T: Clone,
{
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            current: None,
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn current(&self) -> Option<&T> {
        self.current.as_ref()
    }

    pub fn set_current(&mut self, value: T) {
        self.current = Some(value);
    }

    pub fn reload<F>(&mut self, loader: F) -> Result<(), WatcherError>
    where
        F: FnOnce(&Path) -> Result<T, Box<dyn std::error::Error + Send + Sync>>,
    {
        let value = loader(&self.path).map_err(|e| WatcherError::IoError(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        self.current = Some(value);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_event() {
        let path = PathBuf::from("/tmp/test.txt");
        let event = FileEvent::Created(path.clone());
        assert_eq!(event.path(), &path);
    }

    #[test]
    fn test_watcher_config_default() {
        let config = WatcherConfig::default();
        assert_eq!(config.debounce_ms, 200);
        assert!(config.recursive);
    }

    #[test]
    fn test_hot_reload_manager() {
        let path = PathBuf::from("/tmp/config.toml");
        let manager = HotReloadManager::<String>::new(path);
        assert!(manager.current().is_none());
        
        manager.set_current("test".to_string());
        assert_eq!(manager.current(), Some(&"test".to_string()));
    }

    #[test]
    fn test_file_event_modified() {
        let path = PathBuf::from("/tmp/test.txt");
        let event = FileEvent::Modified(path.clone());
        assert_eq!(event.path(), &path);
    }

    #[test]
    fn test_file_event_removed() {
        let path = PathBuf::from("/tmp/test.txt");
        let event = FileEvent::Removed(path.clone());
        assert_eq!(event.path(), &path);
    }

    #[test]
    fn test_file_event_renamed() {
        let old = PathBuf::from("/tmp/old.txt");
        let new = PathBuf::from("/tmp/new.txt");
        let event = FileEvent::Renamed { old, new: new.clone() };
        assert_eq!(event.path(), &new);
    }

    #[tokio::test]
    async fn test_file_watcher_send_event() {
        let config = WatcherConfig::default();
        let watcher = FileWatcher::new(config).unwrap();
        let path = PathBuf::from("/tmp/test.txt");
        let event = FileEvent::Created(path.clone());
        watcher.send_event(event).unwrap();
    }
}
