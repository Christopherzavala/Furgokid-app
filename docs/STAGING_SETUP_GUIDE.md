# Staging Environment Setup Guide

## 🎯 Objetivo

Crear un ambiente staging separado para testing sin afectar Firebase producción.

---

## 📋 Paso 1: Crear Proyecto Firebase Staging

### En Firebase Console

1. **Ir a Firebase Console**

   ```
   https://console.firebase.google.com/
   ```

2. **Crear Nuevo Proyecto**

   - Click "Add project"
   - Nombre: **furgokid-staging**
   - Google Analytics: Activar (usa cuenta existente)
   - Click "Create project"

3. **Activar Servicios Necesarios**

   **a) Authentication**

   ```
   Firebase Console → furgokid-staging → Authentication → Get Started
   → Sign-in method
   → Email/Password: Enable
   ```

   **b) Firestore Database**

   ```
   Firebase Console → furgokid-staging → Firestore Database → Create database
   → Start in production mode
   → Location: us-central (o tu región)
   ```

   **c) Storage**

   ```
   Firebase Console → furgokid-staging → Storage → Get started
   → Start in production mode
   ```

4. **Configurar Web App**

   ```
   Firebase Console → furgokid-staging → Project Settings
   → Your apps → Add app → Web (</> icon)
   → App nickname: "FurgoKid Staging Web"
   → Firebase Hosting: No (por ahora)
   → Register app
   ```

5. **Copiar Credenciales**

   Verás algo como:

   ```javascript
   const firebaseConfig = {
     apiKey: 'AIza...STAGING_KEY',
     authDomain: 'furgokid-staging.firebaseapp.com',
     projectId: 'furgokid-staging',
     storageBucket: 'furgokid-staging.appspot.com',
     messagingSenderId: '1234567890',
     appId: '1:1234567890:web:abcdef',
   };
   ```

   **⚠️ IMPORTANTE: Copia TODAS estas credenciales**

---

## 📋 Paso 2: Configurar Android App (Opcional pero recomendado)

```
Firebase Console → furgokid-staging → Project Settings
→ Your apps → Add app → Android (Android icon)
→ Package name: com.furgokid.app.staging
→ App nickname: "FurgoKid Staging Android"
→ Register app
→ Download google-services.json (staging)
```

**Guardar como:** `google-services.staging.json` (no commitear)

---

## 📋 Paso 3: Configurar Firestore Rules en Staging

```
Firebase Console → furgokid-staging → Firestore Database → Rules
```

**Copiar las reglas de producción:**

```bash
# En tu proyecto local
cat firestore.rules
```

**Pegar en Firestore Staging Rules y publicar**

---

## 📋 Paso 4: Crear Datos de Test en Staging

### Usuarios de Prueba

```javascript
// En Firestore staging, crear colección 'users':

// Usuario 1: Parent
{
  uid: "test-parent-001",
  email: "parent@test.com",
  name: "Test Parent",
  role: "parent",
  whatsapp: "+1234567890",
  createdAt: "2025-12-30"
}

// Usuario 2: Driver
{
  uid: "test-driver-001",
  email: "driver@test.com",
  name: "Test Driver",
  role: "driver",
  whatsapp: "+0987654321",
  createdAt: "2025-12-30"
}
```

### Rutas de Prueba

```javascript
// Colección 'routes':
{
  id: "test-route-001",
  driverId: "test-driver-001",
  name: "Ruta Centro - Escuela Norte",
  schedule: "morning",
  zone: "centro",
  active: true,
  createdAt: "2025-12-30"
}
```

---

## 📋 Paso 5: Configurar Authentication Test Users

```
Firebase Console → furgokid-staging → Authentication → Users → Add user

Usuario 1:
- Email: parent@test.com
- Password: Test123456

Usuario 2:
- Email: driver@test.com
- Password: Test123456
```

---

## ✅ Checklist de Verificación

Antes de continuar al siguiente paso, verifica:

- [ ] Proyecto Firebase staging creado
- [ ] Authentication habilitado (Email/Password)
- [ ] Firestore Database creado
- [ ] Storage habilitado
- [ ] Credenciales web copiadas
- [ ] Firestore rules publicadas
- [ ] 2 usuarios de test creados (parent + driver)
- [ ] Datos de prueba insertados (opcional)

---

## 🔐 Seguridad

**⚠️ IMPORTANTE:**

1. **NO commits de credenciales**

   ```bash
   # Verificar .gitignore incluye:
   .env.staging
   google-services.staging.json
   ```

2. **Restringir API Keys**

   ```
   Firebase Console → furgokid-staging → Project Settings
   → General → Web API Key → Application restrictions
   → HTTP referrers: http://localhost:*, https://*.expo.dev/*
   ```

3. **Budget Alerts**
   ```
   Google Cloud Console → furgokid-staging → Billing
   → Budgets & alerts → Create budget
   → Amount: $10/month (staging should be low cost)
   → Alert threshold: 50%, 80%, 100%
   ```

---

## 🎯 Próximos Pasos

Una vez completado este setup:

1. ✅ Crear `.env.staging` en tu proyecto
2. ✅ Actualizar `eas.json` con profile staging
3. ✅ Test build: `npm run build:staging`
4. ✅ Validar conexión a Firebase staging

**Tiempo estimado total:** 30-45 minutos

---

## 📞 Troubleshooting

### Error: "Firebase app already exists"

```typescript
// En src/config/firebase.js
// Agregar check antes de initializeApp:
if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}
```

### Error: "Permission denied" en Firestore

```
Verificar que las rules se publicaron correctamente
Firebase Console → Firestore → Rules → Publish
```

### Error: Authentication no funciona

```
Verificar que Email/Password está enabled
Authentication → Sign-in method → Email/Password → Enabled
```

---

**Última actualización:** 30 Diciembre 2025  
**Siguiente paso:** Configurar .env.staging en proyecto local
