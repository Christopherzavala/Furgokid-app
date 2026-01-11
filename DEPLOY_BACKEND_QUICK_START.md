# 🚀 DEPLOY BACKEND - Quick Start Guide

**Time Required:** 10 minutes  
**Status:** Ready to deploy  
**Cost:** $0.00/month (Free tier)

---

## ✅ Prerequisites Check

Antes de deployar, verifica:

```powershell
# 1. Firebase CLI instalado
firebase --version
# Expected: 13.0.0 or higher

# 2. Autenticado
firebase login
# Expected: "Already logged in as ..."

# 3. Proyecto correcto
firebase use
# Expected: "Active Project: furgokid (furgokid)"
```

---

## 🚀 Deploy en 5 Pasos

### **Paso 1: Instalar Dependencies**

```powershell
cd functions
npm install
```

**Expected output:**

```
added 180 packages in 15s
✓ All dependencies installed
```

**Time:** ~30 segundos

---

### **Paso 2: Lint Code (Opcional)**

```powershell
npm run lint
```

**Expected:** No errors (o warnings menores que puedes ignorar)

**Time:** ~5 segundos

---

### **Paso 3: Deploy Functions**

```powershell
# Volver a raíz del proyecto
cd ..

# Deploy
firebase deploy --only functions
```

**Expected output:**

```
=== Deploying to 'furgokid'...

i  deploying functions
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i  functions: ensuring required API cloudbuild.googleapis.com is enabled...
✔  functions: required API cloudfunctions.googleapis.com is enabled
✔  functions: required API cloudbuild.googleapis.com is enabled
i  functions: preparing codebase default for deployment
i  functions: creating Node.js 18 function notifyDriversNewRequest(us-central1)...
i  functions: creating Node.js 18 function notifyParentsNewVacancy(us-central1)...
i  functions: creating Node.js 18 function sendWelcomeEmail(us-central1)...
i  functions: creating Node.js 18 function testNotification(us-central1)...
✔  functions[notifyDriversNewRequest(us-central1)]: Successful create operation.
✔  functions[notifyParentsNewVacancy(us-central1)]: Successful create operation.
✔  functions[sendWelcomeEmail(us-central1)]: Successful create operation.
✔  functions[testNotification(us-central1)]: Successful create operation.
i  functions: cleaning up build files...

✔  Deploy complete!
```

**Time:** ~2-3 minutos

---

### **Paso 4: Verificar Deployment**

```powershell
# Lista functions deployadas
firebase functions:list
```

**Expected output:**

```
┌────────────────────────────┬──────────────┬───────────────────────────────────┐
│ Function                   │ Region       │ Trigger                           │
├────────────────────────────┼──────────────┼───────────────────────────────────┤
│ notifyDriversNewRequest    │ us-central1  │ firestore.requests/{requestId}    │
│ notifyParentsNewVacancy    │ us-central1  │ firestore.vacancies/{vacancyId}   │
│ sendWelcomeEmail           │ us-central1  │ firestore.users/{userId}          │
│ testNotification           │ us-central1  │ https                             │
└────────────────────────────┴──────────────┴───────────────────────────────────┘
```

**Time:** ~5 segundos

---

### **Paso 5: Update Firestore Rules**

**Agregar a** `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ... tus reglas existentes ...

    // NEW: Notification logs (solo lectura usuarios, escritura Functions)
    match /notification_logs/{logId} {
      allow read: if request.auth != null;
      allow write: if false;  // Solo Functions pueden escribir
    }

    match /notification_errors/{errorId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

**Deploy rules:**

```powershell
firebase deploy --only firestore:rules
```

**Expected:**

```
✔  firestore: released rules firestore.rules to cloud.firestore
```

**Time:** ~10 segundos

---

## ✅ Testing Post-Deploy

### **Test 1: Verificar Logs**

```powershell
# Ver logs en tiempo real
firebase functions:log --only notifyDriversNewRequest
```

Dejar corriendo y en otra terminal/app...

### **Test 2: Crear Request en App**

1. Abre app en emulador
2. Login como parent
3. Crea una solicitud de transporte
4. **Espera 5 segundos**
5. Revisa terminal → Deberías ver:

```
🚨 NEW REQUEST: abc123 | Parent: Test User | Zone: Norte
   Found 2 drivers in Norte
   Prepared 1 notifications
   ✅ Notifications sent in 234ms
```

### **Test 3: Verificar Push Recibido**

1. Asegúrate de tener otro device/emulador con:

   - Usuario driver logueado
   - Misma zona que el request
   - Push token registrado

2. Deberías recibir notificación:
   ```
   🚌 Nueva solicitud en tu zona
   Test User busca transporte para 2 niños en Norte
   ```

### **Test 4: Check Firestore Logs**

Firebase Console → Firestore → Collections → `notification_logs`

Deberías ver documento nuevo:

```json
{
  "type": "new_request",
  "requestId": "abc123",
  "driversNotified": 1,
  "success": true,
  "duration": 234,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## 🐛 Troubleshooting

### **Error: "firebase: command not found"**

```powershell
npm install -g firebase-tools
```

### **Error: "Not authorized to perform this action"**

```powershell
firebase logout
firebase login
```

### **Error: "Functions not found after deploy"**

```powershell
# Re-deploy con --force
firebase deploy --only functions --force
```

### **Error: "Push notification not received"**

Verificar:

1. User tiene pushToken en Firestore:

   ```
   Firestore → users → {userId} → pushToken: "ExponentPushToken[...]"
   ```

2. Zone matches:

   ```
   Request zone: "Norte"
   Driver zone: "Norte"  ← Deben ser idénticas
   ```

3. Test con HTTP endpoint:
   ```powershell
   curl -X POST https://us-central1-furgokid.cloudfunctions.net/testNotification \
     -H "Content-Type: application/json" \
     -d '{"pushToken":"ExponentPushToken[xxx]","message":"Test"}'
   ```

---

## 📊 Monitoring Dashboard

### **Firebase Console Links**

1. **Functions Dashboard:**
   https://console.firebase.google.com/project/furgokid/functions

2. **Logs Viewer:**
   https://console.firebase.google.com/project/furgokid/functions/logs

3. **Firestore Data:**
   https://console.firebase.google.com/project/furgokid/firestore/data

4. **Usage & Billing:**
   https://console.firebase.google.com/project/furgokid/usage

### **KPIs to Watch**

| Metric          | Target | Alert If |
| --------------- | ------ | -------- |
| Invocations/day | <100   | >1000    |
| Errors/day      | <5     | >20      |
| Avg duration    | <1s    | >3s      |
| Cost/month      | $0.00  | >$1.00   |

---

## 💰 Cost Expectations

**Free Tier Limits:**

- 2M invocations/month ✅
- 400K GB-sec compute ✅
- 5GB egress ✅

**FurgoKid Usage (first month):**

- ~3,000 invocations (100/day)
- ~1,500 GB-sec compute
- ~3MB egress

**Expected Cost:** **$0.00** (100% within free tier)

---

## 🎯 Post-Deploy Checklist

- [ ] `firebase deploy --only functions` ejecutado sin errores
- [ ] `firebase functions:list` muestra 4 functions
- [ ] Firestore rules actualizadas y deployadas
- [ ] Test request creado → Push recibido
- [ ] Test vacancy creado → Push recibido
- [ ] Firebase Console logs muestran triggers ejecutándose
- [ ] `notification_logs` collection tiene entradas
- [ ] No errors en `notification_errors` collection

---

## 🚀 Next Steps

Una vez deployado el backend:

1. **Test E2E en device físico** (60 min)

   - Install APK en Android device
   - Test email verification
   - Test push notifications
   - Test onboarding

2. **Optimizar Assets** (15 min)

   - TinyPNG compress images
   - Reduce bundle size

3. **Screenshots** (90 min) ⚠️ BLOQUEADOR

   - Capturar desde emulador
   - Minimum 2 screenshots required

4. **Feature Graphic** (30 min) ⚠️ BLOQUEADOR

   - Canva template 1024x500px
   - Export PNG

5. **Play Console Upload** (30 min)
   - AAB build
   - Submit for review

---

## 📞 Support

**Si algo falla:**

1. Check logs: `firebase functions:log`
2. Check errors: Firestore → `notification_errors`
3. Re-deploy: `firebase deploy --only functions --force`
4. Rollback: `firebase functions:delete <function-name> --force`

**Rollback Impact:** Zero (app works without push notifications)

---

**Status:** ✅ Backend listo para deploy  
**Estimated Time:** 10 minutos  
**Risk:** BAJO (graceful degradation garantizada)

🚀 **¡Adelante con el deploy!**
