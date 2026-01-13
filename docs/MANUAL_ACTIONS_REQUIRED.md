# 📋 Manual Actions Required - Deployment Checklist

**Última actualización:** 13 Enero 2026  
**Tiempo estimado total:** ~1 hora 10 minutos

---

## 🔴 CRÍTICO - Realizar ANTES del deployment

### 1. ⏰ Firebase API Key Restrictions (5 minutos)

**Estado:** ⚠️ PENDIENTE  
**Prioridad:** CRITICAL  
**Riesgo si no se hace:** Account hijacking, quota exhaustion

#### Pasos:

Guía rápida y actualizada: ver [docs/SECURITY_ACTIONS_REQUIRED.md](SECURITY_ACTIONS_REQUIRED.md)

1. **Ir a Firebase Console:**

   ```
   https://console.firebase.google.com
   ```

2. **Seleccionar proyecto:** furgokid-app (o tu proyecto)

3. **Navegar a configuración:**

   - Click en ⚙️ (Settings icon)
   - Project Settings
   - Pestaña "General"
   - Scroll hasta "Web API Key"
   - Click en "Application restrictions"

4. **Configurar restricciones para Android:**

   - Type: **Android apps**
   - Click "Add an Android app"
   - Package name: `com.furgokid.app`
   - SHA-1 certificate fingerprint:
     - Para debug: Obtener con `keytool -list -v -keystore ~/.android/debug.keystore`
     - Para production: Lo genera Google Play (Play Console → Setup → App integrity)
   - Click "Save"

5. **Configurar restricciones para iOS:**

   - Type: **iOS apps**
   - Click "Add an iOS app"
   - Bundle ID: `com.furgokid.app`
   - App Store ID: (dejar vacío por ahora, agregar después del submit)
   - Team ID: (encontrar en Apple Developer Portal)
   - Click "Save"

6. **Verificar:**
   - Build preview: `npm run build:preview`
   - Probar que la app sigue funcionando
   - Esperar ~5 minutos para propagación

**Documentación:** https://cloud.google.com/docs/authentication/api-keys

---

### 2. ⏰ Privacy Policy Deployment (10 minutos)

**Estado:** ⚠️ PENDIENTE (solo si GitHub Pages no está habilitado)  
**Prioridad:** CRITICAL (Store rejection sin esto)  
**URL configurada (app.config.js):** `https://christopherzavala.github.io/Furgokid-app/docs/privacy-policy.html`

#### GitHub Pages (recomendado)

1. Asegurar que el repo tenga GitHub Pages activo:
   - Settings → Pages
   - Source: `main` / `/docs`
2. Validar que estas URLs cargan sin 404:
   - `.../docs/privacy-policy.html`
   - `.../docs/terms-of-service.html`

Nota: los HTML ya existen en el repo (`docs/privacy-policy.html` y `docs/terms-of-service.html`).

#### Alternativa: Firebase Hosting

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar hosting
firebase init hosting

# Crear public/privacy-policy.html (o copiar desde docs/privacy-policy.html)

# Deploy
firebase deploy --only hosting

# URL ejemplo: https://<tu-proyecto>.web.app/privacy-policy.html

---

### 3. 🚨 Sentry Alerts (P0) (10 minutos)

**Estado:** ⚠️ PENDIENTE
**Prioridad:** CRITICAL (detección rápida de incidentes)

Guía: ver [docs/SRE_ALERTS_SETUP.md](SRE_ALERTS_SETUP.md)

---

### 4. 💸 Firebase Budget Alerts (P0/P1) (10 minutos)

**Estado:** ⚠️ PENDIENTE
**Prioridad:** ALTA (evitar sorpresas de costo)

Guía: ver [docs/FIREBASE_BUDGET_ALERTS.md](FIREBASE_BUDGET_ALERTS.md)
```

#### Opción C: Comprar dominio furgokid.app

**Costo:** ~$12/año  
**Provider:** Namecheap, GoDaddy, Google Domains  
**Tiempo:** 1 día (DNS propagation)

**Verificación:**

```bash
curl https://tu-url-elegida/privacy-policy
# Debe retornar HTML de la política
```

---

### 3. ⏰ Firestore Database Indexes (15 minutos)

**Estado:** ⚠️ PENDIENTE  
**Impacto:** 60-80% slower queries sin indexes  
**Archivo:** [firestore.indexes.json](../firestore.indexes.json)

#### Opción A: Firebase CLI (Recomendado)

```bash
# Instalar Firebase CLI si no lo tienes
npm install -g firebase-tools

# Login
firebase login

# Inicializar proyecto (si no está)
firebase init

# Seleccionar:
# - Firestore
# - Use existing project: furgokid-app

# El archivo firestore.indexes.json ya existe, solo deploy
firebase deploy --only firestore:indexes

# Verificar
firebase firestore:indexes
```

**Output esperado:**

```
✔ Firestore indexes deployed successfully
Indexes deployed:
- routes (driverId ASC, status ASC, createdAt DESC)
- routes (status ASC, scheduledTime ASC)
- trackingPoints (routeId ASC, timestamp DESC)
- notifications (userId ASC, read ASC, createdAt DESC)
- users (role ASC, active ASC, createdAt DESC)
- requests (parentId ASC, status ASC, createdAt DESC)
- requests (driverId ASC, status ASC, createdAt DESC)
```

#### Opción B: Firebase Console (Manual)

**Si Firebase CLI falla:**

1. **Ir a Firestore:**

   ```
   https://console.firebase.google.com → Firestore Database → Indexes
   ```

2. **Crear índices manualmente** (usar firestore.indexes.json como referencia):

   **Índice 1: Routes por Driver**

   - Collection: `routes`
   - Fields to index:
     - driverId: Ascending
     - status: Ascending
     - createdAt: Descending
   - Click "Create index"
   - Esperar ~2 minutos

   **Repetir para los 6 índices restantes** (ver firestore.indexes.json)

3. **Verificar:**
   - Todos los índices deben mostrar "Enabled" (verde)
   - Run queries en la app para confirmar performance

**Tiempo estimado:** 5-10 minutos de creación + 2-5 min propagación por índice

---

### 4. ⏰ Sentry Account Setup (10 minutos)

**Estado:** ⚠️ PENDIENTE  
**Costo:** GRATIS (5,000 events/month)  
**Beneficio:** Error tracking en producción

#### Pasos:

1. **Crear cuenta:**

   ```
   https://sentry.io/signup/
   ```

   - Usar email de GitHub
   - Plan: Developer (Free)

2. **Crear proyecto:**

   - Platform: React Native
   - Alert frequency: On every new issue
   - Project name: furgokid-app

3. **Obtener DSN:**

   ```
   https://sentry.io/settings/furgokid-app/projects/furgokid-app/keys/
   ```

   - Copiar "DSN" (parecido a: `https://abc123@sentry.io/456789`)

4. **Agregar a EAS Secrets:**

   ```bash
   eas secret:create --name SENTRY_DSN --value "https://abc123@sentry.io/456789" --type string
   ```

5. **Actualizar eas.json:**

   ```json
   "production": {
     "env": {
       "SENTRY_DSN": "eas-secret:SENTRY_DSN"
     }
   }
   ```

6. **Verificar en próximo build:**
   ```bash
   npm run build:production
   # Logs deben mostrar: [Sentry] Initialized (production, sample rate: 1.0)
   ```

**Documentación:** https://docs.sentry.io/platforms/react-native/

---

## 🟡 IMPORTANTE - Realizar esta semana

### 5. ⏰ Firestore Security Rules (30 minutos)

**Estado:** ⚠️ DEMASIADO PERMISIVO  
**Archivo:** [firestore.rules](../firestore.rules)  
**Riesgo:** Data leakage, unauthorized writes

#### Plan de implementación:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function hasRole(role) {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isOwner(userId) || hasRole('admin');
      allow create: if isAuthenticated();
      allow update: if isOwner(userId) &&
                      request.resource.data.role == resource.data.role; // Prevent role escalation
      allow delete: if hasRole('admin');
    }

    // Routes collection
    match /routes/{routeId} {
      allow read: if isAuthenticated();
      allow create: if hasRole('driver');
      allow update: if hasRole('driver') &&
                      get(/databases/$(database)/documents/routes/$(routeId)).data.driverId == request.auth.uid;
      allow delete: if hasRole('driver') || hasRole('admin');
    }

    // Tracking points
    match /trackingPoints/{pointId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('driver');
    }

    // Requests
    match /requests/{requestId} {
      allow read: if isAuthenticated() && (
        resource.data.parentId == request.auth.uid ||
        resource.data.driverId == request.auth.uid ||
        hasRole('admin')
      );
      allow create: if hasRole('parent');
      allow update: if hasRole('driver') || hasRole('parent') || hasRole('admin');
    }

    // Notifications
    match /notifications/{notificationId} {
      allow read: if isOwner(resource.data.userId);
      allow write: if false; // Only backend can write
    }
  }
}
```

**Deploy:**

```bash
firebase deploy --only firestore:rules
```

**Testing:**

```bash
# Probar con diferentes usuarios y roles
# Verificar que solo pueden acceder a sus datos
```

---

## ✅ Post-Deployment Verification

### Checklist de validación:

```bash
# 1. Build production
npm run build:production

# 2. Verificar en logs del build:
✓ Firebase API key restrictions: Active
✓ Privacy Policy URL: Accessible
✓ Sentry DSN: Configured
✓ Database indexes: Deployed

# 3. Install APK en dispositivo de prueba

# 4. Verificar funcionalidad:
- [ ] Login/Register funciona
- [ ] Firebase queries rápidas (<500ms)
- [ ] Privacy Policy link funciona
- [ ] Sentry captura errores (forzar crash de prueba)
- [ ] AdMob muestra anuncios de producción

# 5. Monitoreo:
- [ ] Firebase Console: Sin errores de permisos
- [ ] Sentry Dashboard: Eventos llegando
- [ ] AdMob Console: Impresiones contando
```

---

## 📞 Recursos y Links

### Firebase

- Console: https://console.firebase.google.com
- Docs: https://firebase.google.com/docs

### Sentry

- Dashboard: https://sentry.io
- React Native Docs: https://docs.sentry.io/platforms/react-native/

### Google Play

- Console: https://play.google.com/console
- Policies: https://play.google.com/about/developer-content-policy/

### EAS

- Dashboard: https://expo.dev
- Secrets: `eas secret:list`

---

## ⚠️ Troubleshooting

### Firebase API restrictions rompen la app

**Solución:** Verificar package name exacto en app.config.js

```bash
# Debe coincidir EXACTAMENTE
Android: Com.Furgokid.App
iOS: Com.Furgokid.App
```

### Privacy Policy 404

**Solución:**

- Verificar DNS propagation (usar https://dnschecker.org)
- GitHub Pages toma 5-10 minutos
- Verificar archivo se llama `index.html`

### Sentry no recibe eventos

**Solución:**

- Verificar DSN correcto en secrets: `eas secret:list`
- Forzar crash de prueba: `throw new Error('Test Sentry');`
- Revisar sample rate en sentry.ts (debe ser 1.0 en prod)

### Firestore indexes fallan

**Solución:**

```bash
# Ver errores detallados
firebase deploy --only firestore:indexes --debug

# Crear manualmente en console si CLI falla
```

---

**Tiempo total estimado:** ~1h 10min  
**Prioridad:** Completar antes del primer build de producción  
**Responsable:** Development Team

✅ = Completado  
⚠️ = Pendiente  
❌ = Bloqueado
