# Script to update dependencies after crate reorganization
$crates = @(
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
    "infrastructure/mcp",
    "presentation/cli",
    "presentation/gateway",
    "presentation/desktop",
    "presentation/api-server"
)

$pathMappings = @{
    "../contracts" = "../../domain/contracts"
    "../kernel" = "../../infrastructure/kernel"
    "../runtime" = "../../infrastructure/runtime"
    "../providers" = "../../infrastructure/providers"
    "../tools" = "../../infrastructure/tools"
    "../memory" = "../../infrastructure/memory"
    "../protocols" = "../../infrastructure/protocols"
    "../sandbox" = "../../infrastructure/sandbox"
    "../source-forge" = "../../infrastructure/source-forge"
    "../observability" = "../../infrastructure/observability"
    "../evaluation" = "../../infrastructure/evaluation"
    "../security" = "../../infrastructure/security"
    "../adapters" = "../../infrastructure/adapters"
    "../mcp" = "../../infrastructure/mcp"
    "../cli" = "../../presentation/cli"
    "../gateway" = "../../presentation/gateway"
    "../desktop" = "../../presentation/desktop"
    "../api-server" = "../../presentation/api-server"
}

foreach ($crate in $crates) {
    $cargoPath = "crates/$crate/Cargo.toml"
    if (Test-Path $cargoPath) {
        $content = Get-Content $cargoPath -Raw
        foreach ($oldPath in $pathMappings.Keys) {
            $newPath = $pathMappings[$oldPath]
            $content = $content -replace [regex]::Escape($oldPath), $newPath
        }
        Set-Content $cargoPath -Value $content -NoNewline
        Write-Host "Updated $crate"
    }
}

Write-Host "Dependency paths updated successfully"
