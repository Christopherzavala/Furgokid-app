Write-Host "🔧 MODO INGENIERO: REPARACIÓN DE SISTEMA" -ForegroundColor Cyan

# Ensure we are in the project root
if (Test-Path ".\package.json") {
    Write-Host "📂 Directorio correcto detectado." -ForegroundColor Green
}
elseif (Test-Path ".\FurgoKid\package.json") {
    Write-Host "📂 Cambiando al directorio del proyecto..." -ForegroundColor Yellow
    Set-Location ".\FurgoKid"
}
else {
    Write-Host "❌ No se encuentra package.json. Ejecuta este script desde la carpeta del proyecto." -ForegroundColor Red
    exit 1
}

# Clean
Write-Host "🧹 Limpiando archivos temporales..." -ForegroundColor Yellow
$items = "node_modules", ".expo", "package-lock.json", "yarn.lock", ".npm", ".metro"
foreach ($item in $items) {
    if (Test-Path $item) {
        Remove-Item -Recurse -Force $item -ErrorAction SilentlyContinue
        Write-Host "   - Eliminado $item" -ForegroundColor Gray
    }
}

# Install
Write-Host "📦 Instalando dependencias (esto puede tardar)..." -ForegroundColor Yellow
npm install --legacy-peer-deps

# Fix Expo
Write-Host "🔧 Alineando versiones de Expo..." -ForegroundColor Yellow
npx expo install --fix

# Doctor
Write-Host "🩺 Ejecutando diagnóstico final..." -ForegroundColor Yellow
npx expo-doctor

Write-Host "✅ REPARACIÓN COMPLETADA." -ForegroundColor Green
Write-Host "🚀 Para iniciar, ejecuta: npx expo start --clear" -ForegroundColor Cyan
