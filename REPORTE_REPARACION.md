# Reporte de Reparación - Modo Ingeniero

## Diagnóstico
Se detectó un error crítico en la terminal al iniciar la aplicación:
```
No 'androidAppId' was provided. The native Google Mobile Ads SDK will crash on Android without it.
No 'iosAppId' was provided. The native Google Mobile Ads SDK will crash on iOS without it.
```
Este error indica que la librería `react-native-google-mobile-ads` estaba instalada pero no configurada correctamente en `app.json`. Esto causaría que la aplicación se cierre inesperadamente (crash) en dispositivos físicos.

## Solución Aplicada
Se ha modificado el archivo `app.json` para incluir la configuración requerida con **IDs de prueba** de Google AdMob.

### Cambios en `app.json`:
```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-3940256099942544~3347511713",
    "iosAppId": "ca-app-pub-3940256099942544~1458002511"
  }
]
```

## Próximos Pasos
1. **IMPORTANTE**: Antes de publicar la aplicación en producción, debes reemplazar estos IDs de prueba con tus propios IDs de AdMob en `app.json`.
2. La aplicación ahora debería iniciar correctamente sin advertencias de bloqueo.

## Estado
✅ **REPARADO**
