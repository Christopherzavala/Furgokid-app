# 🧪 Testing Automatizado - FurgoKid Backend
# Este script ejecuta todos los tests y genera reporte

Write-Host "🧪 FurgoKid Backend Testing" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Verificar directorio
if (!(Test-Path "functions\package.json")) {
    Write-Host "❌ Error: No se encontró functions/package.json" -ForegroundColor Red
    exit 1
}

# Instalar dependencies si es necesario
Write-Host "📦 Verificando dependencies..." -ForegroundColor Yellow
Set-Location functions

if (!(Test-Path "node_modules")) {
    Write-Host "   Instalando dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error instalando dependencies" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

# Ejecutar tests
Write-Host ""
Write-Host "🧪 Ejecutando tests..." -ForegroundColor Cyan
npm test

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Tests fallaron" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host ""
Write-Host "✅ Todos los tests pasaron" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Coverage report disponible en:" -ForegroundColor Yellow
Write-Host "   functions/coverage/lcov-report/index.html" -ForegroundColor Cyan

Set-Location ..
