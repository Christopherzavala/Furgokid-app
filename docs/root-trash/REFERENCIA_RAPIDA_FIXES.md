# 🔧 REFERENCIA RÁPIDA DE FIXES

## Errores Comunes y Soluciones

### Error #1: "Cannot find module 'Text'"

```
UBICACIÓN: AdBannerComponent.js línea 50
CAUSA: Text component no importado
SOLUCIÓN:
  En línea 2, cambiar:
  import { View, ActivityIndicator } from 'react-native';
  A:
  import { View, ActivityIndicator, Text } from 'react-native';
```

### Error #2: "signOut is not defined"

```
UBICACIÓN: ParentHomeScreen.js línea 31
CAUSA: useAuth destructuring incorrecto
SOLUCIÓN:
  En línea 21, cambiar:
  const { user } = useAuth();
  const [child, signOut] = useAuth();
  A:
  const { user, signOut } = useAuth();
```

### Error #3: "getAdUnitId is not defined"

```
UBICACIÓN: ParentRequestScreen.js línea 73-90
CAUSA: AdMob imports faltantes
SOLUCIÓN:
  Agregar en línea 1-20 (después de otros imports):
  import { getAdUnitId, shouldShowInterstitial, recordInterstitialShown } from '../config/AdMobConfig';
  import AdInterstitialManager from '../components/AdInterstitialManager';
```

### Error #4: "Promise rejection: [timeout]"

```
UBICACIÓN: admobService.ts línea 56-72
CAUSA: Multiple promise resolutions
SOLUCIÓN:
  Ver FIXES_APLICADOS.md para código completo con flag 'resolved'
```

### Error #5: "Maximum call stack exceeded" (GPS)

```
UBICACIÓN: locationService.js línea 120-130
CAUSA: Duplicate listeners
SOLUCIÓN:
  Ver FIXES_APLICADOS.md para try-catch con cleanup
```

---

## Comandos Útiles

```bash
# Compilar y limpiar cache
npx expo start --clear

# Ver errores de compilación
npm run lint
# o
eslint src/

# Build para testing
eas build --platform android

# Ver logs en tiempo real
expo start --localhost

# Hard reset
rm -r node_modules && npm install
npx expo start --clear
```

---

## Archivos Clave Modificados

```
✏️  src/components/AdBannerComponent.js          [Line 2 - Text import]
✏️  src/screens/ParentHomeScreen.js              [Line 21 - useAuth fix]
✏️  src/screens/ParentRequestScreen.js           [Line 18-19 - AdMob imports]
✏️  src/services/admobService.ts                 [Line 56-72, 104-120 - Promise]
✏️  src/services/locationService.js              [Line 112-130 - Cleanup]
✏️  src/services/analyticsService.ts             [Line 43-65 - Validation]
✏️  src/config/AdMobConfig.js                    [Line 32-50 - Type checks]
✏️  src/context/AuthContext.js                   [Line 53 - Verified]
```

---

## Testing Checklist

- [ ] Paso 1: Verificar DriverScreen.js y DriverVacancyScreen.js
- [ ] Paso 2: `npx expo start --clear` sin errores
- [ ] Paso 3a: Login funciona
- [ ] Paso 3b: ParentHome carga sin crashes
- [ ] Paso 3c: Publicar necesidad → Ver interstitial ad
- [ ] Paso 3d: Logout funciona
- [ ] Paso 3e: Login como driver → Repetir pasos 3b-3d
- [ ] Paso 4: Build AAB: `eas build --platform android`

---

## Documentación Completa

**Para explicaciones técnicas:** → CODIGO_AUDIT_REPORTE.md  
**Para lista de fixes:** → FIXES_APLICADOS.md  
**Para pasos a seguir:** → CHECKLIST_POST_AUDITORIA.md  
**Para resumen visual:** → AUDITORÍA_VISUAL_SUMMARY.txt

---

## Contacto de Soporte

Si hay problemas después de los arreglos:

1. Lee el error exacto
2. Busca en CODIGO_AUDIT_REPORTE.md
3. Consulta FIXES_APLICADOS.md para el código correcto
4. Verifica línea de código vs archivo

**Más probable:** Los archivos DriverScreen o DriverVacancyScreen necesitan fixes similares.

---

**Auditoría Completada: ✅**  
**Estado: Listo para testing**  
**Próximo: `npx expo start --clear`**
