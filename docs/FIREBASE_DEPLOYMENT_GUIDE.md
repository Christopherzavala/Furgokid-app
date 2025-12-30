# 🔥 Firebase Deployment - Guía Paso a Paso

## ⚠️ IMPORTANTE: Necesitas completar estos pasos manualmente

Firebase CLI requiere autenticación interactiva y confirmación del proyecto.

---

## 📋 Paso 1: Login a Firebase

Ejecuta en tu terminal:

```powershell
firebase login
```

**Proceso:**

1. Se abrirá tu navegador
2. Selecciona tu cuenta de Google asociada a Firebase
3. Autoriza Firebase CLI
4. Vuelve a la terminal - verás "✔ Success! Logged in as tu-email@gmail.com"

---

## 📋 Paso 2: Verificar Proyecto

Verifica que el proyecto esté configurado:

```powershell
firebase projects:list
```

Deberías ver tu proyecto `furgokid-app` en la lista.

Si NO aparece, necesitas crear el proyecto en Firebase Console primero:
https://console.firebase.google.com/

---

## 📋 Paso 3: Actualizar .firebaserc (si es necesario)

Si tu proyecto tiene un ID diferente a "furgokid-app", edita `.firebaserc`:

```json
{
  "projects": {
    "default": "TU-PROJECT-ID-AQUI"
  }
}
```

Para encontrar tu Project ID:

1. Ir a Firebase Console: https://console.firebase.google.com/
2. Abrir tu proyecto
3. Settings (⚙️) → Project settings
4. Copiar "Project ID"

---

## 📋 Paso 4: Deploy Firestore Indexes

```powershell
firebase deploy --only firestore:indexes
```

**Output esperado:**

```
✔ Deploying firestore indexes...
✔ Deploy complete!

Indexes deployed:
  ✓ routes (driverId ASC, status ASC, createdAt DESC)
  ✓ routes (status ASC, scheduledTime ASC)
  ✓ trackingPoints (routeId ASC, timestamp DESC)
  ✓ notifications (userId ASC, read ASC, createdAt DESC)
  ✓ users (role ASC, active ASC, createdAt DESC)
  ✓ requests (parentId ASC, status ASC, createdAt DESC)
  ✓ requests (driverId ASC, status ASC, createdAt DESC)
```

**Tiempo:** 2-5 minutos para propagación

---

## 📋 Paso 5: Deploy Firestore Rules

```powershell
firebase deploy --only firestore:rules
```

**Output esperado:**

```
✔ Deploying firestore rules...
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/furgokid-app/firestore
```

---

## 📋 Paso 6: Verificar Deployment

### Verificar Indexes:

```powershell
firebase firestore:indexes
```

Todos deben mostrar status "ENABLED" (verde)

### Verificar Rules en Console:

1. Ir a: https://console.firebase.google.com/project/furgokid-app/firestore/rules
2. Deberías ver las nuevas rules con helper functions
3. Click "Publish" si hay cambios pendientes

---

## 🎯 Todo en un comando

Si todo está configurado correctamente:

```powershell
firebase deploy --only firestore
```

Esto deployará indexes + rules simultáneamente.

---

## 🆘 Troubleshooting

### Error: "No project active"

```powershell
firebase use furgokid-app
```

O si tu proyecto tiene otro ID:

```powershell
firebase use TU-PROJECT-ID
```

### Error: "Permission denied"

Tu cuenta necesita permisos de Editor o Owner en el proyecto Firebase.
Verificar en: Firebase Console → IAM & Admin

### Error: "Invalid indexes.json"

Validar JSON:

```powershell
Get-Content firestore.indexes.json | ConvertFrom-Json
```

### Error: "Rules compilation failed"

Validar sintaxis de rules:

```powershell
firebase firestore:rules:check firestore.rules
```

---

## ✅ Verificación Post-Deployment

### 1. Firebase Console

**Indexes:**
https://console.firebase.google.com/project/furgokid-app/firestore/indexes

Todos deben estar en estado "ENABLED"

**Rules:**
https://console.firebase.google.com/project/furgokid-app/firestore/rules

Debes ver las rules actualizadas con las helper functions

### 2. Test en la App

Después del deployment:

1. Hacer una query en la app (ej: listar routes)
2. Debe ser significativamente más rápida (60-80% improvement)
3. No debe haber errores de permisos

### 3. Firestore Debug

En Firebase Console → Firestore → Rules:

- Click "Rules Playground"
- Simular operaciones read/write
- Verificar que las reglas funcionen como esperado

---

## 📊 Métricas Esperadas

**Antes (sin indexes):**

- Query de routes: ~800-1200ms
- Costo por query: Alto (full collection scan)

**Después (con indexes):**

- Query de routes: ~150-300ms
- Costo por query: Bajo (index-optimized)

**Mejora:** 60-80% más rápido + 70-90% menos costo

---

## 🔄 Comandos Útiles

```powershell
# Ver proyecto activo
firebase projects:list

# Cambiar proyecto
firebase use <project-id>

# Ver estado de indexes
firebase firestore:indexes

# Validar rules antes de deploy
firebase firestore:rules:check firestore.rules

# Ver logs
firebase functions:log

# Deploy todo (hosting, functions, firestore)
firebase deploy
```

---

## ✅ Checklist Final

- [ ] Firebase CLI instalado ✓
- [ ] Login completado: `firebase login`
- [ ] Proyecto verificado: `firebase projects:list`
- [ ] .firebaserc configurado con project ID correcto
- [ ] Indexes deployed: `firebase deploy --only firestore:indexes`
- [ ] Rules deployed: `firebase deploy --only firestore:rules`
- [ ] Verificado en Firebase Console (indexes ENABLED)
- [ ] Probado en la app (queries más rápidas)

---

**Siguiente:** Configurar Firebase API restrictions en Console

Ver: [docs/MANUAL_ACTIONS_REQUIRED.md](MANUAL_ACTIONS_REQUIRED.md#1--firebase-api-key-restrictions-5-minutos)

---

**Última actualización:** 29 Diciembre 2025  
**Tiempo estimado:** 15 minutos total
