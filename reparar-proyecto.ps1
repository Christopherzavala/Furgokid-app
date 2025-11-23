Write-Host "🚀 Iniciando Protocolo de Reparación Senior para FurgoKid..." -ForegroundColor Cyan

# 1. Detener procesos de Node/Metro que puedan estar bloqueando archivos
Write-Host "🛑 Deteniendo procesos en segundo plano..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Limpieza profunda
Write-Host "🧹 Eliminando node_modules y cachés (esto puede tardar un poco)..." -ForegroundColor Yellow
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
if (Test-Path ".expo") { Remove-Item -Recurse -Force ".expo" }
if (Test-Path "package-lock.json") { Remove-Item -Force "package-lock.json" }
if (Test-Path "yarn.lock") { Remove-Item -Force "yarn.lock" }

# 3. Instalación limpia
Write-Host "📦 Instalando dependencias..." -ForegroundColor Green
npm install

# 4. Alineación de versiones de Expo
Write-Host "🔧 Ejecutando Expo Fix para alinear versiones..." -ForegroundColor Green
npx expo install --fix

# 5. Verificación final
Write-Host "✅ Reparación completada." -ForegroundColor Cyan
Write-Host "👉 Para iniciar tu app, ejecuta: npx expo start --clear" -ForegroundColor White
