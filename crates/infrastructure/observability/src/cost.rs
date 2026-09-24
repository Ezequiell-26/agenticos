#![forbid(unsafe_code)]
#![warn(missing_docs)]

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Arc;

/// Pricing in USD per one million model tokens.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct TokenPricing {
    /// Provider id.
    pub provider_id: String,
    /// Model id or "*" for provider-wide pricing.
    pub model_id: String,
    /// USD per million tokens.
    pub usd_per_million_tokens: f64,
}

/// Durable model usage record.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct UsageRecord {
    /// Request id.
    pub request_id: String,
    /// Provider id.
    pub provider_id: String,
    /// Model id.
    pub model_id: String,
    /// Tokens used.
    pub tokens_used: u64,
    /// Calculated USD cost.
    pub cost_usd: f64,
    /// Unix timestamp.
    pub recorded_at: u64,
}

/// SQLite-backed cost ledger.
#[derive(Clone, Debug)]
pub struct CostLedger {
    pool: Arc<SqlitePool>,
}

impl CostLedger {
    /// Open the ledger and initialize its tables.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let pool = SqlitePool::connect(database_url)
            .await
            .map_err(|e| format!("cost ledger connection failed: {e}"))?;
        sqlx::query("CREATE TABLE IF NOT EXISTS model_pricing (provider_id TEXT NOT NULL, model_id TEXT NOT NULL, usd_per_million_tokens REAL NOT NULL, PRIMARY KEY(provider_id, model_id))")
            .execute(&pool).await.map_err(|e| format!("pricing schema failed: {e}"))?;
        sqlx::query("CREATE TABLE IF NOT EXISTS model_usage (request_id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, model_id TEXT NOT NULL, tokens_used INTEGER NOT NULL, cost_usd REAL NOT NULL, recorded_at INTEGER NOT NULL)")
            .execute(&pool).await.map_err(|e| format!("usage schema failed: {e}"))?;
        Ok(Self {
            pool: Arc::new(pool),
        })
    }

    /// Upsert a pricing rule.
    pub async fn set_pricing(&self, pricing: TokenPricing) -> Result<(), String> {
        if pricing.provider_id.trim().is_empty()
            || pricing.model_id.trim().is_empty()
            || !pricing.usd_per_million_tokens.is_finite()
            || pricing.usd_per_million_tokens < 0.0
        {
            return Err("invalid token pricing".to_string());
        }
        sqlx::query("INSERT INTO model_pricing (provider_id, model_id, usd_per_million_tokens) VALUES (?, ?, ?) ON CONFLICT(provider_id, model_id) DO UPDATE SET usd_per_million_tokens = excluded.usd_per_million_tokens")
            .bind(pricing.provider_id).bind(pricing.model_id).bind(pricing.usd_per_million_tokens)
            .execute(self.pool.as_ref()).await.map_err(|e| format!("pricing persistence failed: {e}"))?;
        Ok(())
    }

    async fn price(&self, provider_id: &str, model_id: &str) -> Result<f64, String> {
        let result = sqlx::query_scalar::<_, f64>("SELECT usd_per_million_tokens FROM model_pricing WHERE provider_id = ? AND model_id IN (?, '*') ORDER BY CASE WHEN model_id = ? THEN 0 ELSE 1 END LIMIT 1")
            .bind(provider_id).bind(model_id).bind(model_id).fetch_optional(self.pool.as_ref())
            .await.map_err(|e| format!("pricing lookup failed: {e}"))?;
        Ok(result.unwrap_or(0.0))
    }

    /// Record usage idempotently.
    pub async fn record(
        &self,
        request_id: &str,
        provider_id: &str,
        model_id: &str,
        tokens_used: u64,
        recorded_at: u64,
    ) -> Result<UsageRecord, String> {
        let cost_usd =
            (tokens_used as f64 / 1_000_000.0) * self.price(provider_id, model_id).await?;
        let record = UsageRecord {
            request_id: request_id.to_string(),
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            tokens_used,
            cost_usd,
            recorded_at,
        };
        sqlx::query("INSERT INTO model_usage (request_id, provider_id, model_id, tokens_used, cost_usd, recorded_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING")
            .bind(&record.request_id)
            .bind(&record.provider_id)
            .bind(&record.model_id)
            .bind(record.tokens_used as i64)
            .bind(record.cost_usd)
            .bind(record.recorded_at as i64)
            .execute(self.pool.as_ref())
            .await
            .map_err(|e| format!("usage persistence failed: {e}"))?;

        let stored = sqlx::query_as::<_, (String, String, String, i64, f64, i64)>(
            "SELECT request_id, provider_id, model_id, tokens_used, cost_usd, recorded_at
             FROM model_usage WHERE request_id = ?",
        )
        .bind(&record.request_id)
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| format!("usage reread failed: {e}"))?;

        Ok(UsageRecord {
            request_id: stored.0,
            provider_id: stored.1,
            model_id: stored.2,
            tokens_used: stored.3.max(0) as u64,
            cost_usd: stored.4,
            recorded_at: stored.5.max(0) as u64,
        })
    }

    /// Return aggregate usage since a unix timestamp.
    pub async fn summary_since(&self, since: u64) -> Result<(u64, f64), String> {
        let row = sqlx::query_as::<_, (i64, f64)>("SELECT COALESCE(SUM(tokens_used), 0), COALESCE(SUM(cost_usd), 0) FROM model_usage WHERE recorded_at >= ?")
            .bind(since as i64).fetch_one(self.pool.as_ref()).await.map_err(|e| format!("usage summary failed: {e}"))?;
        Ok((row.0.max(0) as u64, row.1))
    }

    /// List recent usage.
    pub async fn list_recent(&self, limit: usize) -> Result<Vec<UsageRecord>, String> {
        let limit = limit.clamp(1, 500) as i64;
        let rows = sqlx::query_as::<_, (String,String,String,i64,f64,i64)>("SELECT request_id, provider_id, model_id, tokens_used, cost_usd, recorded_at FROM model_usage ORDER BY recorded_at DESC LIMIT ?")
            .bind(limit).fetch_all(self.pool.as_ref()).await.map_err(|e| format!("usage listing failed: {e}"))?;
        Ok(rows
            .into_iter()
            .map(|r| UsageRecord {
                request_id: r.0,
                provider_id: r.1,
                model_id: r.2,
                tokens_used: r.3.max(0) as u64,
                cost_usd: r.4,
                recorded_at: r.5.max(0) as u64,
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn ledger_records_cost_idempotently() {
        let path = std::env::temp_dir().join(format!("agenticos-cost-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let ledger = CostLedger::open(&url).await.unwrap();
        ledger
            .set_pricing(TokenPricing {
                provider_id: "p".into(),
                model_id: "*".into(),
                usd_per_million_tokens: 2.0,
            })
            .await
            .unwrap();
        let record = ledger.record("r1", "p", "m", 500_000, 10).await.unwrap();
        assert!((record.cost_usd - 1.0).abs() < f64::EPSILON);
        ledger.record("r1", "p", "m", 500_000, 10).await.unwrap();
        assert_eq!(ledger.summary_since(0).await.unwrap().0, 500_000);
        let _ = std::fs::remove_file(path);
    }
}
