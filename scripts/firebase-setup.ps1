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
    Write-Host "Firebase CLI no encontrado. Este diagnóstico no instala herramientas." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ============================================================================
# PASO 2: Login a Firebase
# ============================================================================

Write-Host "[2/5] Autenticación no realizada por el diagnóstico." -ForegroundColor Blue

Write-Host ""

# ============================================================================
# PASO 3: Inicializar proyecto (si no está)
# ============================================================================

Write-Host "[3/5] Verificando configuración de proyecto..." -ForegroundColor Blue

if (-not (Test-Path ".firebaserc")) {
    Write-Host "Proyecto no inicializado. Ejecuta el flujo de inicialización por separado y revisa sus cambios." -ForegroundColor Yellow
} else {
    Write-Host "✓ Proyecto ya configurado" -ForegroundColor Green
    Get-Content .firebaserc
}

Write-Host ""

# ============================================================================
# PASO 4: Informar el procedimiento seguro de deploy
# ============================================================================

Write-Host "[4/5] No se despliegan recursos desde este script de setup." -ForegroundColor Blue
Write-Host "Para staging usa: .\scripts\deploy-staging.ps1 -ProjectId furgokid-staging" -ForegroundColor Yellow
Write-Host "Para producción usa: .\scripts\deploy.ps1 -ProjectId furgokid" -ForegroundColor Yellow

Write-Host ""

# ============================================================================
# PASO 5: Confirmar que las reglas se despliegan por el flujo protegido
# ============================================================================

Write-Host "[5/5] Las reglas se despliegan solo mediante los scripts protegidos indicados arriba." -ForegroundColor Blue

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                   ✅ Setup Completado                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# RESUMEN Y PRÓXIMOS PASOS
# ============================================================================

Write-Host "📊 Resumen del setup (sin deployment):" -ForegroundColor Blue
Write-Host ""
Write-Host "No se ejecutó ningún deploy ni consulta remota desde este resumen." -ForegroundColor Gray
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
