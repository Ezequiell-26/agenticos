#![forbid(unsafe_code)]
#![deny(missing_docs)]

//! Smoke tests for the AgentiCOS kernel durable runtime.

use agenticos_contracts::{RunId, RunState};
use agenticos_kernel::{
    InMemoryEventStore, InMemorySnapshotStore, KernelRuntime, SqliteEventStore, SqliteSnapshotStore,
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
        let runtime = KernelRuntime::new(event_store, snapshot_store);

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
        let runtime = KernelRuntime::new(event_store, snapshot_store);

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
        let runtime = KernelRuntime::new(event_store, snapshot_store);

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
        let runtime = KernelRuntime::new(event_store.clone(), snapshot_store.clone());

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
        let recovered_runtime = KernelRuntime::new(event_store, snapshot_store);
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
        let runtime = KernelRuntime::new(event_store, snapshot_store);

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
        let runtime = KernelRuntime::new(event_store, snapshot_store);

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

        let runtime = KernelRuntime::new(event_store.clone(), snapshot_store.clone());

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
        let recovered_runtime = KernelRuntime::new(event_store, snapshot_store);
        let recovered_run = recovered_runtime.recover_run(&run_id).await.unwrap();

        assert_eq!(recovered_run.state, RunState::Running);
        assert_eq!(recovered_run.version, 3);
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
        assert!(!store
            .is_valid("run-lease", "worker-a", first.fencing_token, now + 61)
            .await);
        assert!(store
            .is_valid("run-lease", "worker-b", second.fencing_token, now + 61)
            .await);
    });
}
