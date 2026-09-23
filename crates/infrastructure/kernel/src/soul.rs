//! SOUL System - Agent Personality and Memory
//!
//! Adapted from Hermes Agent's SOUL.md and hermes_state system.
//! The SOUL is the agent's persistent personality, memory, and self-concept.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// The SOUL (Self-Organizing Universal Layer) represents the agent's
/// personality, memory, and self-concept. It's stored persistently and
/// updated as the agent learns and evolves.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Soul {
    /// Agent identity and purpose
    pub identity: String,

    /// Personality traits and behavioral guidelines
    pub personality: String,

    /// Long-term memory and knowledge accumulated over time
    pub memory: String,

    /// User preferences and context
    pub user_profile: String,

    /// Skills and capabilities that have been crystallized
    pub skills: Vec<SkillEntry>,

    /// Learning milestones and discoveries
    pub milestones: Vec<Milestone>,

    /// Version of the SOUL for tracking evolution
    pub version: u32,
}

/// A skill that has been crystallized from agent experience
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillEntry {
    /// Unique identifier for the skill
    pub id: String,

    /// Skill name
    pub name: String,

    /// Skill description
    pub description: String,

    /// When this skill was first created
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// Number of times this skill has been used successfully
    pub usage_count: u32,

    /// Success rate (0.0 to 1.0)
    pub success_rate: f64,

    /// The task or pattern that led to this skill's creation
    pub origin_task: String,
}

/// A milestone in the agent's learning journey
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    /// Unique identifier
    pub id: String,

    /// Milestone description
    pub description: String,

    /// When this milestone was achieved
    pub achieved_at: chrono::DateTime<chrono::Utc>,

    /// Associated session or context
    pub session_id: Option<String>,
}

impl Default for Soul {
    fn default() -> Self {
        Self {
            identity: "You are AgentiCOS, a native Windows autonomous agent built with Rust/Tauri/React. Be direct: match the length of your reply to the weight of the ask — a one-line question gets a one-line answer, and finished work gets a short report of what changed, what's verified, and what's left, never a replay of the process. No filler (\"Great question,\" \"I'd be happy to\"), no restating the request back, no re-summarizing what you already said, no narrating tool calls the user can see. Plain claims over adjectives; when unsure, say so plainly. Agree because it's right, not because the user said it. Depth is earned — give it when the user asks for detail, teaches, or the stakes demand it, not by default.".to_string(),
            personality: "You are precise, efficient, and focused on helping the user accomplish their goals. You learn from experience and crystallize successful patterns into reusable skills. You maintain persistent memory across sessions and continuously improve your capabilities.".to_string(),
            memory: "Initial memory state. I will accumulate knowledge and context as we work together.".to_string(),
            user_profile: "Default user profile. I will learn your preferences and patterns over time.".to_string(),
            skills: Vec::new(),
            milestones: Vec::new(),
            version: 1,
        }
    }
}

impl Soul {
    /// Create a new SOUL with default values
    pub fn new() -> Self {
        Self::default()
    }

    /// Load SOUL from a file
    pub fn load_from_file(path: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let content = std::fs::read_to_string(path)?;
        let soul: Soul = serde_json::from_str(&content)?;
        Ok(soul)
    }

    /// Save SOUL to a file
    pub fn save_to_file(&self, path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    /// Add a new skill to the SOUL
    pub fn add_skill(&mut self, skill: SkillEntry) {
        self.skills.push(skill);
        self.version += 1;
    }

    /// Record a milestone
    pub fn add_milestone(&mut self, milestone: Milestone) {
        self.milestones.push(milestone);
        self.version += 1;
    }

    /// Update memory with new information
    pub fn update_memory(&mut self, new_memory: String) {
        self.memory = new_memory;
        self.version += 1;
    }

    /// Update user profile
    pub fn update_user_profile(&mut self, profile: String) {
        self.user_profile = profile;
        self.version += 1;
    }

    /// Get a skill by ID
    pub fn get_skill(&self, id: &str) -> Option<&SkillEntry> {
        self.skills.iter().find(|s| s.id == id)
    }

    /// Get all skills sorted by usage count
    pub fn get_top_skills(&self, limit: usize) -> Vec<&SkillEntry> {
        let mut skills = self.skills.iter().collect::<Vec<_>>();
        skills.sort_by(|a, b| b.usage_count.cmp(&a.usage_count));
        skills.truncate(limit);
        skills
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_soul_default() {
        let soul = Soul::default();
        assert_eq!(soul.version, 1);
        assert!(soul.skills.is_empty());
        assert!(soul.milestones.is_empty());
    }

    #[test]
    fn test_add_skill() {
        let mut soul = Soul::default();
        let skill = SkillEntry {
            id: "test-skill".to_string(),
            name: "Test Skill".to_string(),
            description: "A test skill".to_string(),
            created_at: chrono::Utc::now(),
            usage_count: 0,
            success_rate: 1.0,
            origin_task: "Testing".to_string(),
        };
        soul.add_skill(skill);
        assert_eq!(soul.skills.len(), 1);
        assert_eq!(soul.version, 2);
    }

    #[test]
    fn test_get_skill() {
        let mut soul = Soul::default();
        let skill = SkillEntry {
            id: "test-skill".to_string(),
            name: "Test Skill".to_string(),
            description: "A test skill".to_string(),
            created_at: chrono::Utc::now(),
            usage_count: 0,
            success_rate: 1.0,
            origin_task: "Testing".to_string(),
        };
        soul.add_skill(skill.clone());
        let retrieved = soul.get_skill("test-skill");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Test Skill");
    }
}
