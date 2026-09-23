#![forbid(unsafe_code)]

//! Cooldown ladder and quota enforcement engine.
//! Inspired by FreeLLMAPI's quota and cooldown engine.

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Cooldown ladder step (exponential backoff).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CooldownStep {
    /// Duration in seconds
    pub duration_secs: u64,
    /// Step index
    pub step_index: u32,
}

impl CooldownStep {
    /// Create a new cooldown step.
    pub fn new(duration_secs: u64, step_index: u32) -> Self {
        Self {
            duration_secs,
            step_index,
        }
    }
}

/// Cooldown ladder: 90s → 2m → 10m → 1h → 1d.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CooldownLadder {
    steps: Vec<CooldownStep>,
}

impl CooldownLadder {
    /// Create the standard FreeLLMAPI cooldown ladder.
    pub fn standard() -> Self {
        Self {
            steps: vec![
                CooldownStep::new(90, 0),    // 90 seconds
                CooldownStep::new(120, 1),   // 2 minutes
                CooldownStep::new(600, 2),   // 10 minutes
                CooldownStep::new(3600, 3),  // 1 hour
                CooldownStep::new(86400, 4), // 1 day
            ],
        }
    }

    /// Get the next cooldown duration for a given step.
    pub fn get_next_cooldown(&self, current_step: u32) -> Option<u64> {
        self.steps
            .iter()
            .find(|s| s.step_index == current_step)
            .map(|s| s.duration_secs)
    }

    /// Advance to the next cooldown step.
    pub fn advance_step(&self, current_step: u32) -> u32 {
        if current_step < (self.steps.len() as u32 - 1) {
            current_step + 1
        } else {
            current_step // Stay at max step
        }
    }

    /// Reset cooldown step (on success).
    pub fn reset_step(&self) -> u32 {
        0
    }
}

impl Default for CooldownLadder {
    fn default() -> Self {
        Self::standard()
    }
}

/// Quota enforcement engine with RPM/RPD/TPM/TPD tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaEngine {
    /// Requests per minute limit
    pub rpm_limit: u32,
    /// Requests per day limit
    pub rpd_limit: u32,
    /// Tokens per minute limit
    pub tpm_limit: u32,
    /// Tokens per day limit
    pub tpd_limit: u32,
    /// Current RPM count
    pub rpm_count: u32,
    /// Current RPD count
    pub rpd_count: u32,
    /// Current TPM count
    pub tpm_count: u32,
    /// Current TPD count
    pub tpd_count: u32,
    /// Last minute reset timestamp
    pub last_minute_reset: u64,
    /// Last day reset timestamp
    pub last_day_reset: u64,
    /// Cooldown ladder
    pub cooldown_ladder: CooldownLadder,
    /// Current cooldown step
    pub cooldown_step: u32,
    /// Cooldown end timestamp
    pub cooldown_until: Option<u64>,
}

impl QuotaEngine {
    /// Create a new quota engine.
    pub fn new(rpm_limit: u32, rpd_limit: u32, tpm_limit: u32, tpd_limit: u32) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            rpm_limit,
            rpd_limit,
            tpm_limit,
            tpd_limit,
            rpm_count: 0,
            rpd_count: 0,
            tpm_count: 0,
            tpd_count: 0,
            last_minute_reset: now,
            last_day_reset: now,
            cooldown_ladder: CooldownLadder::standard(),
            cooldown_step: 0,
            cooldown_until: None,
        }
    }

    /// Check if the request is allowed under quota limits.
    pub fn is_allowed(&self, tokens: u32) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Check cooldown
        if let Some(cooldown) = self.cooldown_until {
            if now < cooldown {
                return false;
            }
        }

        // Check RPM
        if self.rpm_count >= self.rpm_limit {
            return false;
        }

        // Check RPD
        if self.rpd_count >= self.rpd_limit {
            return false;
        }

        // Check TPM
        if self.tpm_count + tokens > self.tpm_limit {
            return false;
        }

        // Check TPD
        if self.tpd_count + tokens > self.tpd_limit {
            return false;
        }

        true
    }

    /// Record a request with token count.
    pub fn record_request(&mut self, tokens: u32) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Reset minute counter if needed
        if now - self.last_minute_reset >= 60 {
            self.rpm_count = 0;
            self.tpm_count = 0;
            self.last_minute_reset = now;
        }

        // Reset day counter if needed
        if now - self.last_day_reset >= 86400 {
            self.rpd_count = 0;
            self.tpd_count = 0;
            self.last_day_reset = now;
        }

        self.rpm_count += 1;
        self.rpd_count += 1;
        self.tpm_count += tokens;
        self.tpd_count += tokens;
    }

    /// Record a rate limit error and apply cooldown.
    pub fn record_rate_limit(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let cooldown_duration = self
            .cooldown_ladder
            .get_next_cooldown(self.cooldown_step)
            .unwrap_or(86400); // Default to 1 day if at max step

        self.cooldown_until = Some(now + cooldown_duration);
        self.cooldown_step = self.cooldown_ladder.advance_step(self.cooldown_step);
    }

    /// Record a successful request and reset cooldown.
    pub fn record_success(&mut self) {
        self.cooldown_step = self.cooldown_ladder.reset_step();
        self.cooldown_until = None;
    }

    /// Get remaining quota percentage (0-1).
    pub fn headroom(&self) -> f64 {
        let rpm_headroom = if self.rpm_limit > 0 {
            (self.rpm_limit - self.rpm_count) as f64 / self.rpm_limit as f64
        } else {
            1.0
        };

        let rpd_headroom = if self.rpd_limit > 0 {
            (self.rpd_limit - self.rpd_count) as f64 / self.rpd_limit as f64
        } else {
            1.0
        };

        rpm_headroom.min(rpd_headroom)
    }

    /// Clear expired cooldown.
    pub fn clear_cooldown_if_expired(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        if let Some(cooldown) = self.cooldown_until {
            if now >= cooldown {
                self.cooldown_until = None;
                self.cooldown_step = self.cooldown_ladder.reset_step();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cooldown_ladder() {
        let ladder = CooldownLadder::standard();

        assert_eq!(ladder.get_next_cooldown(0), Some(90));
        assert_eq!(ladder.get_next_cooldown(1), Some(120));
        assert_eq!(ladder.get_next_cooldown(2), Some(600));
        assert_eq!(ladder.get_next_cooldown(3), Some(3600));
        assert_eq!(ladder.get_next_cooldown(4), Some(86400));
        assert_eq!(ladder.get_next_cooldown(5), None);
    }

    #[test]
    fn test_quota_engine_allowed() {
        let mut engine = QuotaEngine::new(10, 1000, 10000, 100000);

        assert!(engine.is_allowed(100));

        engine.record_request(100);
        assert!(engine.is_allowed(100));

        // Exceed RPM
        for _ in 0..10 {
            engine.record_request(100);
        }
        assert!(!engine.is_allowed(100));
    }

    #[test]
    fn test_quota_engine_cooldown() {
        let mut engine = QuotaEngine::new(10, 1000, 10000, 100000);

        engine.record_rate_limit();

        assert!(engine.cooldown_until.is_some());
        assert_eq!(engine.cooldown_step, 1);
    }

    #[test]
    fn test_quota_engine_headroom() {
        let mut engine = QuotaEngine::new(10, 1000, 10000, 100000);

        assert_eq!(engine.headroom(), 1.0);

        engine.record_request(100);
        assert!(engine.headroom() < 1.0);
    }
}
