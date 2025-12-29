# Script de Validación - FurgoKid Expo Setup
# Este script verifica que todos los assets y dependencias estén correctamente configurados

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   VALIDACIÓN DE SETUP - FURGOKID EXPO     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$totalChecks = 0
$passedChecks = 0

# Función de validación
function Test-Item {
    param($Name, $Condition)
    $script:totalChecks++
    if ($Condition) {
        Write-Host "  ✓ $Name" -ForegroundColor Green
        $script:passedChecks++
        return $true
    } else {
        Write-Host "  ✗ $Name" -ForegroundColor Red
        return $false
    }
}

# === VALIDACIÓN DE ASSETS ===
Write-Host "📦 Assets:" -ForegroundColor Yellow
Test-Item "icon.png" (Test-Path "assets\icon.png")
Test-Item "splash.png" (Test-Path "assets\splash.png")
Test-Item "adaptive-icon.png" (Test-Path "assets\adaptive-icon.png")
Test-Item "favicon.png" (Test-Path "assets\favicon.png")
Test-Item "notification-icon.png" (Test-Path "assets\notification-icon.png")

# === VALIDACIÓN DE BABEL ===
Write-Host "`n🔧 Babel Configuration:" -ForegroundColor Yellow
Test-Item "babel-preset-expo instalado" (Test-Path "node_modules\babel-preset-expo")
Test-Item "babel.config.js existe" (Test-Path "babel.config.js")

# Verificar package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
Test-Item "babel-preset-expo en package.json" ($null -ne $packageJson.devDependencies.'babel-preset-expo')

# === VALIDACIÓN DE CONFIGURACIÓN ===
Write-Host "`n⚙️  Configuración del Proyecto:" -ForegroundColor Yellow
Test-Item "app.json existe" (Test-Path "app.json")
Test-Item "package.json existe" (Test-Path "package.json")
Test-Item "node_modules instalado" (Test-Path "node_modules")

# === RESUMEN ===
Write-Host "`n" + "═" * 50 -ForegroundColor Cyan
Write-Host "RESUMEN: $passedChecks/$totalChecks checks pasados" -ForegroundColor $(if ($passedChecks -eq $totalChecks) { "Green" } else { "Yellow" })
Write-Host "═" * 50 -ForegroundColor Cyan

if ($passedChecks -eq $totalChecks) {
    Write-Host "`n✅ ¡TODO CONFIGURADO CORRECTAMENTE!" -ForegroundColor Green
    Write-Host "`nPróximo paso:" -ForegroundColor Cyan
    Write-Host "  npx expo start --clear" -ForegroundColor White
} else {
    Write-Host "`n⚠️  Hay algunos problemas que requieren atención" -ForegroundColor Yellow
    Write-Host "`nRevisa los items marcados con ✗ y corrígelos antes de continuar" -ForegroundColor White
}

Write-Host ""
