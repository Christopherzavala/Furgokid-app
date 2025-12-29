Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "🚀 INICIANDO FURGOKID - GUÍA PASO A PASO" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 COMANDOS A EJECUTAR EN ORDEN:" -ForegroundColor Yellow
Write-Host ""

Write-Host "PASO 1: Verificar que estás en el directorio correcto" -ForegroundColor Green
Write-Host "Comando: " -NoNewline -ForegroundColor White
Write-Host "pwd" -ForegroundColor Cyan
Write-Host "Debes estar en: C:\Users\Dell\Desktop\Furgokid" -ForegroundColor Gray
Write-Host ""

Write-Host "PASO 2: Detener procesos Node anteriores" -ForegroundColor Green
Write-Host "Comando: " -NoNewline -ForegroundColor White
Write-Host "Get-Process -Name 'node' -ErrorAction SilentlyContinue | Stop-Process -Force" -ForegroundColor Cyan
Write-Host ""

Write-Host "PASO 3: Iniciar el servidor de desarrollo" -ForegroundColor Green
Write-Host "Comando: " -NoNewline -ForegroundColor White
Write-Host "npx expo start --clear" -ForegroundColor Cyan
Write-Host ""

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "💡 COPIA Y PEGA CADA COMANDO UNO POR UNO" -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

Write-Host "¿Quieres que ejecute PASO 2 automáticamente? (S/N): " -NoNewline -ForegroundColor Yellow
$respuesta = Read-Host

if ($respuesta -eq "S" -or $respuesta -eq "s") {
    Write-Host "`n🛑 Deteniendo procesos Node..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "✅ Procesos detenidos" -ForegroundColor Green
    
    Write-Host "`n📱 Ahora ejecuta manualmente en otra terminal:" -ForegroundColor Cyan
    Write-Host "   npx expo start --clear" -ForegroundColor White
    Write-Host ""
    Write-Host "📲 Luego escanea el QR con Expo Go desde tu celular" -ForegroundColor Cyan
}
else {
    Write-Host "`n👉 Ejecuta manualmente cada comando arriba mencionado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "📖 Para más información, consulta: README-CONFIGURACION.md" -ForegroundColor Gray
Write-Host "=" * 80 -ForegroundColor Cyan
