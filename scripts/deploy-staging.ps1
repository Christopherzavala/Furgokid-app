# Deploy to Staging Environment
#
# Este script deploya backend a Firebase staging project.
# Fail-closed: exige FIREBASE_PROJECT_ID explicito y lo pasa con --project en
# cada llamada (nunca confia en el alias activo de `firebase use`).

param(
    [switch]$SkipTests,
    [switch]$Force, # Only bypasses the lint gate; it never bypasses project validation or confirmations.
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ProjectId
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "firebase-project-guard.ps1")

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "   🎭 Staging Deployment - Furgokid" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Fail-closed project validation: explicit id, exact environment match.
Write-Host "📋 Validando proyecto..." -ForegroundColor Yellow
$ProjectId = Resolve-FirebaseProjectId -Environment 'staging' -ProjectId $ProjectId
$ProjectId = Assert-FirebaseProjectMatch -Environment 'staging' -ProjectId $ProjectId
Write-Host "✅ Proyecto validado: $ProjectId (staging)" -ForegroundColor Green

# Verificar archivos críticos
Write-Host ""
Write-Host "📋 Verificando archivos..." -ForegroundColor Yellow

$criticalFiles = @(
    "firebase.json",
    "functions/index.js",
    "functions/package.json",
    ".firebaserc"
)

foreach ($file in $criticalFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Archivo faltante: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Todos los archivos presentes" -ForegroundColor Green

# Run tests (unless skipped)
if (-not $SkipTests) {
    Write-Host ""
    Write-Host "🧪 Ejecutando tests..." -ForegroundColor Yellow

    Push-Location functions
    try {
        npm test
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Tests fallaron" -ForegroundColor Red
            Pop-Location
            exit 1
        }
        Write-Host "✅ Tests pasaron" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "⚠️  Tests omitidos (--SkipTests)" -ForegroundColor Yellow
}

# Lint Functions code
Write-Host ""
Write-Host "🔍 Linting Functions..." -ForegroundColor Yellow

Push-Location functions
try {
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Lint errors detectados" -ForegroundColor Red

        if (-not $Force) {
            Write-Host "   Usa -Force para deployar de todas formas" -ForegroundColor Yellow
            Pop-Location
            exit 1
        } else {
            Write-Host "⚠️  Continuando de todas formas (-Force)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✅ Lint pasó" -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# Install dependencies
Write-Host ""
Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow

Push-Location functions
try {
    npm ci --production
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm ci falló" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "✅ Dependencias instaladas" -ForegroundColor Green
} finally {
    Pop-Location
}

# Deploy Firestore rules
Write-Host ""
Write-Host "🔒 Deployando Firestore rules..." -ForegroundColor Yellow

firebase deploy --project $ProjectId --only firestore:rules
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy de rules falló" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Rules deployadas" -ForegroundColor Green

# Deploy Functions
Write-Host ""
Write-Host "🚀 Deployando Cloud Functions..." -ForegroundColor Yellow

firebase deploy --project $ProjectId --only functions
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy de Functions falló" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Verificar logs: firebase functions:log --project $ProjectId" -ForegroundColor Cyan
    Write-Host "   2. Verificar billing: https://console.firebase.google.com" -ForegroundColor Cyan
    Write-Host "   3. Intentar deploy individual: firebase deploy --project $ProjectId --only functions:nombreFuncion" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Functions deployadas" -ForegroundColor Green

# List deployed functions
Write-Host ""
Write-Host "📋 Functions deployadas:" -ForegroundColor Yellow
firebase functions:list --project $ProjectId

# Get Functions URLs
Write-Host ""
Write-Host "🔗 Endpoints disponibles:" -ForegroundColor Yellow
Write-Host "   https://us-central1-$ProjectId.cloudfunctions.net/testNotification" -ForegroundColor Cyan
Write-Host "   (otros endpoints son triggers internos)" -ForegroundColor Gray

# Success message
Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "   ✅ Deploy a STAGING completado" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

# Next steps
Write-Host "📝 Próximos pasos:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 🧪 Ejecutar smoke tests:" -ForegroundColor Cyan
Write-Host "   node scripts/smoke-tests.js" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 📱 Build app staging:" -ForegroundColor Cyan
Write-Host "   eas build --platform android --profile staging" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 🔍 Monitorear logs:" -ForegroundColor Cyan
Write-Host "   firebase functions:log --project $ProjectId --only nombreFuncion" -ForegroundColor Gray
Write-Host ""

# Log deployment info
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logEntry = "$timestamp - STAGING DEPLOY SUCCESS (project: $ProjectId)"
Add-Content -Path "docs/logs/deploy-history.txt" -Value $logEntry

Write-Host "📝 Deploy logged to docs/logs/deploy-history.txt" -ForegroundColor Gray
Write-Host ""
