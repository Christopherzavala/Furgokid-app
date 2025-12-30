# ============================================================================
# Firebase Setup Helper Script - PowerShell Version
# Automatiza la configuración de Firebase para FurgoKid
# ============================================================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       🔥 Firebase Setup Helper - FurgoKid 🚌              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# PASO 1: Verificar Firebase CLI
# ============================================================================

Write-Host "[1/5] Verificando Firebase CLI..." -ForegroundColor Blue

try {
    $firebaseVersion = firebase --version 2>&1
    Write-Host "✓ Firebase CLI encontrado" -ForegroundColor Green
    Write-Host $firebaseVersion -ForegroundColor Gray
} catch {
    Write-Host "Firebase CLI no encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

Write-Host ""

# ============================================================================
# PASO 2: Login a Firebase
# ============================================================================

Write-Host "[2/5] Iniciando sesión en Firebase..." -ForegroundColor Blue
Write-Host "Se abrirá tu navegador para autenticación." -ForegroundColor Yellow
Write-Host ""

firebase login

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Login exitoso" -ForegroundColor Green
} else {
    Write-Host "✗ Error en login" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# PASO 3: Inicializar proyecto (si no está)
# ============================================================================

Write-Host "[3/5] Verificando configuración de proyecto..." -ForegroundColor Blue

if (-not (Test-Path ".firebaserc")) {
    Write-Host "Proyecto no inicializado. Configurando..." -ForegroundColor Yellow
    firebase init
} else {
    Write-Host "✓ Proyecto ya configurado" -ForegroundColor Green
    Get-Content .firebaserc
}

Write-Host ""

# ============================================================================
# PASO 4: Deploy Firestore Indexes
# ============================================================================

Write-Host "[4/5] Desplegando Firestore indexes..." -ForegroundColor Blue
Write-Host "Esto puede tardar 2-5 minutos..." -ForegroundColor Yellow
Write-Host ""

firebase deploy --only firestore:indexes

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Indexes desplegados exitosamente" -ForegroundColor Green
} else {
    Write-Host "✗ Error desplegando indexes" -ForegroundColor Red
    Write-Host "Tip: Verifica que firestore.indexes.json existe y es válido" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# PASO 5: Deploy Firestore Rules
# ============================================================================

Write-Host "[5/5] Desplegando Firestore security rules..." -ForegroundColor Blue
Write-Host "Aplicando reglas restrictivas de seguridad..." -ForegroundColor Yellow
Write-Host ""

firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Security rules desplegadas exitosamente" -ForegroundColor Green
} else {
    Write-Host "✗ Error desplegando rules" -ForegroundColor Red
    Write-Host "Tip: Verifica que firestore.rules existe y es válido" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                   ✅ Setup Completado                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# RESUMEN Y PRÓXIMOS PASOS
# ============================================================================

Write-Host "📊 Resumen del deployment:" -ForegroundColor Blue
Write-Host ""
firebase firestore:indexes
Write-Host ""

Write-Host "📋 Próximos pasos pendientes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 🔐 Firebase Console - Configurar API Key restrictions:"
Write-Host "   https://console.firebase.google.com → Settings → Web API Key"
Write-Host "   - Android: Com.Furgokid.App"
Write-Host "   - iOS: Com.Furgokid.App"
Write-Host ""
Write-Host "2. 🌐 Publicar Privacy Policy:"
Write-Host "   - Archivo HTML: docs/privacy-policy.html"
Write-Host "   - Opción 1: GitHub Pages"
Write-Host "   - Opción 2: Firebase Hosting"
Write-Host "   - Actualizar URL en app.config.js"
Write-Host ""
Write-Host "3. 🐛 Crear cuenta Sentry:"
Write-Host "   https://sentry.io/signup/"
Write-Host "   - Copiar DSN"
Write-Host "   - Ejecutar: eas secret:create --name SENTRY_DSN --value `"YOUR_DSN`""
Write-Host ""

Write-Host "Para más detalles, ver: docs/MANUAL_ACTIONS_REQUIRED.md" -ForegroundColor Green
Write-Host ""
