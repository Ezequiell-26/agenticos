# Script to update all dependencies after crate reorganization
$dependencyMappings = @{
    "agenticos-contracts" = "../../domain/contracts"
    "agenticos-kernel" = "../../infrastructure/kernel"
    "agenticos-runtime" = "../../infrastructure/runtime"
    "agenticos-providers" = "../../infrastructure/providers"
    "agenticos-tools" = "../../infrastructure/tools"
    "agenticos-memory" = "../../infrastructure/memory"
    "agenticos-protocols" = "../../infrastructure/protocols"
    "agenticos-sandbox" = "../../infrastructure/sandbox"
    "agenticos-source-forge" = "../../infrastructure/source-forge"
    "agenticos-observability" = "../../infrastructure/observability"
    "agenticos-evaluation" = "../../infrastructure/evaluation"
    "agenticos-security" = "../../infrastructure/security"
    "agenticos-adapters" = "../../infrastructure/adapters"
    "agenticos-execution" = "../../application/execution"
    "agenticos-workflows" = "../../application/workflows"
    "agenticos-scheduler" = "../../application/scheduler"
    "agenticos-agents" = "../../application/agents"
    "agenticos-cli" = "../../presentation/cli"
    "agenticos-gateway" = "../../presentation/gateway"
    "agenticos-desktop" = "../../presentation/desktop"
    "agenticos-api-server" = "../../presentation/api-server"
}

$allCrates = @(
    "application/execution",
    "application/workflows",
    "application/scheduler",
    "application/agents",
    "infrastructure/kernel",
    "infrastructure/runtime",
    "infrastructure/providers",
    "infrastructure/tools",
    "infrastructure/memory",
    "infrastructure/protocols",
    "infrastructure/sandbox",
    "infrastructure/source-forge",
    "infrastructure/observability",
    "infrastructure/evaluation",
    "infrastructure/security",
    "infrastructure/adapters",
    "presentation/cli",
    "presentation/gateway",
    "presentation/desktop",
    "presentation/api-server"
)

foreach ($crate in $allCrates) {
    $cargoPath = "crates/$crate/Cargo.toml"
    if (Test-Path $cargoPath) {
        $content = Get-Content $cargoPath -Raw
        foreach ($dep in $dependencyMappings.Keys) {
            $newPath = $dependencyMappings[$dep]
            $content = $content -replace "$dep = { path = """, "$dep = { path = `"$newPath`""
        }
        Set-Content $cargoPath -Value $content -NoNewline
        Write-Host "Updated dependencies in $crate"
    }
}

Write-Host "All dependencies updated successfully"
