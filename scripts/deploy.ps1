# 🚀 Deploy Automatizado - FurgoKid Backend
# Este script deploya todo el backend en un solo comando

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

# Verificar proyecto activo
Write-Host ""
Write-Host "📋 Verificando proyecto..." -ForegroundColor Yellow
$activeProject = firebase use
Write-Host "   Proyecto activo: $activeProject" -ForegroundColor Cyan

# Confirmar deployment
Write-Host ""
Write-Host "⚠️  ADVERTENCIA: Este script deployará:" -ForegroundColor Yellow
Write-Host "   1. Firebase Cloud Functions (4 functions)" -ForegroundColor White
Write-Host "   2. Firestore Security Rules" -ForegroundColor White
Write-Host "   3. Firestore Indexes" -ForegroundColor White
Write-Host ""
$confirmation = Read-Host "¿Continuar con el deployment? (s/N)"

if ($confirmation -ne "s" -and $confirmation -ne "S") {
    Write-Host "❌ Deployment cancelado por el usuario" -ForegroundColor Red
    exit 0
}

# PASO 1: Instalar dependencies
Write-Host ""
Write-Host "📦 Paso 1/5: Instalando dependencies..." -ForegroundColor Cyan
Set-Location functions

if (!(Test-Path "node_modules")) {
    Write-Host "   Instalando por primera vez..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "   Dependencies ya instaladas. Actualizando..." -ForegroundColor Yellow
    npm install
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando dependencies" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "   ✅ Dependencies instaladas" -ForegroundColor Green
Set-Location ..

# PASO 2: Lint code
Write-Host ""
Write-Host "🔍 Paso 2/5: Verificando código (ESLint)..." -ForegroundColor Cyan
Set-Location functions
npm run lint

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Advertencia: ESLint encontró problemas" -ForegroundColor Yellow
    Write-Host "   Continuando de todas formas..." -ForegroundColor Yellow
}

Set-Location ..

# PASO 3: Deploy Functions
Write-Host ""
Write-Host "☁️  Paso 3/5: Deploying Cloud Functions..." -ForegroundColor Cyan
firebase deploy --only functions

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error deploying Functions" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Functions deployed successfully" -ForegroundColor Green

# PASO 4: Deploy Firestore Rules
Write-Host ""
Write-Host "🔒 Paso 4/5: Deploying Firestore Rules..." -ForegroundColor Cyan
firebase deploy --only firestore:rules

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error deploying Firestore Rules" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Firestore Rules deployed" -ForegroundColor Green

# PASO 5: Deploy Firestore Indexes
Write-Host ""
Write-Host "📊 Paso 5/5: Deploying Firestore Indexes..." -ForegroundColor Cyan
firebase deploy --only firestore:indexes

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Advertencia: Error deploying indexes (puede ser normal si no hay indexes)" -ForegroundColor Yellow
}

# Verificar deployment
Write-Host ""
Write-Host "✅ Verificando deployment..." -ForegroundColor Cyan
Write-Host ""
firebase functions:list

# Resumen
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "🎉 DEPLOYMENT COMPLETADO" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Siguiente paso: Verificar en Firebase Console" -ForegroundColor Yellow
Write-Host "   https://console.firebase.google.com/project/furgokid/functions" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 Testing: Crear una request en la app y verificar logs" -ForegroundColor Yellow
Write-Host "   firebase functions:log --only notifyDriversNewRequest" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Monitoreo:" -ForegroundColor Yellow
Write-Host "   - Firestore → notification_logs (success)" -ForegroundColor Cyan
Write-Host "   - Firestore → notification_errors (errors)" -ForegroundColor Cyan
Write-Host ""
