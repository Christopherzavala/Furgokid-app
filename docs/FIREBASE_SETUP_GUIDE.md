# Firebase Setup Guide - FurgoKid

## ⚠️  BLOQUEANTE: Auth NO funciona sin esto

**Estado actual:** Firebase tiene placeholders → **App no funcional**

**Tiempo estimado:** 15 minutos

---

## Opción A: Proyecto Firebase Existente

### Paso 1: Abrir Firebase Console

```
https://console.firebase.google.com
```

### Paso 2: Seleccionar Proyecto

- Si ya tienes un proyecto llamado "FurgoKid" o similar → Úsalo
- Si no → Ir a Opción B (crear nuevo)

### Paso 3: Obtener Credenciales

1. Click en ⚙️ (Settings) → **Project Settings**
2. General tab
3. Scroll down hasta "Your apps"
4. Si **NO hay app web** creada:
   - Click "Add app" → Web (</>)
   - Nickname: `FurgoKid Web`
   - Firebase Hosting: NO
   - Click "Register app"

5. Copiar los valores del **Firebase SDK snippet**:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",  // <-- COPIAR
  authDomain: "tu-proyecto.firebaseapp.com",  // <-- COPIAR
  projectId: "tu-proyecto",  // <-- COPIAR
  storageBucket: "tu-proyecto.appspot.com",  // <-- COPIAR
  messagingSenderId: "123456789012",  // <-- COPIAR
  appId: "1:123456789012:web:abc...",  // <-- COPIAR
  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com"  // <-- COPIAR (si existe)
};
```

---

## Opción B: Crear Nuevo Proyecto Firebase (Recomendado)

### Paso 1: Crear Proyecto

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"**
3. Nombre: `FurgoKid-Prod`
4. Google Analytics: **Enable** (recomendado para métricas)
5. Click "Create project"
6. Esperar ~1 minuto

### Paso 2: Enable Authentication

1. En sidebar izquierdo: **Build** → **Authentication**
2. Click **"Get started"**
3. Sign-in method tab
4. Click **"Email/Password"**
5. Enable **"Email/Password"** (toggle ON)
6. Click "Save"

### Paso 3: Enable Firestore Database

1. Sidebar: **Build** → **Firestore Database**
2. Click **"Create database"**
3. Location: Elegir región más cercana (ej: `us-central1`)
4. Security rules: Start in **production mode**
5. Click "Enable"

### Paso 4: Enable Cloud Messaging (Push Notifications)

1. Sidebar: **Build** → **Cloud Messaging**
2. Click **"Get started"** (si aparece)
3. *Ya está habilitado por defecto en proyectos nuevos*

### Paso 5: Crear App Web

1. Project Settings (⚙️) → General
2. Scroll down → "Your apps"
3. Click web icon (</>)
4. Nickname: `FurgoKid Web`
5. Firebase Hosting: **NO**
6. Click "Register app"
7. **COPIAR** el bloque `firebaseConfig`

---

## Paso Final: Actualizar .env

Una vez tengas las credenciales (Opción A o B):

```bash
# Abrir .env
notepad .env
```

**Reemplazar** estas líneas con tus valores REALES:

```bash
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=furgokid-prod.firebaseapp.com
FIREBASE_PROJECT_ID=furgokid-prod
FIREBASE_STORAGE_BUCKET=furgokid-prod.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456
FIREBASE_DATABASE_URL=https://furgokid-prod-default-rtdb.firebaseio.com
```

**Guardar** (Ctrl+S) y cerrar.

---

## Validar Config

```bash
npm run security:audit
```

**Resultado esperado:**
```
[OK] Todas las variables requeridas están presentes
```

Si aún dice "placeholders" → Verifica que copiaste bien los valores.

---

## Próximo Paso: Migrar a EAS

Una vez Firebase esté configurado:

```bash
npm run eas:migrate
```

Esto subirá **TODOS** los secrets (Firebase + AdMob) a EAS de forma segura.

---

## Troubleshooting

### "API key is invalid"

- Verifica que copiaste `API_KEY` completo (empieza con `AIza`)
- No debe tener comillas

### "Project ID not found"

- Verifica que el `PROJECT_ID` coincida exactamente con Firebase Console
- No debe tener espacios

### Auth sigue sin funcionar

- Verifica que **Email/Password** esté enabled en Firebase Console
- Esperar 1-2 min después de enable (propagación de config)

---

**¿Listo?**

Abre https://console.firebase.google.com y empieza desde Opción A o B.

**Avísame cuando termines** y ejecuto automáticamente el resto (EAS, validaciones, build).
