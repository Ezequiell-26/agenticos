#![forbid(unsafe_code)]
#![deny(missing_docs)]

//! Smoke tests for the AgentiCOS kernel durable runtime.

use agenticos_contracts::{
    CapabilityGrant, CapabilityIssuer, CapabilityType, ConfigLayer, EventStore, FeatureFlag,
    FeatureFlagStore, FlagValue, LogEntry, LogLevel, Logger, ModelProvider, ModelRequest,
    OutboxStore, RunId, RunState, Saga, SagaCoordinator, SagaStatus, SagaStep, SagaStepStatus,
    SagaStepType,
};
use agenticos_kernel::{
    BackgroundEventPublisher, HttpModelProvider, InMemoryCapabilityIssuer, InMemoryConfig,
    InMemoryEventStore, InMemoryFeatureFlagStore, InMemoryLogger, InMemoryOutboxStore,
    InMemorySagaCoordinator, InMemorySnapshotStore, KernelRuntime, SqliteEventStore,
    SqliteSnapshotStore, TestClock, TestIdGenerator,
};
use std::sync::Arc;

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

        // Validate the grant with expiry
        assert!(issuer.validate_with_expiry("test_grant_1").await.unwrap());

        // Revoke the grant
        issuer.revoke("test_grant_1").await.unwrap();

        // Validation should fail after revocation
        assert!(!issuer.validate_with_expiry("test_grant_1").await.unwrap());
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

#[test]
fn test_outbox_store() {
    let rt = test_runtime();
    rt.block_on(async {
        let outbox = InMemoryOutboxStore::new();

        let event = agenticos_contracts::SerializedEvent {
            event_type: "test_event".to_string(),
            data: serde_json::json!({"data": "test"}).to_string(),
            schema_version: 1,
        };

        let entry = agenticos_contracts::OutboxEntry {
            entry_id: "test-entry-1".to_string(),
            event: event.clone(),
            destination: "test-queue".to_string(),
            attempts: 0,
            status: agenticos_contracts::OutboxStatus::Pending,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            processed_at: None,
        };

        outbox.add(entry).await.unwrap();

        let pending = outbox.get_pending(10).await.unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].entry_id, "test-entry-1");

        outbox.mark_published("test-entry-1").await.unwrap();

        let pending_after = outbox.get_pending(10).await.unwrap();
        assert_eq!(pending_after.len(), 0);
    });
}

#[test]
fn test_background_event_publisher() {
    let rt = test_runtime();
    rt.block_on(async {
        let outbox = Arc::new(InMemoryOutboxStore::new());
        let publisher = BackgroundEventPublisher::new(outbox.clone());

        let event = agenticos_contracts::SerializedEvent {
            event_type: "test_event".to_string(),
            data: serde_json::json!({"data": "test"}).to_string(),
            schema_version: 1,
        };

        let entry = agenticos_contracts::OutboxEntry {
            entry_id: "test-entry-pub".to_string(),
            event: event.clone(),
            destination: "test-queue".to_string(),
            attempts: 0,
            status: agenticos_contracts::OutboxStatus::Pending,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            processed_at: None,
        };

        outbox.add(entry).await.unwrap();

        let published = publisher.process_pending().await.unwrap();
        assert_eq!(published, 1);
    });
}

#[test]
fn test_saga_coordinator() {
    let rt = test_runtime();
    rt.block_on(async {
        let coordinator = InMemorySagaCoordinator::new();

        let saga = Saga {
            saga_id: "test-saga-1".to_string(),
            name: "Test Saga".to_string(),
            steps: vec![
                SagaStep {
                    step_id: "step-1".to_string(),
                    name: "Step 1".to_string(),
                    step_type: SagaStepType::Execute,
                    payload: serde_json::json!({"action": "test"}),
                    status: SagaStepStatus::Pending,
                    created_at: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                    completed_at: None,
                },
                SagaStep {
                    step_id: "step-2".to_string(),
                    name: "Step 2".to_string(),
                    step_type: SagaStepType::Execute,
                    payload: serde_json::json!({"action": "test2"}),
                    status: SagaStepStatus::Pending,
                    created_at: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                    completed_at: None,
                },
            ],
            status: SagaStatus::Pending,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            completed_at: None,
            current_step_index: None,
        };

        coordinator.start_saga(saga).await.unwrap();

        let retrieved = coordinator.get_saga("test-saga-1").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().steps.len(), 2);

        coordinator.execute_next_step("test-saga-1").await.unwrap();

        let after_execute = coordinator.get_saga("test-saga-1").await.unwrap();
        assert!(after_execute.is_some());
        let saga_state = after_execute.unwrap();
        assert_eq!(saga_state.current_step_index, Some(0));
        assert_eq!(saga_state.status, SagaStatus::InProgress);
    });
}

#[test]
fn test_saga_compensation() {
    let rt = test_runtime();
    rt.block_on(async {
        let coordinator = InMemorySagaCoordinator::new();

        let saga = Saga {
            saga_id: "test-saga-comp-1".to_string(),
            name: "Test Compensation Saga".to_string(),
            steps: vec![SagaStep {
                step_id: "step-1".to_string(),
                name: "Step 1".to_string(),
                step_type: SagaStepType::Execute,
                payload: serde_json::json!({"action": "test"}),
                status: SagaStepStatus::Completed,
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
                completed_at: Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                ),
            }],
            status: SagaStatus::InProgress,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            completed_at: None,
            current_step_index: Some(0),
        };

        coordinator.start_saga(saga).await.unwrap();

        coordinator
            .compensate_saga("test-saga-comp-1")
            .await
            .unwrap();

        let after_compensate = coordinator.get_saga("test-saga-comp-1").await.unwrap();
        assert!(after_compensate.is_some());
        let saga_state = after_compensate.unwrap();
        assert_eq!(saga_state.status, SagaStatus::Compensated);
    });
}

#[test]
fn test_feature_flag_store() {
    let rt = test_runtime();
    rt.block_on(async {
        let store = InMemoryFeatureFlagStore::new();

        let flag = FeatureFlag {
            flag_id: "test-flag-1".to_string(),
            name: "Test Flag".to_string(),
            value: FlagValue::Boolean(true),
            enabled: true,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        store.set_flag(flag).await.unwrap();

        let retrieved = store.get_flag("test-flag-1").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().flag_id, "test-flag-1");

        let is_enabled = store.is_enabled("test-flag-1").await.unwrap();
        assert!(is_enabled);
    });
}

#[test]
fn test_feature_flag_enable_disable() {
    let rt = test_runtime();
    rt.block_on(async {
        let store = InMemoryFeatureFlagStore::new();

        let flag = FeatureFlag {
            flag_id: "test-flag-2".to_string(),
            name: "Test Flag 2".to_string(),
            value: FlagValue::String("value".to_string()),
            enabled: false,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        store.set_flag(flag).await.unwrap();

        let is_enabled = store.is_enabled("test-flag-2").await.unwrap();
        assert!(!is_enabled);

        store.enable_flag("test-flag-2").await.unwrap();

        let is_enabled_after = store.is_enabled("test-flag-2").await.unwrap();
        assert!(is_enabled_after);

        store.disable_flag("test-flag-2").await.unwrap();

        let is_disabled = store.is_enabled("test-flag-2").await.unwrap();
        assert!(!is_disabled);
    });
}

#[test]
fn test_feature_flag_types() {
    let rt = test_runtime();
    rt.block_on(async {
        let store = InMemoryFeatureFlagStore::new();

        let bool_flag = FeatureFlag {
            flag_id: "bool-flag".to_string(),
            name: "Boolean Flag".to_string(),
            value: FlagValue::Boolean(true),
            enabled: true,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let string_flag = FeatureFlag {
            flag_id: "string-flag".to_string(),
            name: "String Flag".to_string(),
            value: FlagValue::String("test".to_string()),
            enabled: true,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let numeric_flag = FeatureFlag {
            flag_id: "numeric-flag".to_string(),
            name: "Numeric Flag".to_string(),
            value: FlagValue::Numeric(42.0),
            enabled: true,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        store.set_flag(bool_flag).await.unwrap();
        store.set_flag(string_flag).await.unwrap();
        store.set_flag(numeric_flag).await.unwrap();

        let flags = store.list_flags().await.unwrap();
        assert_eq!(flags.len(), 3);

        let bool_value = store.get_value("bool-flag").await.unwrap();
        assert!(bool_value.is_some());
        matches!(bool_value.unwrap(), FlagValue::Boolean(true));

        let string_value = store.get_value("string-flag").await.unwrap();
        assert!(string_value.is_some());
        matches!(string_value.unwrap(), FlagValue::String(_));

        let numeric_value = store.get_value("numeric-flag").await.unwrap();
        assert!(numeric_value.is_some());
        matches!(numeric_value.unwrap(), FlagValue::Numeric(_));
    });
}

#[test]
fn test_http_model_provider() {
    let rt = test_runtime();
    rt.block_on(async {
        let provider = HttpModelProvider::new("https://api.example.com".to_string());

        assert_eq!(provider.provider_id(), "http-model-provider");

        let request = ModelRequest {
            request_id: "test-request".to_string(),
            model: "gpt-4".to_string(),
            input: "Test input".to_string(),
            parameters: None,
        };

        let response = provider.execute(request).await.unwrap();

        assert_eq!(response.request_id, "test-request");
        assert!(response.output.contains("gpt-4"));
        assert!(response.output.contains("Test input"));
        assert!(response.metadata.is_some());
        assert_eq!(response.tokens_used, Some(100));
    });
}

#[test]
fn test_http_model_provider_with_custom_id() {
    let rt = test_runtime();
    rt.block_on(async {
        let provider = HttpModelProvider::with_provider_id(
            "https://api.example.com".to_string(),
            "custom-provider".to_string(),
        );

        assert_eq!(provider.provider_id(), "custom-provider");

        let request = ModelRequest {
            request_id: "test-request-2".to_string(),
            model: "gpt-3.5".to_string(),
            input: "Another test".to_string(),
            parameters: None,
        };

        let response = provider.execute(request).await.unwrap();

        assert_eq!(response.request_id, "test-request-2");
        assert!(response.output.contains("gpt-3.5"));
    });
}

#[test]
fn test_multi_run_orchestration() {
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

        // Create multiple runs
        let run_id_1 = RunId::new("multi-run-1").unwrap();
        let run_id_2 = RunId::new("multi-run-2").unwrap();
        let run_id_3 = RunId::new("multi-run-3").unwrap();

        runtime.create_run(run_id_1.clone()).await.unwrap();
        runtime.create_run(run_id_2.clone()).await.unwrap();
        runtime.create_run(run_id_3.clone()).await.unwrap();

        // Transition runs to different states (using correct version numbers)
        runtime
            .transition_run(&run_id_1, RunState::Admitted, 1)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id_2, RunState::Admitted, 1)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id_2, RunState::Running, 2)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id_3, RunState::Admitted, 1)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id_3, RunState::Running, 2)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id_3, RunState::Completed, 3)
            .await
            .unwrap();

        // Verify all runs are in correct states
        let runs = runtime.runs.read().await;
        assert_eq!(runs.len(), 3);
        assert_eq!(runs.get(&run_id_1).unwrap().state, RunState::Admitted);
        assert_eq!(runs.get(&run_id_2).unwrap().state, RunState::Running);
        assert_eq!(runs.get(&run_id_3).unwrap().state, RunState::Completed);
    });
}

#[test]
fn test_event_store_recovery() {
    let rt = test_runtime();
    rt.block_on(async {
        let event_store = std::sync::Arc::new(InMemoryEventStore::new());
        let snapshot_store = std::sync::Arc::new(InMemorySnapshotStore::new());
        let logger = std::sync::Arc::new(InMemoryLogger::new(LogLevel::Info));
        let config = std::sync::Arc::new(tokio::sync::RwLock::new(InMemoryConfig::default()));
        let capability_issuer = std::sync::Arc::new(InMemoryCapabilityIssuer::new());
        let runtime = KernelRuntime::new(
            event_store.clone(),
            snapshot_store,
            logger,
            config,
            capability_issuer,
        );

        let run_id = RunId::new("recovery-run").unwrap();
        runtime.create_run(run_id.clone()).await.unwrap();
        runtime
            .transition_run(&run_id, RunState::Admitted, 1)
            .await
            .unwrap();
        runtime
            .transition_run(&run_id, RunState::Running, 2)
            .await
            .unwrap();

        // Recover the run
        let recovered_run = runtime.recover_run(&run_id).await.unwrap();

        // Verify recovered state
        assert_eq!(recovered_run.state, RunState::Running);

        // Verify events were stored
        let stream_id = format!("run:{}", run_id.as_str());
        let events = event_store.read_after(&stream_id, 0).await.unwrap();
        assert!(events.len() >= 2); // At least Created and Admitted/Running
    });
}

#[test]
fn test_lease_store_rejects_active_replacement_and_preserves_fencing_monotonicity() {
    let rt = test_runtime();
    rt.block_on(async {
        let store = agenticos_kernel::InMemoryLeaseStore::new();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let first = store
            .acquire("run-lease".to_string(), "worker-a".to_string(), now + 60)
            .await
            .unwrap();
        let blocked = store
            .acquire("run-lease".to_string(), "worker-b".to_string(), now + 120)
            .await;
        assert!(blocked.is_err());
        store.release("run-lease").await.unwrap();
        let second = store
            .acquire("run-lease".to_string(), "worker-b".to_string(), now + 180)
            .await
            .unwrap();
        assert!(second.fencing_token > first.fencing_token);
        assert!(
            !store
                .is_valid("run-lease", "worker-a", first.fencing_token, now + 61)
                .await
        );
        assert!(
            store
                .is_valid("run-lease", "worker-b", second.fencing_token, now + 61)
                .await
        );
    });
}
