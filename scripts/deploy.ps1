# 🚀 Deploy Automatizado - FurgoKid Backend (PRODUCTION)
#
# Fail-closed: exige FIREBASE_PROJECT_ID explicito (furgokid), pasa --project
# en cada llamada y exige la confirmacion exacta 'yes' para produccion.

param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ProjectId
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "firebase-project-guard.ps1")

Write-Host "🔥 FurgoKid Backend Deployment Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (!(Test-Path "firebase.json")) {
    Write-Host "❌ Error: No se encontró firebase.json" -ForegroundColor Red
    Write-Host "   Ejecuta este script desde la raíz del proyecto" -ForegroundColor Yellow
    exit 1
}

# Verificar que Firebase CLI está instalado
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Firebase CLI no está instalado" -ForegroundColor Red
    Write-Host "   Instalar: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Verificar que estamos autenticados
Write-Host ""
Write-Host "🔐 Verificando autenticación..." -ForegroundColor Yellow
firebase projects:list 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ No estás autenticado en Firebase" -ForegroundColor Red
    Write-Host "   Ejecutando: firebase login" -ForegroundColor Yellow
    firebase login
}

# Fail-closed project validation: explicit id, exact production match.
Write-Host ""
Write-Host "📋 Validando proyecto..." -ForegroundColor Yellow
$ProjectId = Resolve-FirebaseProjectId -Environment 'production' -ProjectId $ProjectId
$ProjectId = Assert-FirebaseProjectMatch -Environment 'production' -ProjectId $ProjectId
Write-Host "   Proyecto validado: $ProjectId (PRODUCTION)" -ForegroundColor Cyan

# Confirmar deployment (confirmacion inequivoca: solo 'yes' exacto)
Write-Host ""
Write-Host "⚠️  ADVERTENCIA: Este script deployará a PRODUCCIÓN ($ProjectId):" -ForegroundColor Yellow
Write-Host "   1. Firebase Cloud Functions" -ForegroundColor White
Write-Host "   2. Firestore Security Rules" -ForegroundColor White
Write-Host "   3. Firestore Indexes" -ForegroundColor White
Write-Host ""
Write-Host "   Escribe exactamente 'yes' para continuar." -ForegroundColor Yellow
try {
    Request-DeploymentConfirmation -Prompt "¿Continuar con el deployment a PRODUCCIÓN? (yes/no)"
} catch {
    Write-Host "❌ $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# PASO 1: Instalar dependencies
Write-Host ""
Write-Host "📦 Paso 1/5: Instalando dependencies..." -ForegroundColor Cyan
Push-Location functions
try {
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error instalando dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Dependencies instaladas" -ForegroundColor Green
} finally {
    Pop-Location
}

# PASO 2: Lint code (fail-closed en produccion: un error de lint aborta)
Write-Host ""
Write-Host "🔍 Paso 2/5: Verificando código (ESLint)..." -ForegroundColor Cyan
Push-Location functions
try {
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ESLint encontró problemas. Deploy a producción abortado." -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Lint pasó" -ForegroundColor Green
} finally {
    Pop-Location
}

# PASO 3: Deploy Functions
Write-Host ""
Write-Host "☁️  Paso 3/5: Deploying Cloud Functions..." -ForegroundColor Cyan
firebase deploy --project $ProjectId --only functions

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error deploying Functions" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Functions deployed successfully" -ForegroundColor Green

# PASO 4: Deploy Firestore Rules
Write-Host ""
Write-Host "🔒 Paso 4/5: Deploying Firestore Rules..." -ForegroundColor Cyan
firebase deploy --project $ProjectId --only firestore:rules

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error deploying Firestore Rules" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Firestore Rules deployed" -ForegroundColor Green

# PASO 5: Deploy Firestore Indexes
Write-Host ""
Write-Host "📊 Paso 5/5: Deploying Firestore Indexes..." -ForegroundColor Cyan
firebase deploy --project $ProjectId --only firestore:indexes

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Advertencia: Error deploying indexes (puede ser normal si no hay indexes)" -ForegroundColor Yellow
}

# Verificar deployment
Write-Host ""
Write-Host "✅ Verificando deployment..." -ForegroundColor Cyan
Write-Host ""
firebase functions:list --project $ProjectId

# Resumen
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "🎉 DEPLOYMENT COMPLETADO" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Siguiente paso: Verificar en Firebase Console" -ForegroundColor Yellow
Write-Host "   https://console.firebase.google.com/project/$ProjectId/functions" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 Testing: Crear una request en la app y verificar logs" -ForegroundColor Yellow
Write-Host "   firebase functions:log --project $ProjectId --only notifyDriversNewRequest" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Monitoreo:" -ForegroundColor Yellow
Write-Host "   - Firestore → notification_logs (success)" -ForegroundColor Cyan
Write-Host "   - Firestore → notification_errors (errors)" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path "docs/logs/deploy-history.txt" -Value "$timestamp - PRODUCTION DEPLOY SUCCESS (project: $ProjectId)"
