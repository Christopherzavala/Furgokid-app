# 🔐 GitHub Secrets Setup Guide

Esta guía describe cómo configurar los Secrets necesarios en GitHub para que el CI/CD pipeline (`ci-cd.yml`) funcione correctamente.

## 📋 Requisitos Previos

1. Acceso de administrador al repositorio en GitHub
2. Valores de configuración de las plataformas:
   - Firebase Console
   - AdMob Console
   - Expo (EAS token)

---

## 🔑 Secrets a Configurar

### **1. Directorio en GitHub**

```
GitHub → Settings → Secrets and variables → Actions
```

### **2. Lista Completa de Secrets**

| Secret Name                                | Origen                                       | Tipo   | Obligatorio      | Valor de Ejemplo                             |
| ------------------------------------------ | -------------------------------------------- | ------ | ---------------- | -------------------------------------------- |
| `EXPO_PUBLIC_FIREBASE_API_KEY`             | Firebase Console → Settings → API Key        | Secret | ✅ SÍ            | `AIzaSyC4QkQ7uhLgXtdt...`                    |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase Console → Settings → Auth Domain    | Secret | ✅ SÍ            | `furgokid.firebaseapp.com`                   |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase Console → Settings → Project ID     | Secret | ✅ SÍ            | `furgokid`                                   |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Firebase Console → Settings → Storage Bucket | Secret | ✅ SÍ            | `furgokid.firebasestorage.app`               |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console → Settings → Sender ID      | Secret | ✅ SÍ            | `1061722538586`                              |
| `EXPO_PUBLIC_FIREBASE_APP_ID`              | Firebase Console → Settings → App ID         | Secret | ✅ SÍ            | `1:1061722538586:web:25d...`                 |
| `ADMOB_ANDROID_APP_ID`                     | AdMob Console → Apps → App Settings          | Secret | ✅ SÍ            | `ca-app-pub-6159996738450051~7339939476`     |
| `ADMOB_IOS_APP_ID`                         | AdMob Console → Apps → App Settings          | Secret | ✅ SÍ            | `ca-app-pub-6159996738450051~7339939476`     |
| `BANNER_AD_UNIT_ID`                        | AdMob Console → Ad units                     | Secret | ✅ SÍ            | `ca-app-pub-6159996738450051/5061917035`     |
| `INTERSTITIAL_AD_UNIT_ID`                  | AdMob Console → Ad units                     | Secret | ✅ SÍ            | `ca-app-pub-6159996738450051/9969972240`     |
| `REWARDED_AD_UNIT_ID`                      | AdMob Console → Ad units                     | Secret | ✅ SÍ            | `ca-app-pub-6159996738450051/5608055408`     |
| `BANNER_AD_UNIT_IOS`                       | AdMob Console → Ad units (iOS)               | Secret | ⚠️ Opcional      | `ca-app-pub-6159996738450051/5061917035`     |
| `INTERSTITIAL_AD_UNIT_IOS`                 | AdMob Console → Ad units (iOS)               | Secret | ⚠️ Opcional      | `ca-app-pub-6159996738450051/9969972240`     |
| `REWARDED_AD_UNIT_IOS`                     | AdMob Console → Ad units (iOS)               | Secret | ⚠️ Opcional      | `ca-app-pub-6159996738450051/5608055408`     |
| `GOOGLE_MAPS_API_KEY`                      | Google Cloud Console → APIs → Maps API Key   | Secret | ✅ SÍ            | `AIzaSyCLirll_b9IkkQ5vAo...`                 |
| `SENTRY_DSN`                               | Sentry Project → Settings → DSN              | Secret | ⚠️ Opcional      | `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx` |
| `SENTRY_ENABLED`                           | Configuración interna                        | Secret | ⚠️ Opcional      | `true` o `false`                             |
| `FIREBASE_ANALYTICS_ENABLED`               | Configuración interna                        | Secret | ⚠️ Opcional      | `true` o `false`                             |
| `EXPO_PUBLIC_ADS_MODE`                     | Configuración interna                        | Secret | ⚠️ Opcional      | `production` o `test`                        |
| `EXPO_PUBLIC_ADS_FORCE_TEST`               | Configuración interna (dev)                  | Secret | ⚠️ Opcional      | `false`                                      |
| `EAS_TOKEN`                                | Expo → Account → Personal access tokens      | Secret | ✅ SÍ (para EAS) | `expo_nk_xxxxx...`                           |

---

## 🚀 Instrucciones Paso a Paso

### **Paso 1: Obtener Firebase Credentials**

```
1. Ir a: https://console.firebase.google.com
2. Seleccionar proyecto "furgokid"
3. Ir a: Project Settings (ícono rueda dentada)
4. Ir a: General tab
5. Bajar hasta "Your apps" section
6. Buscar la web app (ícono </>)
7. Click en "Firebaseconfig" o "sdk setup and config"
8. Copiar los 6 valores:
   - EXPO_PUBLIC_FIREBASE_API_KEY
   - EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
   - EXPO_PUBLIC_FIREBASE_PROJECT_ID
   - EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
   - EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - EXPO_PUBLIC_FIREBASE_APP_ID
```

### **Paso 2: Obtener AdMob IDs**

```
1. Ir a: https://admob.google.com
2. Ir a: Apps (menú izquierdo)
3. Buscar la app "FurgoKid" (o crear si no existe)
4. Ir a: App settings
5. Copiar:
   - ADMOB_ANDROID_APP_ID
   - ADMOB_IOS_APP_ID (mismo valor o diferente si exists)
6. Ir a: Ad units
7. Copiar los 3 Ad Unit IDs:
   - BANNER_AD_UNIT_ID
   - INTERSTITIAL_AD_UNIT_ID
   - REWARDED_AD_UNIT_ID
8. Repetir para iOS si existen
```

### **Paso 3: Obtener Google Maps API Key**

```
1. Ir a: https://console.cloud.google.com
2. Seleccionar proyecto "furgokid"
3. Ir a: APIs & Services → Credentials
4. Buscar la API Key existente o crear nueva
5. Copiar: GOOGLE_MAPS_API_KEY
```

### **Paso 4: Obtener Sentry DSN (Opcional)**

```
1. Ir a: https://sentry.io
2. Seleccionar proyecto "FurgoKid"
3. Ir a: Settings → Projects
4. Buscar el proyecto y click en "Client Keys (DSN)"
5. Copiar el valor completo del DSN
6. Copiar: SENTRY_DSN
```

### **Paso 5: Obtener Expo EAS Token (Para builds automáticos)**

```
1. Ir a: https://expo.dev → Dashboard
2. Click en tu cuenta (arriba derecha)
3. Ir a: Personal access tokens
4. Click: "Create access token"
5. Nombre: "GitHub CI/CD"
6. Mantener el token seguro
7. Copiar: EAS_TOKEN
```

### **Paso 6: Agregar Secrets a GitHub**

```
1. Ir a: GitHub.com → tu repositorio
2. Settings → Secrets and variables → Actions
3. Click: "New repository secret"
4. Agregar cada secret:
   - Name: (exactamente como en la tabla arriba)
   - Value: (copiar del paso anterior)
5. Repetir para los 16+ secrets

IMPORTANTE:
   ✅ Nombres deben coincidir exactamente (case-sensitive)
   ✅ NO agregar espacios al inicio/final
   ✅ NO usar comillas alrededor del valor
```

---

## ✅ Verificación

### **Checklist Pre-Deploy**

```powershell
# 1. Verificar que .env local está sincronizado
cat .env

# 2. Ejecutar pre-build local
npm run pre-build:prod

# 3. Crear una rama de prueba
git checkout -b test/verify-secrets

# 4. Hacer commit dummy
git add .
git commit -m "test: verify github secrets"
git push origin test/verify-secrets

# 5. Crear PR en GitHub
# → Esperar a que ci-cd.yml ejecute
# → Revisar que todos los jobs pasaron (✅ verde)

# 6. Si todo pasó, mergear a main
# → CI ejecutará de nuevo en main
# → "Pre-build Validation" debería pasar
```

---

## 🔍 Troubleshooting

### **Error: "npm run validate:env:production failed"**

```
Causa: Falta algún secret obligatorio en GitHub
Solución:
  1. Revisar logs de CI en GitHub Actions
  2. Ver qué variable falta
  3. Agregar el secret faltante
  4. Re-run workflow
```

### **Error: "Security Audit: vulnerabilities found"**

```
Causa: npm audit encontró vulnerabilidades
Solución:
  1. Revisar logs de CI
  2. Ejecutar localmente: npm audit
  3. Remediar: npm audit fix
  4. Commit y push
```

### **Error: "TruffleHog: Secrets detected"**

```
Causa: Se encontraron hardcoded secrets
Solución:
  1. Revisar qué fue detectado
  2. Remover del código
  3. Usar secrets en GitHub
  4. Commit y re-push
```

### **EAS Build falla en PR**

```
Causa: EAS_TOKEN no está configurado o es inválido
Solución:
  1. Verificar que EAS_TOKEN está en GitHub secrets
  2. Verificar token es válido: eas auth
  3. Regenerar token si es necesario
  4. Actualizar en GitHub
  5. Re-run workflow
```

---

## 📊 Resumen: Estado Esperado

Después de configurar todos los secrets, esperamos:

**En Pull Request:**

- ✅ `test` job pasa (lint, tests, audit, validation)
- ✅ `build-preview` job pasa o se salta gracefully (si falta EAS_TOKEN)
- ✅ TruffleHog no-bloqueante (warning aceptable)

**En Main branch push:**

- ✅ `test` job pasa
- ✅ `deploy` job ejecuta `npm run pre-build:prod` ✅
- ✅ TruffleHog bloqueante (no debe encontrar secrets)
- ✅ Build Android está listo para manual approval

---

## 🎯 Next Steps

1. Configurar todos los secrets (15 min)
2. Crear PR de prueba para verificar CI (10 min)
3. Mergear a main y verificar deploy gate (5 min)
4. Listo para producción 🚀

**Tiempo total: ~30 minutos**

---

## 📞 Referencia Rápida

Copiar esta URL de búsqueda para cada secret:

```
GitHub → Settings → Secrets and variables → Actions → New repository secret
```

Campos:

- **Name**: (de la tabla arriba)
- **Value**: (de Firebase/AdMob/Expo console)

¡Guardar para cada uno!
