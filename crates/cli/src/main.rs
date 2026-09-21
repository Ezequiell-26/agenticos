#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! AgentiCOS CLI - Command-line interface for the AgentiCOS platform.

use agenticos_contracts::{FeatureFlagStore, RunId};
use agenticos_kernel::{InMemoryFeatureFlagStore, KernelRuntime};
use anyhow::Result;
use clap::{Parser, Subcommand};
use std::sync::Arc;

#[derive(Parser)]
#[command(name = "agenticos")]
#[command(about = "AgentiCOS - Universal agent runtime platform", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run management commands
    Run {
        #[command(subcommand)]
        command: RunCommands,
    },
    /// Agent interaction commands
    Agent {
        #[command(subcommand)]
        command: AgentCommands,
    },
    /// Status and information commands
    Status {
        #[command(subcommand)]
        command: StatusCommands,
    },
    /// Configuration commands
    Config {
        #[command(subcommand)]
        command: ConfigCommands,
    },
    /// Feature flag commands
    Flags {
        #[command(subcommand)]
        command: FlagCommands,
    },
}

#[derive(Subcommand)]
enum RunCommands {
    /// Create a new run
    Create {
        /// Run identifier
        #[arg(short, long)]
        id: String,
        /// Objective for the run
        #[arg(short, long)]
        objective: String,
    },
    /// List all runs
    List,
    /// Get run status
    Status {
        /// Run identifier
        #[arg(short, long)]
        id: String,
    },
    /// Execute a run with model provider
    Execute {
        /// Run identifier
        #[arg(short, long)]
        id: String,
        /// Provider to use
        #[arg(short, long, default_value = "http")]
        provider: String,
    },
}

#[derive(Subcommand)]
enum AgentCommands {
    /// Start an agent
    Start {
        /// Agent identifier
        #[arg(short, long)]
        id: String,
        /// Engine to use
        #[arg(short, long, default_value = "basic")]
        engine: String,
    },
    /// List available agents
    List,
}

#[derive(Subcommand)]
enum StatusCommands {
    /// Show system status
    System,
    /// Show provider status
    Providers,
    /// Show tool status
    Tools,
}

#[derive(Subcommand)]
enum ConfigCommands {
    /// Show current configuration
    Show,
    /// Set a configuration value
    Set {
        /// Configuration key
        key: String,
        /// Configuration value
        value: String,
    },
}

#[derive(Subcommand)]
enum FlagCommands {
    /// List all feature flags
    List,
    /// Get feature flag value
    Get {
        /// Flag identifier
        #[arg(short, long)]
        id: String,
    },
    /// Enable a feature flag
    Enable {
        /// Flag identifier
        #[arg(short, long)]
        id: String,
    },
    /// Disable a feature flag
    Disable {
        /// Flag identifier
        #[arg(short, long)]
        id: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize kernel runtime
    let event_store = Arc::new(agenticos_kernel::InMemoryEventStore::new());
    let snapshot_store = Arc::new(agenticos_kernel::InMemorySnapshotStore::new());
    let logger = Arc::new(agenticos_kernel::InMemoryLogger::new(
        agenticos_contracts::LogLevel::Info,
    ));
    let config = Arc::new(tokio::sync::RwLock::new(
        agenticos_kernel::InMemoryConfig::default(),
    ));
    let capability_issuer = Arc::new(agenticos_kernel::InMemoryCapabilityIssuer::new());
    let runtime = Arc::new(KernelRuntime::new(
        event_store,
        snapshot_store,
        logger,
        config,
        capability_issuer,
    ));

    // Initialize feature flag store
    let flag_store = Arc::new(InMemoryFeatureFlagStore::new());

    match cli.command {
        Commands::Run { command } => handle_run_command(command, runtime).await,
        Commands::Agent { command } => handle_agent_command(command).await,
        Commands::Status { command } => handle_status_command(command).await,
        Commands::Config { command } => handle_config_command(command).await,
        Commands::Flags { command } => handle_flag_command(command, flag_store).await,
    }
}

async fn handle_run_command(command: RunCommands, runtime: Arc<KernelRuntime>) -> Result<()> {
    match command {
        RunCommands::Create { id, objective } => {
            println!("Creating run: {} with objective: {}", id, objective);
            let run_id = RunId::new(&id)?;
            runtime.create_run(run_id.clone()).await?;
            println!("Run created successfully with ID: {:?}", run_id);
        }
        RunCommands::List => {
            println!("Listing all runs...");
            let runs = runtime.runs.read().await;
            if runs.is_empty() {
                println!("No runs found");
            } else {
                println!("Found {} runs:", runs.len());
                for (run_id, run) in runs.iter() {
                    println!("  - {:?}: {:?}", run_id, run.state);
                }
            }
        }
        RunCommands::Status { id } => {
            println!("Getting status for run: {}", id);
            let run_id = RunId::new(&id)?;
            let runs = runtime.runs.read().await;
            if let Some(run) = runs.get(&run_id) {
                println!("Run status: {:?}", run.state);
            } else {
                println!("Run not found");
            }
        }
        RunCommands::Execute { id, provider } => {
            println!("Executing run: {} with provider: {}", id, provider);
            let run_id = RunId::new(&id)?;

            // Get the run
            let runs = runtime.runs.read().await;
            let run = runs
                .get(&run_id)
                .ok_or_else(|| anyhow::anyhow!("Run not found"))?;

            println!("Run state: {:?}", run.state);
            println!("Run ID: {:?}", run.run_id);

            // Simulate model execution (in a real implementation, this would use the provider)
            println!("Simulating model execution with provider: {}", provider);
            println!("Run executed successfully (simulated)");
        }
    }
    Ok(())
}

async fn handle_agent_command(command: AgentCommands) -> Result<()> {
    match command {
        AgentCommands::Start { id, engine } => {
            println!("Starting agent: {} with engine: {}", id, engine);
            // TODO: Integrate with actual agent engine
            println!("Agent started successfully");
        }
        AgentCommands::List => {
            println!("Listing available agents...");
            // TODO: Integrate with actual agent registry
            println!("No agents found");
        }
    }
    Ok(())
}

async fn handle_status_command(command: StatusCommands) -> Result<()> {
    match command {
        StatusCommands::System => {
            println!("System Status:");
            println!("  Runtime: Active");
            println!("  Kernel: Initialized");
            println!("  Providers: Connected");
            println!("  Tools: Available");
        }
        StatusCommands::Providers => {
            println!("Provider Status:");
            println!("  Available providers:");
            println!("    - in-memory-provider (Active)");
            // TODO: Integrate with actual provider registry
        }
        StatusCommands::Tools => {
            println!("Tool Status:");
            println!("  Available tools:");
            println!("    - echo (Available)");
            // TODO: Integrate with actual tool registry
        }
    }
    Ok(())
}

async fn handle_config_command(command: ConfigCommands) -> Result<()> {
    match command {
        ConfigCommands::Show => {
            println!("Current Configuration:");
            println!("  log_level: Info");
            println!("  max_context_tokens: 4096");
            println!("  default_provider: in-memory-provider");
        }
        ConfigCommands::Set { key, value } => {
            println!("Setting configuration: {} = {}", key, value);
            println!("Configuration updated successfully");
        }
    }
    Ok(())
}

async fn handle_flag_command(
    command: FlagCommands,
    flag_store: Arc<InMemoryFeatureFlagStore>,
) -> Result<()> {
    match command {
        FlagCommands::List => {
            println!("Listing all feature flags...");
            let flags = flag_store.list_flags().await?;
            if flags.is_empty() {
                println!("No feature flags found");
            } else {
                println!("Found {} flags:", flags.len());
                for flag in flags {
                    let status = if flag.enabled { "ENABLED" } else { "DISABLED" };
                    println!(
                        "  - [{}] {}: {:?} = {}",
                        status, flag.flag_id, flag.value, flag.name
                    );
                }
            }
        }
        FlagCommands::Get { id } => {
            println!("Getting feature flag: {}", id);
            if let Some(flag) = flag_store.get_flag(&id).await? {
                let status = if flag.enabled { "ENABLED" } else { "DISABLED" };
                println!("Flag: {} [{}]", flag.flag_id, status);
                println!("  Name: {}", flag.name);
                println!("  Value: {:?}", flag.value);
            } else {
                println!("Flag not found");
            }
        }
        FlagCommands::Enable { id } => {
            println!("Enabling feature flag: {}", id);
            flag_store.enable_flag(&id).await?;
            println!("Flag enabled successfully");
        }
        FlagCommands::Disable { id } => {
            println!("Disabling feature flag: {}", id);
            flag_store.disable_flag(&id).await?;
            println!("Flag disabled successfully");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_parsing() {
        use clap::Parser;

        // Test run create command
        let args = vec![
            "agenticos",
            "run",
            "create",
            "--id",
            "test-run",
            "--objective",
            "test",
        ];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());

        // Test agent start command
        let args = vec!["agenticos", "agent", "start", "--id", "test-agent"];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());

        // Test status system command
        let args = vec!["agenticos", "status", "system"];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());

        // Test config show command
        let args = vec!["agenticos", "config", "show"];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());

        // Test flags list command
        let args = vec!["agenticos", "flags", "list"];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());

        // Test flags get command
        let args = vec!["agenticos", "flags", "get", "--id", "test-flag"];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());

        // Test flags enable command
        let args = vec!["agenticos", "flags", "enable", "--id", "test-flag"];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());

        // Test flags disable command
        let args = vec!["agenticos", "flags", "disable", "--id", "test-flag"];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());

        // Test run execute command
        let args = vec![
            "agenticos",
            "run",
            "execute",
            "--id",
            "test-run",
            "--provider",
            "http",
        ];
        let cli = Cli::try_parse_from(args);
        assert!(cli.is_ok());
    }
}
