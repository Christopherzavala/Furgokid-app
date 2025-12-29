# MOVIDO A /docs (stub)

Este archivo se mantiene como **stub** para compatibilidad.

- Copia canónica: [docs/root-info/ERRORES-CORREGIDOS.md](docs/root-info/ERRORES-CORREGIDOS.md)
- Índice: [docs/root-info/INDEX.md](docs/root-info/INDEX.md)

# 🛠️ ERRORES CORREGIDOS - FURGOKID

## ✅ SOLUCIONES APLICADAS (2025-11-23 16:30)

### 1️⃣ **Error: Could not parse JSON google-services.json**

**Causa:** La app buscaba el archivo `google-services.json` pero no existía.

**Solución Aplicada:**

- ✅ Removida temporalmente la referencia en `app.json`
- ⚠️ Cuando descargues el archivo real de Firebase, descoméntalalo

**Código modificado en `app.json`:**

```json
// ANTES (causaba error):
"android": {
 "googleServicesFile": "./google-services.json"  // ❌ archivo no existe
}

// DESPUÉS (funciona):
"android": {
  // googleServicesFile removido temporalmente
}
```

**Para restaurar cuando tengas Firebase:**

1. Descarga `google-services.json` desde Firebase Console
2. Colócalo en la raíz del proyecto
3. Agrega de nuevo: `"googleServicesFile": "./google-services.json"`

---

### 2️⃣ **Error: Cannot find module 'react-native-vector-icons/Fonts/Roboto.ttf'**

**Causa:** `App.js` intentaba cargar fuentes que no existen en Expo.

**Solución Aplicada:**

- ✅ Eliminada carga incorrecta de fuentes en `App.js`
- ✅ `@expo/vector-icons` ya trae sus propias fuentes, no necesita carga manual

**Código eliminado de `App.js`:**

```javascript
// ELIMINADO (causaba error):
import * as Font from 'expo-font';

await Font.loadAsync({
  Roboto: require('react-native-vector-icons/Fonts/Roboto.ttf'), // ❌
  'Roboto-Medium': require('react-native-vector-icons/Fonts/Roboto-Medium.ttf'), // ❌
});
```

---

### 3️⃣ **Error: getMessaging() not supported in React Native**

**Causa:** `firebase.js` intentaba usar `getMessaging()` que solo funciona en web.

**Solución Aplicada:**

- ✅ Eliminado `getMessaging` de `firebase.js`
- ✅ Mantiene Auth, Firestore y Storage funcionando
- ✅ Para notificaciones, usa `expo-notifications` en su lugar

**Código simplificado en `src/config/firebase.js`:**

```javascript
// ANTES (causaba error):
import { getMessaging } from 'firebase/messaging'; // ❌ No funciona en RN
const messaging = getMessaging(app);

// DESPUÉS (funciona):
// Messaging removido - usa expo-notifications en su lugar
```

---

### 4️⃣ **Warning: AsyncStorage not provided to Firebase Auth**

**Estado:** ⚠️ Es solo un WARNING, no impide que funcione

**Explicación:**

- Firebase Auth recomienda AsyncStorage para persistir sesión
- Ya está instalado en `package.json`
- El warning es informativo, la app funciona igual

**Si quieres eliminarlo (opcional):**

```javascript
// En src/config/firebase.js, importar:
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';

// Y cambiar:
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
```

---

## 🚀 ESTADO ACTUAL

| Error                | Estado      | Acción                 |
| -------------------- | ----------- | ---------------------- |
| google-services.json | ✅ RESUELTO | Removido temporalmente |
| Roboto.ttf           | ✅ RESUELTO | Código eliminado       |
| Firebase messaging   | ✅ RESUELTO | Código simplificado    |
| AsyncStorage warning | ⚠️ WARNING  | Opcional arreglarlo    |

---

## 🎯 PRÓXIMOS PASOS

### Para iniciar la app AHORA:

```powershell
# Opción 1: Reinicio completo
.\reiniciar.ps1

# Opción 2: Inicio simple
.\iniciar.ps1

# Opción 3: Comando directo
npx expo start --clear
```

### Para configurar Firebase:

1. **Ve a:** [Firebase Console](https://console.firebase.google.com/)
2. **Descarga:** `google-services.json` (Android)
3. **Colócalo en:** Raíz del proyecto
4. **Descomenta en `app.json`:**
   ```json
   "android": {
     "googleServicesFile": "./google-services.json"
   }
   ```

📖 **Guía completa:** `CONFIGURAR-FIREBASE.md`

---

## ⚠️ WARNINGS QUE SON NORMALES

Estos mensajes aparecerán pero **NO SON ERRORES**:

✅ `expo-notifications functionality is not fully supported in Expo Go`
→ Normal, usa una build nativa para funcionalidad completa

✅ `Messaging not supported on this device`
→ Normal, removimos messaging intencionalmente

✅ `Use a development build instead of Expo Go`
→ Es solo una recomendación, Expo Go funciona bien para desarrollo

---

## 📞 SI AÚN HAY ERRORES

1. **Detén el servidor:**

   ```powershell
   Get-Process -Name "node" | Stop-Process -Force
   ```

2. **Ejecuta diagnóstico:**

   ```powershell
   .\diagnostico-y-reparacion.ps1
   ```

3. **Reinicia:**
   ```powershell
   .\reiniciar.ps1
   ```

---

**Última actualización:** 2025-11-23 16:30  
**Errores corregidos:** 3  
**Warnings pendientes:** 1 (opcional)  
**Estado:** ✅ LISTO PARA FUNCIONAR
