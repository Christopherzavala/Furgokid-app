# 🧪 Firebase Emulators - Testing Local

Este script inicia Firebase Emulators con datos de prueba pre-cargados.

## 🚀 Quick Start

```powershell
# Iniciar emulators con seed
.\scripts\start-emulators.ps1

# O manual
firebase emulators:start
node scripts/seed-emulators.js
```

## 📋 Emulators Disponibles

| Emulator     | Port | URL                   |
| ------------ | ---- | --------------------- |
| Firestore    | 8080 | http://localhost:8080 |
| Auth         | 9099 | http://localhost:9099 |
| Functions    | 5001 | http://localhost:5001 |
| UI Dashboard | 4000 | http://localhost:4000 |

## 👥 Test Credentials

**Parents:**

- `maria.garcia@example.com` / `password123`
- `juan.martinez@example.com` / `password123`

**Drivers:**

- `carlos.rodriguez@example.com` / `password123`
- `ana.lopez@example.com` / `password123`

## 📊 Datos Pre-cargados

- ✅ 4 usuarios (2 parents, 2 drivers)
- ✅ 3 requests activos
- ✅ 3 vacancies activas
- ✅ Push tokens configurados
- ✅ Datos realistas (zonas, escuelas, etc.)

## 🔧 Configuración

**firebase.json:**

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

## 🧪 Testing con Emulators

### **1. Test Cloud Functions Localmente**

```javascript
// En app, conectar a emulators
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';

// Solo en desarrollo
if (__DEV__) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### **2. Test onCreate Triggers**

```powershell
# 1. Start emulators
firebase emulators:start

# 2. Seed data
node scripts/seed-emulators.js

# 3. En otra terminal, crear request
curl http://localhost:8080/v1/projects/furgokid/databases/(default)/documents/requests \
  -X POST \
  -d '{"fields":{"parentId":{"stringValue":"parent-001"},...}}'

# 4. Ver logs en terminal de emulators
# Expected: "🚨 NEW REQUEST: ..."
```

### **3. Test Push Notifications**

```powershell
# Test HTTP endpoint
curl -X POST http://localhost:5001/furgokid/us-central1/testNotification \
  -H "Content-Type: application/json" \
  -d '{"pushToken":"ExponentPushToken[test]","message":"Test from emulator"}'
```

## 📂 Export/Import Data

### **Export (Backup)**

```powershell
# Export current state
firebase emulators:export ./emulator-data

# Incluye: Firestore, Auth, Storage
```

### **Import (Restore)**

```powershell
# Start with exported data
firebase emulators:start --import=./emulator-data

# Auto-export on shutdown
firebase emulators:start --import=./emulator-data --export-on-exit
```

## 🔍 Debugging

### **Firestore UI**

- http://localhost:4000/firestore
- Ver/editar documentos en tiempo real

### **Auth UI**

- http://localhost:4000/auth
- Ver usuarios creados

### **Functions Logs**

- http://localhost:4000/logs
- Ver ejecución de Cloud Functions

### **Function Shell**

```powershell
# Interactive shell
firebase functions:shell

# Test function
firebase > notifyDriversNewRequest({ parentName: 'Test' })
```

## 🐛 Troubleshooting

**Error: "Address already in use"**

```powershell
# Matar procesos en puertos
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process
Get-Process -Id (Get-NetTCPConnection -LocalPort 9099).OwningProcess | Stop-Process
```

**Error: "Cannot connect to emulator"**

```powershell
# Verificar emulators corriendo
curl http://localhost:4000

# Reiniciar
firebase emulators:start
```

**Seed script falla**

```powershell
# Verificar emulators iniciados primero
firebase emulators:start

# En otra terminal
node scripts/seed-emulators.js
```

## 📚 Referencias

- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Test Cloud Functions](https://firebase.google.com/docs/functions/local-emulator)
- [Seed Test Data](https://firebase.google.com/docs/emulator-suite/install_and_configure#seed_data)
