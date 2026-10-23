# Start AgentiCOS desktop while preserving local work.
$ErrorActionPreference = 'Stop'

function Stop-WithMessage([string]$Message) {
    Write-Host ""
    Write-Host $Message -ForegroundColor Red
    exit 1
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$DesktopDir = Join-Path $RepoRoot 'crates\presentation\desktop'
$FrontendDir = Join-Path $DesktopDir 'frontend'
$FrontendLock = Join-Path $FrontendDir 'package-lock.json'

if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
    Stop-WithMessage "No encuentro .git en $RepoRoot. Ejecuta este archivo desde un clon de AgentiCOS."
}
if (-not (Test-Path $FrontendLock)) {
    Stop-WithMessage "Falta el package-lock del frontend: $FrontendLock"
}

foreach ($toolName in @('git', 'node', 'npm', 'cargo', 'rustc')) {
    if (-not (Get-Command $toolName -ErrorAction SilentlyContinue)) {
        Stop-WithMessage "Falta '$toolName' en PATH. Instala ese requisito y vuelve a ejecutar."
    }
}

$nodeMajorRaw = & node -p "Number(process.versions.node.split('.')[0])"
if ($LASTEXITCODE -ne 0 -or [int]$nodeMajorRaw -lt 22) {
    Stop-WithMessage "AgentiCOS requiere Node.js 22 o superior. Version detectada: $(& node --version)"
}

$branch = (& git -C $RepoRoot branch --show-current).Trim()
$dirty = @(& git -C $RepoRoot status --porcelain)
Write-Host "AgentiCOS: $RepoRoot"
Write-Host "Branch local: $branch"
Write-Host "Commit local: $(& git -C $RepoRoot rev-parse --short HEAD)"

# Update only a clean main checkout, using fast-forward only. Never reset or discard work.
if ($branch -eq 'main' -and $dirty.Count -eq 0) {
    & git -C $RepoRoot fetch origin main
    if ($LASTEXITCODE -eq 0) {
        $localSha = (& git -C $RepoRoot rev-parse HEAD).Trim()
        $remoteSha = (& git -C $RepoRoot rev-parse origin/main).Trim()
        if ($localSha -ne $remoteSha) {
            & git -C $RepoRoot merge-base --is-ancestor HEAD origin/main
            if ($LASTEXITCODE -eq 0) {
                & git -C $RepoRoot merge --ff-only origin/main
                if ($LASTEXITCODE -ne 0) {
                    Stop-WithMessage "No pude actualizar main mediante fast-forward. No se hizo reset ni limpieza."
                }
            } else {
                Write-Warning "main local no es antecesora de origin/main; no modifico el historial local. Se iniciara la copia actual."
            }
        } else {
            Write-Host "main local ya esta actualizado."
        }
    } else {
        Write-Warning "No pude consultar GitHub; iniciare la copia local sin actualizarla."
    }
} elseif ($dirty.Count -gt 0) {
    Write-Warning "El checkout tiene cambios locales. No actualizo ni descarto nada; iniciare la copia actual."
} else {
    Write-Warning "La rama no es main. No cambio de rama; iniciare la copia seleccionada."
}

# Load local .env into this process only without printing secret values.
# Environment variables already set in this process take precedence.
$EnvFile = Join-Path $RepoRoot '.env'
if (Test-Path $EnvFile) {
    foreach ($rawLine in Get-Content -LiteralPath $EnvFile) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $line = [regex]::Replace($line, '^export\s+', '')
        $equalsIndex = $line.IndexOf('=')
        if ($equalsIndex -le 0) { continue }
        $key = $line.Substring(0, $equalsIndex).Trim()
        $value = $line.Substring($equalsIndex + 1).Trim()
        if (-not ($key -match '^[A-Za-z_][A-Za-z0-9_]*$')) { continue }
        if ($value.Length -ge 2) {
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        if ($null -eq [Environment]::GetEnvironmentVariable($key, 'Process')) {
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
    Write-Host "Configuracion .env cargada en este proceso; los valores no se muestran."
} else {
    Write-Host "No hay .env local. La interfaz puede abrirse, pero el chat requiere configurar un proveedor."
}

if (-not $env:VITE_AGENTICOS_API_URL) {
    $env:VITE_AGENTICOS_API_URL = 'http://127.0.0.1:8080'
}

$ViteBinary = Join-Path $FrontendDir 'node_modules\.bin\vite.cmd'
if (-not (Test-Path $ViteBinary)) {
    Write-Host "Instalando dependencias del frontend mediante npm ci..."
    & npm ci --prefix $FrontendDir --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Stop-WithMessage "npm ci fallo. Revisa el error de Node/npm mostrado arriba."
    }
} else {
    Write-Host "Dependencias del frontend ya instaladas."
}

& cargo tauri --version *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tauri CLI no esta disponible; instalando Tauri CLI v2 en el perfil del usuario..."
    & cargo install tauri-cli --version '^2' --locked
    if ($LASTEXITCODE -ne 0) {
        Stop-WithMessage "No pude instalar tauri-cli. Comprueba Rust, la conexion y las herramientas C++ de Windows."
    }
}

if (-not $env:AGENTICOS_API_KEY -and -not $env:AGENTICOS_PROVIDERS_JSON) {
    Write-Warning "No detecto AGENTICOS_API_KEY ni AGENTICOS_PROVIDERS_JSON. La ventana puede abrirse, pero el chat necesita un proveedor configurado."
}

Write-Host ""
Write-Host "Abriendo AgentiCOS. La primera compilacion de Rust puede tardar." -ForegroundColor Cyan
Push-Location $DesktopDir
try {
    & cargo tauri dev
    $appExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $appExitCode
