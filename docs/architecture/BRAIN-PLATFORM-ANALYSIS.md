# AgentiCOS Brain Platform Analysis

> Complete analysis of current repository state before restructure to agent intelligence platform

## Current Repository State

### Crates Overview (45 total after duplicate removal)

**Core/Infrastructure (27 crates):**
- `contracts` - Domain contracts and traits
- `kernel` - Durable runtime kernel
- `runtime` - Runtime orchestration
- `execution` - Command/query execution layer (CQRS)
- `scheduler` - Task scheduling
- `providers` - Model provider integration
- `router` - Request routing
- `tools` - Tool execution
- `sandbox` - Execution sandbox
- `context` - Context window management
- `memory` - Memory persistence
- `skills` - Skill definitions
- `workflows` - Workflow orchestration
- `agents` - Agent execution and management
- `projects` - Project management
- `artifacts` - Artifact storage
- `plugins` - Plugin system
- `gateway` - API gateway and routing
- `security` - Security and capabilities
- `observability` - Logging, metrics, tracing
- `evaluation` - Model evaluation and testing
- `source-forge` - Source code operations
- `protocols` - Protocol implementations (MCP, A2A)
- `cli` - Command-line interface
- `desktop` - Desktop (Tauri)
- `api-server` - REST API server
- `mcp` - MCP integration
- `interface` - Interface definitions

**Enterprise Utilities (18 crates):**
- `concurrency-stress` - Concurrency stress testing
- `crypto` - Cryptography (hashing, encryption, key pairs)
- `math` - Linear algebra (vectors, matrices, quaternions)
- `time-utils` - Time and date utilities
- `http-client` - HTTP client with JSON support
- `async-utils` - Async utilities (join, retry, timeout, debounce, throttle)
- `cache` - Caching (LRU, ConcurrentLruCache, TTL)
- `compression` - Compression (RLE, Stream, levels)
- `rate-limiting` - Rate limiting (GCRA, Token Bucket, Registry)
- `vector-database` - Vector database with embeddings
- `websockets` - WebSockets with rooms and broadcasting
- `file-watcher` - File watcher for hot reload
- `text-search` - Full-text search
- `event-bus` - Pub/sub event bus
- `state-management` - State machines
- `configuration` - Layered configuration
- `streaming` - Dataflow processing
- `notifications` - Multi-channel notifications

### Current Architecture Problems

1. **No Central Brain**: No single orchestrator that coordinates reasoning, planning, memory, knowledge, execution
2. **Fragmented Capabilities**: Capabilities scattered across multiple crates without central registry
3. **No Source Intelligence**: No system to discover, import, version, index external repositories
4. **No Resource Governor**: No centralized resource management (RAM, CPU, disk, tokens)
5. **Kernel as Monolith**: `kernel` crate accumulating too many responsibilities
6. **No Dynamic Capability Discovery**: Capabilities are static, not dynamically discoverable
7. **No Provenance Tracking**: External resources lack systematic provenance tracking
8. **No Capability Lifecycle**: No discovery → validation → security → compatibility → benchmark → acceptance cycle
9. **No Knowledge Base**: No persistent, indexed knowledge storage for external repositories
10. **No Token Optimization**: No systematic token optimization (deduplication, compression, ranking)

### Current Dependency Issues

**Circular/Complex Dependencies:**
- `execution` depends on `kernel`, `contracts`
- `cli` depends on almost everything (should only depend on presentation layer)
- `agents` depends on multiple implementation crates instead of just contracts
- `tools` and `sandbox` have unclear boundaries

**Missing Abstractions:**
- No clear separation between contracts/core and implementations
- No adapter pattern for external providers
- No plugin isolation boundary

## Target Architecture: AgentiCOS Brain Platform

### Vision

AgentiCOS Brain Platform: An extensible intelligence platform with a central Brain that orchestrates reasoning, planning, memory, knowledge, execution, evaluation, learning, capability discovery, and resource management.

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  CLI, Web UI, API Gateway, Desktop (Tauri)                  │
│  Rust → TypeScript boundary                                  │
├─────────────────────────────────────────────────────────────┤
│                    AgentiCOS Brain                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Capability Registry (dynamic capability discovery)   │  │
│  │  - Models, Providers, Tools, Skills, MCPs, APIs     │  │
│  │  - Repositories, Algorithms, Capabilities             │  │
│  │  - Version, Origin, License, Compatibility            │  │
│  │  - Dependencies, Permissions, Cost, Consumption      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Source Intelligence Engine                          │  │
│  │  - Discovery, Import, Update, Analyze                │  │
│  │  - Version, Deduplicate, Index, Evaluate             │  │
│  │  - MIT/Open-Source repositories                      │  │
│  │  - Incremental ingestion pipelines                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Knowledge Base                                      │  │
│  │  - Persistent knowledge storage                      │  │
│  │  - Indexed, searchable knowledge                     │  │
│  │  - On-demand retrieval (no mass loading)             │  │
│  │  - Provenance tracking                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Resource Governor                                   │  │
│  │  - RAM, CPU, Disk, Concurrency limits                │  │
│  │  - Network, Token budgets                           │  │
│  │  - Caching, Eviction, Queues                        │  │
│  │  - Backpressure, Context management                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Reasoning & Planning Engine                         │  │
│  │  - Multi-step reasoning                              │  │
│  │  - Plan generation and re-planning                   │  │
│  │  - Capability selection                              │  │
│  │  - Evaluation and learning                           │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Runtime Layer                            │
│  Execution, Orchestration, Coordination, Monitoring        │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│  Storage, Providers, Tools, MCP, Adapters, Security        │
├─────────────────────────────────────────────────────────────┤
│                    Core/Contracts Layer                      │
│  Domain contracts, traits, entities, value objects          │
└─────────────────────────────────────────────────────────────┘
```

### Strict DAG

**Dependency Order (no cycles):**
1. `contracts/core` - Zero external dependencies
2. `brain/kernel` - Depends only on contracts/core
3. `runtime` - Depends on brain/kernel, contracts/core
4. `providers` - Depends on contracts/core
5. `tools` - Depends on contracts/core
6. `mcp` - Depends on contracts/core
7. `agents` - Depends on brain/kernel, contracts/core
8. `workflows` - Depends on brain/kernel, contracts/core
9. `knowledge` - Depends on contracts/core
10. `storage` - Depends on contracts/core
11. `security` - Depends on contracts/core
12. `observability` - Depends on contracts/core
13. `adapters` - Depends on providers, contracts/core
14. `interfaces` - Depends on all above, exposes unified APIs

### Capability Registry Design

```rust
pub struct CapabilityRegistry {
    capabilities: Arc<RwLock<HashMap<CapabilityId, Capability>>>,
    providers: Arc<RwLock<HashMap<ProviderId, Provider>>>,
    tools: Arc<RwLock<HashMap<ToolId, Tool>>>,
    skills: Arc<RwLock<HashMap<SkillId, Skill>>>,
    repositories: Arc<RwLock<HashMap<RepoId, Repository>>>,
}

pub struct Capability {
    pub id: CapabilityId,
    pub version: SemVer,
    pub origin: CapabilityOrigin,  // Integrated, Adapted, Plugin, Knowledge
    pub license: License,
    pub compatibility: CompatibilityMatrix,
    pub dependencies: Vec<CapabilityId>,
    pub permissions: PermissionSet,
    pub cost: CostModel,
    pub consumption: ResourceProfile,
    pub evidence: ProvenanceEvidence,
}

pub enum CapabilityOrigin {
    IntegratedCode { repo: RepoId, commit: CommitHash },
    AdaptedPlugin { repo: RepoId, adapter: AdapterId },
    IsolatedProcess { repo: RepoId, sandbox: SandboxId },
    KnowledgeSource { repo: RepoId, indexed: bool },
}
```

### Source Intelligence Engine Design

```rust
pub struct SourceIntelligenceEngine {
    discovery: DiscoveryPipeline,
    ingestion: IngestionPipeline,
    parsing: ParsingPipeline,
    deduplication: DeduplicationPipeline,
    indexing: IndexingPipeline,
    evaluation: EvaluationPipeline,
    knowledge_base: Arc<dyn KnowledgeBase>,
}

pub struct DiscoveryPipeline {
    git_discoverer: GitDiscoverer,
    api_discoverer: ApiDiscoverer,
    feed_discoverer: FeedDiscoverer,
}

pub struct IngestionPipeline {
    downloader: Downloader,
    sandbox: IsolatedSandbox,
    incremental: IncrementalIngester,
}

pub struct ProvenanceEvidence {
    pub repository: String,
    pub commit: CommitHash,
    pub version: SemVer,
    pub changes: Vec<ChangeRecord>,
    pub timestamp: DateTime<Utc>,
    pub license: License,
    pub source: SourceLocation,
}
```

### Resource Governor Design

```rust
pub struct ResourceGovernor {
    ram_limiter: RamLimiter,
    cpu_limiter: CpuLimiter,
    disk_limiter: DiskLimiter,
    concurrency_limiter: ConcurrencyLimiter,
    network_limiter: NetworkLimiter,
    token_budget: TokenBudget,
    cache_manager: CacheManager,
    eviction_policy: EvictionPolicy,
    backpressure_controller: BackpressureController,
}

pub struct TokenBudget {
    pub max_tokens_per_request: u64,
    pub max_tokens_per_session: u64,
    pub max_tokens_per_day: u64,
    pub current_usage: Arc<AtomicU64>,
    pub optimization: TokenOptimizer,
}

pub struct TokenOptimizer {
    deduplicator: ContextDeduplicator,
    compressor: ContextCompressor,
    ranker: ContextRanker,
    selector: ContextSelector,
}
```

## Migration Strategy

### Phase 1: Create Brain Foundation (Current)
- Create `brain/kernel` crate (separate from existing `kernel`)
- Define Capability Registry contracts
- Define Source Intelligence Engine contracts
- Define Resource Governor contracts
- Add to workspace
- Verify compilation

### Phase 2: Implement Capability Registry
- Implement CapabilityRegistry
- Implement Capability metadata structures
- Implement dynamic registration
- Add tests
- Verify

### Phase 3: Implement Source Intelligence Engine Foundation
- Implement DiscoveryPipeline
- Implement Provenance tracking
- Implement Knowledge Base storage
- Add tests
- Verify

### Phase 4: Implement Resource Governor Foundation
- Implement ResourceGovernor
- Implement TokenBudget
- Implement TokenOptimizer (deduplication, compression, ranking)
- Add tests
- Verify

### Phase 5: Integrate with Existing Runtime
- Connect Brain to existing runtime
- Connect Capability Registry to providers/tools
- Connect Source Intelligence to knowledge base
- Connect Resource Governor to execution
- Add integration tests
- Verify

### Phase 6: Reorganize Crates by DAG
- Move crates to correct layers
- Update dependencies to follow DAG
- Remove circular dependencies
- Verify compilation
- Verify tests

### Phase 7: Update Presentation Layer
- Ensure CLI depends only on interfaces
- Ensure Web UI depends only on interfaces
- Ensure Desktop depends only on interfaces
- Verify

## Current State Summary

**Strengths:**
- 45 crates with good separation of concerns
- Clean Architecture principles documented
- MIT-only source policy
- Sequential verification protocol
- Good foundation (contracts, kernel, runtime, execution)

**Weaknesses:**
- No central Brain for orchestration
- No Capability Registry for dynamic capabilities
- No Source Intelligence Engine
- No Resource Governor
- No systematic token optimization
- Kernel accumulating responsibilities
- Some dependency violations

**Next Steps:**
1. Create Brain Foundation crate
2. Define Capability Registry contracts
3. Define Source Intelligence Engine contracts
4. Define Resource Governor contracts
5. Implement Capability Registry
6. Implement Source Intelligence Engine foundation
7. Implement Resource Governor foundation
8. Integrate with existing runtime
9. Reorganize crates by DAG
10. Verify and test
