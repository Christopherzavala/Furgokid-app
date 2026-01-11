# 🔄 Rollback Script - Emergency Recovery

param(
    [Parameter(Mandatory=$false)]
    [string]$FunctionName,
    
    [switch]$All,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🔄 ROLLBACK - Furgokid Backend" -ForegroundColor Red
Write-Host "===========================================" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    Write-Host "⚠️  WARNING: Esto eliminará las Functions actuales" -ForegroundColor Yellow
    $confirm = Read-Host "¿Estás seguro? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "❌ Rollback cancelado" -ForegroundColor Yellow
        exit 0
    }
}

# Verificar ambiente
Write-Host "📋 Verificando ambiente..." -ForegroundColor Yellow
$currentProject = firebase use | Out-String

Write-Host "   Proyecto actual: $currentProject" -ForegroundColor Cyan

if ($currentProject -match "production|furgokid") {
    Write-Host "⚠️  ESTÁS EN PRODUCTION" -ForegroundColor Red
    if (-not $Force) {
        $confirm = Read-Host "¿Seguro que quieres hacer rollback en PRODUCTION? (yes/no)"
        if ($confirm -ne "yes") {
            exit 0
        }
    }
}

# Crear backup antes de rollback
Write-Host ""
Write-Host "💾 Creando backup del estado actual..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "backups/rollback-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path "docs/logs" -ErrorAction SilentlyContinue | Out-Null

# List current functions
Write-Host "📋 Functions actuales:" -ForegroundColor Yellow
firebase functions:list | Tee-Object -FilePath "$backupDir/functions-list.txt"

# Export Firestore data (safety backup)
Write-Host ""
Write-Host "💾 Exportando Firestore (safety backup)..." -ForegroundColor Yellow
firebase firestore:export "gs://furgokid.appspot.com/backups/rollback-$timestamp"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Firestore export failed (continuando...)" -ForegroundColor Yellow
}

# Delete functions
if ($All) {
    Write-Host ""
    Write-Host "🗑️  Eliminando TODAS las Cloud Functions..." -ForegroundColor Red
    
    $functions = @(
        "notifyDriversNewRequest",
        "notifyParentsNewVacancy", 
        "sendWelcomeEmail",
        "testNotification"
    )
    
    foreach ($fn in $functions) {
        Write-Host "   Eliminando $fn..." -ForegroundColor Yellow
        firebase functions:delete $fn --force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $fn eliminada" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Error eliminando $fn (puede no existir)" -ForegroundColor Yellow
        }
    }
    
} elseif ($FunctionName) {
    Write-Host ""
    Write-Host "🗑️  Eliminando Function: $FunctionName..." -ForegroundColor Yellow
    
    firebase functions:delete $FunctionName --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ $FunctionName eliminada" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error eliminando $FunctionName" -ForegroundColor Red
        exit 1
    }
    
} else {
    Write-Host "❌ Especifica -FunctionName o -All" -ForegroundColor Red
    Write-Host "   Ejemplo: .\scripts\rollback.ps1 -FunctionName notifyDriversNewRequest" -ForegroundColor Cyan
    Write-Host "   Ejemplo: .\scripts\rollback.ps1 -All" -ForegroundColor Cyan
    exit 1
}

# Deploy previous version (if exists)
if (Test-Path "backups/functions-backup/index.js") {
    Write-Host ""
    $deployBackup = Read-Host "📦 ¿Deployar versión anterior de backup? (y/N)"
    
    if ($deployBackup -eq "y") {
        Write-Host "🚀 Deployando versión de backup..." -ForegroundColor Yellow
        
        # Backup current broken version
        Copy-Item -Path "functions/" -Destination "$backupDir/broken-version" -Recurse -Force
        
        # Restore previous version
        Copy-Item -Path "backups/functions-backup/*" -Destination "functions/" -Recurse -Force
        
        # Deploy
        Push-Location functions
        npm ci --production
        Pop-Location
        
        firebase deploy --only functions
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Versión anterior deployada" -ForegroundColor Green
        } else {
            Write-Host "❌ Error deployando backup" -ForegroundColor Red
            Write-Host "   Restaurando versión rota para debug..." -ForegroundColor Yellow
            Copy-Item -Path "$backupDir/broken-version/*" -Destination "functions/" -Recurse -Force
        }
    }
}

# Verify rollback
Write-Host ""
Write-Host "🔍 Verificando estado post-rollback..." -ForegroundColor Yellow
firebase functions:list

# Log rollback
if ($All) {
    $rollbackTarget = "ALL"
} else {
    $rollbackTarget = $FunctionName
}
$logEntry = "$timestamp - ROLLBACK: $rollbackTarget - User: $env:USERNAME"
Add-Content -Path "docs/logs/rollback-history.txt" -Value $logEntry

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "✅ Rollback completado" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Investigar causa del fallo" -ForegroundColor Cyan
Write-Host "   2. Revisar logs: firebase functions:log" -ForegroundColor Cyan
Write-Host "   3. Fixear código en functions/" -ForegroundColor Cyan
Write-Host "   4. Deploy a staging primero: .\scripts\deploy-staging.ps1" -ForegroundColor Cyan
Write-Host "   5. Smoke tests: npm run smoke:test" -ForegroundColor Cyan
Write-Host "   6. Deploy a production cuando esté OK" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Backup guardado en: $backupDir" -ForegroundColor Gray
Write-Host "📝 Firestore backup en: gs://furgokid.appspot.com/backups/rollback-$timestamp" -ForegroundColor Gray
Write-Host ""
