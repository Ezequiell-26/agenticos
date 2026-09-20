#![forbid(unsafe_code)]
#![deny(missing_docs)]

//! Smoke tests for the AgentiCOS kernel durable runtime.

use agenticos_contracts::{
    CapabilityGrant, CapabilityIssuer, CapabilityType, ConfigLayer, LogEntry, LogLevel, Logger,
    RunId, RunState,
};
use agenticos_kernel::{
    InMemoryCapabilityIssuer, InMemoryConfig, InMemoryEventStore, InMemoryLogger,
    InMemorySnapshotStore, KernelRuntime, SqliteEventStore, SqliteSnapshotStore, TestClock,
    TestIdGenerator,
};

fn test_runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}

#[test]
fn test_durable_run_lifecycle() {
    let rt = test_runtime();
    rt.block_on(async {
        let event_store = std::sync::Arc::new(InMemoryEventStore::new());
        let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
        let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let runtime = KernelRuntime::new(
            event_store,
            snapshot_store,
            logger,
            config,
            capability_issuer,
        );

        let run_id = RunId::new("test-run-1").unwrap();

        // Create run
        let run = runtime.create_run(run_id.clone()).await.unwrap();
        assert_eq!(run.state, RunState::Created);
        assert_eq!(run.version, 1);

        // Transition to Admitted
        runtime
            .transition_run(&run_id, RunState::Admitted, 1)
            .await
            .unwrap();

        // Transition to Waiting
        runtime
            .transition_run(&run_id, RunState::Waiting, 2)
            .await
            .unwrap();

        // Transition to Running
        runtime
            .transition_run(&run_id, RunState::Running, 3)
            .await
            .unwrap();

        // Request cancellation
        runtime.cancel_run(&run_id).await.unwrap();
    });
}

#[test]
fn test_optimistic_concurrency() {
    let rt = test_runtime();
    rt.block_on(async {
        let event_store = std::sync::Arc::new(InMemoryEventStore::new());
        let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
        let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let runtime = KernelRuntime::new(
            event_store,
            snapshot_store,
            logger,
            config,
            capability_issuer,
        );

        let run_id = RunId::new("test-run-2").unwrap();
        runtime.create_run(run_id.clone()).await.unwrap();

        // Try to transition with wrong version (expected is 1, not 999)
        let result = runtime
            .transition_run(&run_id, RunState::Admitted, 999)
            .await;
        assert!(result.is_err());
    });
}

#[test]
fn test_lease_acquisition() {
    let rt = test_runtime();
    rt.block_on(async {
        let event_store = std::sync::Arc::new(InMemoryEventStore::new());
        let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
        let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let runtime = KernelRuntime::new(
            event_store,
            snapshot_store,
            logger,
            config,
            capability_issuer,
        );

        let run_id = RunId::new("test-run-3").unwrap();
        runtime.create_run(run_id.clone()).await.unwrap();

        let lease = runtime
            .acquire_lease(&run_id, "owner-1".to_string(), 9999999999)
            .await
            .unwrap();

        assert_eq!(lease.owner_id, "owner-1");
        assert_eq!(lease.resource_id, run_id.as_str());
    });
}

#[test]
fn test_snapshot_and_recovery() {
    let rt = test_runtime();
    rt.block_on(async {
        let event_store = std::sync::Arc::new(InMemoryEventStore::new());
        let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
        let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let runtime = KernelRuntime::new(
            event_store.clone(),
            snapshot_store.clone(),
            logger,
            config,
            capability_issuer,
        );

        let run_id = RunId::new("test-run-4").unwrap();
        runtime.create_run(run_id.clone()).await.unwrap();

        runtime
            .transition_run(&run_id, RunState::Admitted, 1)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id, RunState::Running, 2)
            .await
            .unwrap();

        // Create snapshot
        runtime.create_snapshot(&run_id).await.unwrap();

        // Simulate recovery
        let logger_new = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config_new = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer_new = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let recovered_runtime = KernelRuntime::new(
            event_store,
            snapshot_store,
            logger_new,
            config_new,
            capability_issuer_new,
        );
        let recovered_run = recovered_runtime.recover_run(&run_id).await.unwrap();

        assert_eq!(recovered_run.state, RunState::Running);
        assert_eq!(recovered_run.version, 3);
    });
}

#[test]
fn test_cancellation_propagation() {
    let rt = test_runtime();
    rt.block_on(async {
        let event_store = std::sync::Arc::new(InMemoryEventStore::new());
        let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
        let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let runtime = KernelRuntime::new(
            event_store,
            snapshot_store,
            logger,
            config,
            capability_issuer,
        );

        let run_id = RunId::new("test-run-5").unwrap();
        let _run = runtime.create_run(run_id.clone()).await.unwrap();

        runtime
            .transition_run(&run_id, RunState::Admitted, 1)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id, RunState::Running, 2)
            .await
            .unwrap();

        // Request cancellation
        runtime.cancel_run(&run_id).await.unwrap();

        // Check cancellation token
        let runs = runtime.runs.read().await;
        let current_run = runs.get(&run_id).unwrap();
        assert!(current_run.cancellation.is_cancelled());
    });
}

#[test]
fn test_invalid_state_transitions() {
    let rt = test_runtime();
    rt.block_on(async {
        let event_store = std::sync::Arc::new(InMemoryEventStore::new());
        let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
        let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let runtime = KernelRuntime::new(
            event_store,
            snapshot_store,
            logger,
            config,
            capability_issuer,
        );

        let run_id = RunId::new("test-run-6").unwrap();
        runtime.create_run(run_id.clone()).await.unwrap();

        // Try invalid transition: Created -> Completed (not allowed)
        let result = runtime
            .transition_run(&run_id, RunState::Completed, 1)
            .await;
        assert!(result.is_err());
    });
}

#[test]
fn test_sqlite_persistence() {
    let rt = test_runtime();
    rt.block_on(async {
        // Use in-memory SQLite with shared cache for testing
        let db_url = "sqlite::memory:";

        let event_store = std::sync::Arc::new(
            SqliteEventStore::new(db_url)
                .await
                .expect("Failed to create SQLite event store"),
        );
        let snapshot_store = std::sync::Arc::new(
            SqliteSnapshotStore::new(db_url)
                .await
                .expect("Failed to create SQLite snapshot store"),
        );

        let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer = std::sync::Arc::new(InMemoryCapabilityIssuer::new());

        let runtime = KernelRuntime::new(
            event_store.clone(),
            snapshot_store.clone(),
            logger,
            config,
            capability_issuer,
        );

        let run_id = RunId::new("test-run-sqlite-1").unwrap();
        runtime.create_run(run_id.clone()).await.unwrap();

        runtime
            .transition_run(&run_id, RunState::Admitted, 1)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id, RunState::Running, 2)
            .await
            .unwrap();

        // Create snapshot
        runtime.create_snapshot(&run_id).await.unwrap();

        // Simulate recovery with same stores (new runtime instance)
        let logger_new = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config_new = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer_new = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let recovered_runtime = KernelRuntime::new(
            event_store,
            snapshot_store,
            logger_new,
            config_new,
            capability_issuer_new,
        );
        let recovered_run = recovered_runtime.recover_run(&run_id).await.unwrap();

        assert_eq!(recovered_run.state, RunState::Running);
        assert_eq!(recovered_run.version, 3);
    });
}

#[test]
fn test_structured_logging() {
    let rt = test_runtime();
    rt.block_on(async {
        let logger = InMemoryLogger::new(LogLevel::Debug);
        let log_entry = LogEntry {
            level: LogLevel::Info,
            timestamp: 12345,
            component: "TestComponent".to_string(),
            message: "Test message".to_string(),
            fields: vec![("key".to_string(), "value".to_string())],
            correlation_id: Some("test-correlation".to_string()),
        };

        logger.log(log_entry.clone()).await.unwrap();

        let entries = logger.entries().await;
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].level, LogLevel::Info);
        assert_eq!(entries[0].message, "Test message");
    });
}

#[test]
fn test_config_layer() {
    let mut config = InMemoryConfig::new(vec!["required_key".to_string()]);

    // Test missing required key
    assert!(config.validate().is_err());

    // Set required key
    config
        .set("required_key".to_string(), "required_value".to_string())
        .unwrap();

    // Validation should pass now
    assert!(config.validate().is_ok());

    // Test get/set
    config
        .set("test_key".to_string(), "test_value".to_string())
        .unwrap();
    assert_eq!(config.get("test_key").unwrap(), "test_value");
}

#[test]
fn test_capability_issuer() {
    let rt = test_runtime();
    rt.block_on(async {
        let issuer = InMemoryCapabilityIssuer::new();

        let grant = CapabilityGrant {
            capability_type: CapabilityType::Read,
            resource: "test_resource".to_string(),
            permission: "read".to_string(),
            expires_at: 0,
            grant_id: "test_grant_1".to_string(),
        };

        let grant_id = issuer.issue(grant.clone()).await.unwrap();
        assert_eq!(grant_id, "test_grant_1");

        // Validate the grant
        assert!(issuer.validate("test_grant_1").await.unwrap());

        // Revoke the grant
        issuer.revoke("test_grant_1").await.unwrap();

        // Validation should fail after revocation
        assert!(!issuer.validate("test_grant_1").await.unwrap());
    });
}

#[test]
fn test_deterministic_clock() {
    let clock = TestClock::new();

    assert_eq!(clock.now(), 0);

    clock.advance(100);
    assert_eq!(clock.now(), 100);

    clock.advance(50);
    assert_eq!(clock.now(), 150);

    clock.set(999);
    assert_eq!(clock.now(), 999);
}

#[test]
fn test_deterministic_id_generator() {
    let generator = TestIdGenerator::new();

    let id1 = generator.generate();
    let id2 = generator.generate();
    let id3 = generator.generate();

    assert_eq!(id1, "test-1");
    assert_eq!(id2, "test-2");
    assert_eq!(id3, "test-3");

    let uuid1 = generator.generate_uuid();
    let uuid2 = generator.generate_uuid();

    assert_ne!(uuid1, uuid2);
    assert!(uuid1.starts_with("00000004-"));
    assert!(uuid2.starts_with("00000005-"));
}
