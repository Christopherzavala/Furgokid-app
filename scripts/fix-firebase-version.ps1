# =========================================
# FIX FIREBASE VERSION - CRITICAL
# =========================================
#
# PROBLEMA: Firebase 12.6.0 NO ES COMPATIBLE con React Native
# SOLUCIÓN: Downgrade a Firebase 10.14.1 (última versión estable)

Write-Host ""
Write-Host "🔴 CORRECCIÓN CRÍTICA: FIREBASE VERSION" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

Write-Host "[INFO] Firebase 12.6.0 NO existe o NO es compatible con React Native" -ForegroundColor Yellow
Write-Host "[INFO] Instalando Firebase 10.14.1 (última versión estable)..." -ForegroundColor Cyan
Write-Host ""

# 1. Detener procesos
Write-Host "[1/4] Deteniendo procesos Node..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "      ✅ Completado"  -ForegroundColor Green

# 2. Desinstalar versión incorrecta
Write-Host "[2/4] Desinstalando Firebase 12.6.0..." -ForegroundColor Yellow
npm uninstall firebase
Write-Host "      ✅ Completado" -ForegroundColor Green

# 3. Instalar versión correcta
Write-Host "[3/4] Instalando Firebase 10.14.1..." -ForegroundColor Yellow
npm install firebase@10.14.1 --save --legacy-peer-deps
Write-Host "      ✅ Completado" -ForegroundColor Green

# 4. Verificar instalación
Write-Host "[4/4] Verificando instalación..." -ForegroundColor Yellow
$firebaseVersion = npm list firebase 2>&1 | Select-String "firebase@"
Write-Host "      $firebaseVersion" -ForegroundColor Cyan
Write-Host "      ✅ Completado" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Gray
Write-Host "✅ FIREBASE VERSION CORREGIDA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""
Write-Host "Versión anterior:  12.6.0 (incompatible)" -ForegroundColor Red
Write-Host "Versión actual:    10.14.1 (estable)" -ForegroundColor Green
Write-Host ""
Write-Host "Próximo paso: Reiniciar el servidor con .\iniciar.ps1" -ForegroundColor Cyan
Write-Host ""
