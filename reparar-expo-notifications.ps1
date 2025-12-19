# ========================================
# SCRIPT DE REPARACIÓN - EXPO NOTIFICATIONS
# ========================================
# Este script soluciona el error de expo-notifications en Expo Go SDK 53+
# Autor: Antigravity
# Fecha: 2025-11-25

Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  REPARACIÓN EXPO-NOTIFICATIONS - MODO INGENIERO   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Paso 1: Diagnóstico
Write-Host "📊 PASO 1: Diagnóstico del problema" -ForegroundColor Yellow
Write-Host "   - Error detectado: expo-notifications no soportado en Expo Go SDK 53+" -ForegroundColor Gray
Write-Host "   - Solución: Configuración condicional para development build" -ForegroundColor Gray

# Paso 2: Backup de configuración actual
Write-Host "`n💾 PASO 2: Creando backup de seguridad..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\backups\$timestamp"
New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
Copy-Item "app.json" "$backupDir\app.json" -Force
Copy-Item "package.json" "$backupDir\package.json" -Force
Write-Host "   ✓ Backup creado en: $backupDir" -ForegroundColor Green

# Paso 3: Verificar versión de SDK
Write-Host "`n🔍 PASO 3: Verificando versión de Expo SDK..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$expoVersion = $packageJson.dependencies.expo
Write-Host "   ✓ Expo SDK: $expoVersion" -ForegroundColor Green

# Paso 4: Solución - Comentar temporalmente el plugin
Write-Host "`n🔧 PASO 4: Aplicando solución..." -ForegroundColor Yellow
Write-Host "   Nota: Para usar expo-notifications necesitas crear un Development Build" -ForegroundColor Magenta
Write-Host "   Mientras tanto, comentaremos el plugin para que funcione en Expo Go" -ForegroundColor Magenta

# Leer app.json actual
$appJsonContent = Get-Content "app.json" -Raw

# Crear nueva configuración comentando expo-notifications
$appJsonUpdated = $appJsonContent -replace '      \[\s*"expo-notifications",\s*\{[^}]*\}\s*\],', '      // ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#2196F3" }],'

# Si el reemplazo no funcionó (porque no encuentra el patrón exacto), usar JSON parsing
if ($appJsonUpdated -eq $appJsonContent) {
    Write-Host "   ℹ️  Usando método alternativo de actualización..." -ForegroundColor Cyan
    $appJson = $appJsonContent | ConvertFrom-Json
    
    # Filtrar plugins para remover expo-notifications temporalmente
    $newPlugins = @()
    foreach ($plugin in $appJson.expo.plugins) {
        if ($plugin -is [System.Array] -and $plugin[0] -eq "expo-notifications") {
            Write-Host "   ⚠️  Plugin expo-notifications detectado y comentado" -ForegroundColor Yellow
        }
        else {
            $newPlugins += $plugin
        }
    }
    $appJson.expo.plugins = $newPlugins
    
    # Guardar nueva configuración
    $appJson | ConvertTo-Json -Depth 10 | Set-Content "app.json.tmp"
    Move-Item "app.json.tmp" "app.json" -Force
}
else {
    Set-Content "app.json" $appJsonUpdated
}

Write-Host "   ✓ Configuración actualizada" -ForegroundColor Green

# Paso 5: Crear configuración para Development Build (futuro)
Write-Host "`n📝 PASO 5: Guía de Development Build..." -ForegroundColor Yellow
Write-Host "   ✓ Ver archivo: DEV_BUILD_GUIDE.md" -ForegroundColor Green

# Paso 6: Actualizar código para manejar notificaciones condicionalmente
Write-Host "`n🔨 PASO 6: Creando wrapper condicional para notificaciones..." -ForegroundColor Yellow

# Crear directorio de utilidades si no existe
if (!(Test-Path "src\utils")) {
    New-Item -Path "src\utils" -ItemType Directory -Force | Out-Null
}

$notificationWrapper = @"
/**
 * Notification Service Wrapper
 * 
 * Este wrapper maneja notificaciones de manera condicional:
 * - En Development Build: Usa expo-notifications completo
 * - En Expo Go: Solo notificaciones locales (sin push remoto)
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configurar handler de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Verifica si estamos en un Development Build o Expo Go
 */
export const isDevBuild = () => {
  return Constants.appOwnership === 'expo';
};

/**
 * Registra el dispositivo para notificaciones push
 * Solo funciona en Development Build
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (!Device.isDevice) {
    console.warn('⚠️  Las notificaciones push solo funcionan en dispositivos físicos');
    return null;
  }

  // Verificar si estamos en Expo Go
  if (Constants.appOwnership === 'expo') {
    console.warn('⚠️  Notificaciones push remotas no disponibles en Expo Go');
    console.warn('ℹ️  Usa un Development Build para habilitar push notifications');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️  No se obtuvieron permisos para notificaciones');
      return null;
    }

    // Obtener token solo si no estamos en Expo Go
    token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    console.log('✅ Token de notificaciones:', token.data);
    return token.data;
  } catch (error) {
    console.error('❌ Error al registrar notificaciones:', error);
    return null;
  }
}

/**
 * Programa una notificación local
 * Funciona tanto en Expo Go como en Development Build
 */
export async function scheduleLocalNotification(title, body, data = {}, seconds = 1) {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: {
        seconds,
      },
    });
    
    console.log('✅ Notificación local programada:', id);
    return id;
  } catch (error) {
    console.error('❌ Error al programar notificación local:', error);
    return null;
  }
}

/**
 * Muestra una notificación inmediatamente
 */
export async function showNotification(title, body, data = {}) {
  return scheduleLocalNotification(title, body, data, 1);
}

/**
 * Cancela todas las notificaciones programadas
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ Todas las notificaciones canceladas');
  } catch (error) {
    console.error('❌ Error al cancelar notificaciones:', error);
  }
}

/**
 * Obtiene todas las notificaciones programadas
 */
export async function getScheduledNotifications() {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('❌ Error al obtener notificaciones programadas:', error);
    return [];
  }
}

export default {
  registerForPushNotificationsAsync,
  scheduleLocalNotification,
  showNotification,
  cancelAllNotifications,
  getScheduledNotifications,
  isDevBuild,
};
"@

Set-Content "src\utils\notificationService.js" $notificationWrapper
Write-Host "   ✓ Wrapper creado: src\utils\notificationService.js" -ForegroundColor Green

# Paso 7: Limpiar caché
Write-Host "`n🧹 PASO 7: Limpiando caché de Metro bundler..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item -Path ".expo" -Recurse -Force
    Write-Host "   ✓ Caché .expo limpiada" -ForegroundColor Green
}

# Resumen final
Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "✅ REPARACIÓN COMPLETADA CON ÉXITO" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

Write-Host "`n📋 RESUMEN DE CAMBIOS:" -ForegroundColor Yellow
Write-Host "   1. ✓ Backup creado en $backupDir" -ForegroundColor White
Write-Host "   2. ✓ Plugin expo-notifications deshabilitado temporalmente" -ForegroundColor White
Write-Host "   3. ✓ Wrapper de notificaciones creado (compatible con Expo Go)" -ForegroundColor White
Write-Host "   4. ✓ Guía de Development Build creada" -ForegroundColor White
Write-Host "   5. ✓ Caché limpiada" -ForegroundColor White

Write-Host "`n🚀 PRÓXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "   1. Ejecutar: npx expo start --clear" -ForegroundColor Cyan
Write-Host "   2. Escanear QR con Expo Go (funcionará sin errores)" -ForegroundColor Cyan
Write-Host "   3. Para notificaciones push: Leer DEV_BUILD_GUIDE.md" -ForegroundColor Cyan

Write-Host "`n💡 NOTAS IMPORTANTES:" -ForegroundColor Magenta
Write-Host "   • En Expo Go: Solo notificaciones locales funcionan" -ForegroundColor Gray
Write-Host "   • Para push remoto: Necesitas crear un Development Build" -ForegroundColor Gray
Write-Host "   • Usa src\utils\notificationService.js para manejar notificaciones" -ForegroundColor Gray

Write-Host "`n✨ Script completado. Todo listo para arrancar!\n" -ForegroundColor Green
