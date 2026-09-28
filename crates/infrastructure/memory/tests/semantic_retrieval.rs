use agenticos_contracts::ContractError;
use agenticos_memory::{PersistentMemoryStore, SemanticRetrievalCase};

async fn store() -> (PersistentMemoryStore, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!(
        "agenticos-memory-semantic-regression-{}.db",
        uuid::Uuid::new_v4()
    ));
    let url = format!("sqlite://{}?mode=rwc", path.display());
    let store = PersistentMemoryStore::new(&url).await.unwrap();
    (store, path)
}

#[tokio::test]
async fn semantic_retrieval_reports_deterministic_rank_metrics() {
    let (store, path) = store().await;

    let distractor = store
        .upsert(
            "project:regression",
            "exact-distractor",
            "same semantic neighborhood",
            &["distractor".to_string()],
            1.0,
            0,
        )
        .await
        .unwrap();
    let relevant = store
        .upsert(
            "project:regression",
            "relevant",
            "the target memory",
            &["target".to_string()],
            0.0,
            0,
        )
        .await
        .unwrap();
    let unrelated = store
        .upsert(
            "project:regression",
            "unrelated",
            "different topic",
            &["other".to_string()],
            0.0,
            0,
        )
        .await
        .unwrap();

    store
        .set_embedding(&distractor.memory_id, &[1.0, 0.0])
        .await
        .unwrap();
    store
        .set_embedding(&relevant.memory_id, &[0.8, 0.6])
        .await
        .unwrap();
    store
        .set_embedding(&unrelated.memory_id, &[0.0, 1.0])
        .await
        .unwrap();

    let report = store
        .evaluate_semantic_retrieval(
            "project:regression",
            &[SemanticRetrievalCase {
                query_embedding: vec![1.0, 0.0],
                relevant_memory_ids: vec![relevant.memory_id.clone()],
            }],
            2,
        )
        .await
        .unwrap();

    assert_eq!(report.evaluated_queries, 1);
    assert_eq!(report.hit_at_1, 0);
    assert_eq!(report.hit_at_k, 1);
    assert!((report.mean_reciprocal_rank - 0.5).abs() < f64::EPSILON);

    let _ = std::fs::remove_file(path);
}

#[tokio::test]
async fn semantic_retrieval_isolated_by_namespace() {
    let (store, path) = store().await;

    let foreign = store
        .upsert(
            "project:foreign",
            "target",
            "should never leak into another namespace",
            &[],
            1.0,
            0,
        )
        .await
        .unwrap();
    let local = store
        .upsert(
            "project:local",
            "target",
            "correct namespace memory",
            &[],
            0.1,
            0,
        )
        .await
        .unwrap();

    store
        .set_embedding(&foreign.memory_id, &[1.0, 0.0])
        .await
        .unwrap();
    store
        .set_embedding(&local.memory_id, &[1.0, 0.0])
        .await
        .unwrap();

    let results = store
        .search_semantic("project:local", &[1.0, 0.0], 10)
        .await
        .unwrap();

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].memory_id, local.memory_id);
    assert!(results.iter().all(|record| record.namespace == "project:local"));

    let _ = std::fs::remove_file(path);
}

#[tokio::test]
async fn embedding_backfill_has_complete_and_deterministic_coverage() {
    let (store, path) = store().await;

    let high = store
        .upsert(
            "project:backfill",
            "high",
            "high priority missing embedding",
            &[],
            0.9,
            0,
        )
        .await
        .unwrap();
    let medium = store
        .upsert(
            "project:backfill",
            "medium",
            "medium priority missing embedding",
            &[],
            0.6,
            0,
        )
        .await
        .unwrap();
    let already = store
        .upsert(
            "project:backfill",
            "already",
            "already embedded",
            &[],
            0.3,
            0,
        )
        .await
        .unwrap();

    store
        .set_embedding(&already.memory_id, &[0.0, 1.0])
        .await
        .unwrap();

    let coverage = store
        .embedding_coverage("project:backfill")
        .await
        .unwrap();
    assert_eq!(coverage.total_records, 3);
    assert_eq!(coverage.embedded_records, 1);
    assert_eq!(coverage.missing_records, 2);

    let missing = store
        .records_missing_embeddings("project:backfill", 10)
        .await
        .unwrap();
    assert_eq!(missing.len(), 2);
    assert_eq!(missing[0].memory_id, high.memory_id);
    assert_eq!(missing[1].memory_id, medium.memory_id);

    for record in &missing {
        let embedding = if record.memory_id == high.memory_id {
            vec![1.0, 0.0]
        } else {
            vec![0.5, 0.5]
        };
        store.set_embedding(&record.memory_id, &embedding).await.unwrap();
    }

    let complete = store
        .embedding_coverage("project:backfill")
        .await
        .unwrap();
    assert_eq!(complete.total_records, 3);
    assert_eq!(complete.embedded_records, 3);
    assert_eq!(complete.missing_records, 0);

    let remaining = store
        .records_missing_embeddings("project:backfill", 10)
        .await
        .unwrap();
    assert!(remaining.is_empty());

    let _ = std::fs::remove_file(path);
}

#[tokio::test]
async fn invalid_semantic_queries_fail_closed() {
    let (store, path) = store().await;

    let invalid_dimension = store
        .search_semantic("project:invalid", &[], 10)
        .await
        .unwrap_err();
    assert!(matches!(invalid_dimension, ContractError::ParseError(_)));

    let non_finite = store
        .search_semantic("project:invalid", &[f32::NAN], 10)
        .await
        .unwrap_err();
    assert!(matches!(non_finite, ContractError::ParseError(_)));

    let zero_magnitude = store
        .search_semantic("project:invalid", &[0.0, 0.0], 10)
        .await
        .unwrap_err();
    assert!(zero_magnitude.to_string().contains("zero magnitude"));

    let _ = std::fs::remove_file(path);
}
