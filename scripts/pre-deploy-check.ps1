# 📋 Pre-Deploy Validation Script
# Verifica que todo esté listo antes de deploy a production

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('staging', 'production')]
    [string]$Environment,
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ProjectId
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   📋 Pre-Deploy Checklist" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$environment = $Environment.ToUpperInvariant()
$Staging = ($Environment -eq 'staging')
Write-Host "🎯 Environment: $environment" -ForegroundColor $(if ($Staging) { 'Yellow' } else { 'Red' })
Write-Host ""

$issues = @()
$warnings = @()
$checks = 0
$passed = 0

function Test-DeployItem {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$FailMessage,
        [bool]$Critical = $true
    )
    
    $script:checks++
    Write-Host "[$script:checks] $Name..." -ForegroundColor Cyan -NoNewline
    
    try {
        $result = & $Test
        if ($result) {
            Write-Host " ✅" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            if ($Critical) {
                Write-Host " ❌" -ForegroundColor Red
                $script:issues += $FailMessage
                
            } else {
                Write-Host " ⚠️" -ForegroundColor Yellow
                $script:warnings += $FailMessage
            }
            return $false
        }
    } catch {
        Write-Host " ❌" -ForegroundColor Red
        $script:issues += "$FailMessage (Error: $($_.Exception.Message))"
        return $false
    }
}

# ============================================
# 1. ARCHIVOS CRÍTICOS
# ============================================
Write-Host "📁 ARCHIVOS CRÍTICOS" -ForegroundColor Yellow
Write-Host ""

Test-DeployItem -Name "package.json existe" -Test {
    Test-Path "package.json"
} -FailMessage "Falta package.json"

Test-DeployItem -Name "firebase.json existe" -Test {
    Test-Path "firebase.json"
} -FailMessage "Falta firebase.json"

Test-DeployItem -Name "functions/index.js existe" -Test {
    Test-Path "functions/index.js"
} -FailMessage "Falta functions/index.js"

Test-DeployItem -Name "functions/package.json existe" -Test {
    Test-Path "functions/package.json"
} -FailMessage "Falta functions/package.json"

Test-DeployItem -Name ".firebaserc existe" -Test {
    Test-Path ".firebaserc"
} -FailMessage "Falta .firebaserc"

# ============================================
# 2. DEPENDENCIAS
# ============================================
Write-Host ""
Write-Host "📦 DEPENDENCIAS" -ForegroundColor Yellow
Write-Host ""

Test-DeployItem -Name "node_modules instalado" -Test {
    Test-Path "node_modules"
} -FailMessage "Falta node_modules - ejecuta el flujo de instalación local aprobado"

Test-DeployItem -Name "functions/node_modules instalado" -Test {
    Test-Path "functions/node_modules"
} -FailMessage "Falta functions/node_modules - ejecuta el flujo de instalación local aprobado"

# ============================================
# 3. TESTS
# ============================================
Write-Host ""
Write-Host "🧪 TESTS" -ForegroundColor Yellow
Write-Host ""

Test-DeployItem -Name "Tests unitarios pasan" -Test {
    Push-Location functions
    npm test --silent 2>&1 | Out-Null
    Pop-Location
    $LASTEXITCODE -eq 0
} -FailMessage "Tests fallando - revisa: cd functions && npm test"

# ============================================
# 4. LINTING
# ============================================
Write-Host ""
Write-Host "🔍 CODE QUALITY" -ForegroundColor Yellow
Write-Host ""

Test-DeployItem -Name "ESLint pasa" -Test {
    Push-Location functions
    npm run lint --silent 2>&1 | Out-Null
    Pop-Location
    $LASTEXITCODE -eq 0
} -FailMessage "Lint errors - ejecuta: cd functions && npm run lint -- --fix" -Critical $false

Test-DeployItem -Name "Prettier format OK" -Test {
    npm run format:check --silent 2>&1 | Out-Null
    $LASTEXITCODE -eq 0
} -FailMessage "Format issues - revisa el formato manualmente" -Critical $false

# ============================================
# 5. FIREBASE AUTH
# ============================================
Write-Host ""
Write-Host "🔐 FIREBASE AUTH" -ForegroundColor Yellow
Write-Host ""

Test-DeployItem -Name "Firebase autenticado" -Test {
    firebase --version 2>&1 | Out-Null
    $LASTEXITCODE -eq 0
} -FailMessage "Firebase CLI no está disponible localmente (este diagnóstico no inicia sesión)"

Test-DeployItem -Name "Proyecto correcto (FIREBASE_PROJECT_ID)" -Test {
    . (Join-Path $PSScriptRoot "firebase-project-guard.ps1")
    $expectedEnvironment = $Environment
    $candidate = $ProjectId
    $null = Assert-FirebaseProjectMatch -Environment $expectedEnvironment -ProjectId $candidate
    $true
} -FailMessage "El proyecto explícito '$ProjectId' no coincide con el entorno '$Environment'"

# ============================================
# 6. SEGURIDAD
# ============================================
Write-Host ""
Write-Host "🔐 SEGURIDAD" -ForegroundColor Yellow
Write-Host ""

Test-DeployItem -Name "No hay .env en git" -Test {
    -not (git ls-files | Select-String -Pattern "^\.env$")
} -FailMessage "CRÍTICO: .env está en Git - NUNCA commitear secrets" -Critical $true

Test-DeployItem -Name "No hay serviceAccountKey en git" -Test {
    -not (git ls-files | Select-String -Pattern "serviceAccountKey\.json")
} -FailMessage "CRÍTICO: serviceAccountKey.json está en Git - ELIMINAR INMEDIATAMENTE" -Critical $true

Test-DeployItem -Name "No hay API keys hardcodeadas" -Test {
    $files = Get-ChildItem -Path "functions" -Filter "*.js" -Recurse
    $hasKeys = $false
    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw
        if ($content -match "AIza[0-9A-Za-z-_]{35}") {
            $hasKeys = $true
            break
        }
    }
    -not $hasKeys
} -FailMessage "WARNING: Posibles API keys hardcodeadas detectadas" -Critical $false

# ============================================
# 7. ASSETS (solo para production)
# ============================================
if (-not $Staging) {
    Write-Host ""
    Write-Host "🎨 ASSETS" -ForegroundColor Yellow
    Write-Host ""
    
    Test-DeployItem -Name "icon.png existe" -Test {
        Test-Path "assets/icon.png"
    } -FailMessage "Falta assets/icon.png" -Critical $false
    
    Test-DeployItem -Name "splash.png existe" -Test {
        Test-Path "assets/splash.png"
    } -FailMessage "Falta assets/splash.png" -Critical $false
    
    Test-DeployItem -Name "Screenshots disponibles" -Test {
        (Test-Path "assets/screenshots") -and ((Get-ChildItem "assets/screenshots" -Filter "*.png").Count -ge 2)
    } -FailMessage "Faltan screenshots (mínimo 2 para Play Store)" -Critical $false
}

# ============================================
# RESUMEN
# ============================================
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   📊 RESUMEN" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Total checks: $checks" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Issues: $($issues.Count)" -ForegroundColor $(if ($issues.Count -eq 0) { 'Green' } else { 'Red' })
Write-Host "Warnings: $($warnings.Count)" -ForegroundColor $(if ($warnings.Count -eq 0) { 'Green' } else { 'Yellow' })
Write-Host ""

if ($issues.Count -gt 0) {
    Write-Host "❌ ISSUES CRÍTICOS:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "   • $issue" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠️  WARNINGS:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "   • $warning" -ForegroundColor Yellow
    }
    Write-Host ""
}

# RESULTADO FINAL
if ($issues.Count -eq 0) {
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "   ✅ LISTO PARA DEPLOY" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    
    if ($Staging) {
        Write-Host "Ejecuta:" -ForegroundColor Yellow
        Write-Host "   .\scripts\deploy-staging.ps1 -ProjectId furgokid-staging" -ForegroundColor Cyan
    } else {
        Write-Host "Ejecuta:" -ForegroundColor Yellow
        Write-Host "   .\scripts\deploy.ps1 -ProjectId furgokid" -ForegroundColor Cyan
        Write-Host "   npm run smoke:test" -ForegroundColor Cyan
    }
    
    exit 0
} else {
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "   ❌ NO LISTO - FIX ISSUES" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host ""
    
    Write-Host "💡 Corrige los hallazgos en un cambio revisable y vuelve a ejecutar el diagnóstico." -ForegroundColor Yellow
    
    exit 1
}
