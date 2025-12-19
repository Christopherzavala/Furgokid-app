# 🔥 Guía de Configuración de Firebase - FurgoKid

## 📋 Pasos para Configurar Firebase

### 1. Crear Proyecto en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Click en "Agregar proyecto" o "Add project"
3. Nombre del proyecto: **FurgoKid** (o el que prefieras)
4. Acepta los términos y condiciones
5. (Opcional) Habilita Google Analytics
6. Click en "Crear proyecto"

---

### 2. Configurar Authentication (Autenticación)

1. En el menú lateral, click en **"Authentication"**
2. Click en **"Get started"** o "Comenzar"
3. En la pestaña **"Sign-in method"**:
   - Click en **"Email/Password"**
   - **Habilita** la opción "Email/Password"
   - **NO** habilites "Email link (passwordless sign-in)" por ahora
   - Click en **"Save"**

---

### 3. Configurar Firestore Database

1. En el menú lateral, click en **"Firestore Database"**
2. Click en **"Create database"**
3. Selecciona modo:
   - **Producción**: Reglas más estrictas (recomendado para lanzamiento)
   - **Prueba**: Reglas permisivas (recomendado para desarrollo)
4. Selecciona ubicación del servidor:
   - **us-central1** (Estados Unidos - Centro)
   - **southamerica-east1** (São Paulo) - Recomendado para LATAM
5. Click en **"Enable"**

#### Reglas de Seguridad Recomendadas (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios solo pueden leer/escribir sus propios datos
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Conductores - solo lectura para usuarios autenticados
    match /drivers/{driverId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    
    // Vehículos - solo lectura para usuarios autenticados
    match /vehicles/{vehicleId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    
    // Ubicaciones GPS - solo lectura para usuarios autenticados
    match /locations/{locationId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.driver == true;
    }
  }
}
```

---

### 4. Configurar Storage (Almacenamiento)

1. En el menú lateral, click en **"Storage"**
2. Click en **"Get started"**
3. Acepta las reglas de seguridad predeterminadas
4. Selecciona la misma ubicación que Firestore
5. Click en **"Done"**

#### Reglas de Seguridad Recomendadas (Storage)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Fotos de perfil de usuarios
    match /users/{userId}/profile/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Fotos de conductores
    match /drivers/{driverId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    
    // Fotos de vehículos
    match /vehicles/{vehicleId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

---

### 5. Obtener Credenciales de Firebase

#### Para Android:

1. En la página principal del proyecto, click en el ícono de **Android** (robot)
2. Registra tu app:
   - **Android package name**: `com.furgokid.app` (o el que uses)
   - **App nickname**: FurgoKid
   - **SHA-1**: (Opcional por ahora, necesario para Google Sign-In)
3. Click en **"Register app"**
4. **Descarga** el archivo `google-services.json`
5. Coloca el archivo en la raíz de tu proyecto: `FurgoKid/google-services.json`
6. Click en **"Next"** hasta terminar

#### Para iOS (si vas a lanzar en iOS):

1. En la página principal del proyecto, click en el ícono de **iOS** (manzana)
2. Registra tu app:
   - **iOS bundle ID**: `com.furgokid.app`
   - **App nickname**: FurgoKid
3. **Descarga** el archivo `GoogleService-Info.plist`
4. Coloca el archivo en la raíz de tu proyecto
5. Click en **"Next"** hasta terminar

#### Para Web (Expo Go y desarrollo):

1. En la página principal del proyecto, click en el ícono de **Web** (</>)
2. Registra tu app:
   - **App nickname**: FurgoKid Web
3. Copia las credenciales que aparecen:

```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

---

### 6. Actualizar Configuración en el Código

Abre el archivo `src/config/firebase.ts` y reemplaza las credenciales:

```typescript
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

**⚠️ IMPORTANTE**: 
- NO subas estas credenciales a GitHub público
- Usa variables de entorno para producción
- Las credenciales actuales son de ejemplo y pueden no funcionar

---

### 7. Variables de Entorno (Recomendado para Producción)

Crea un archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=tu_api_key_aqui
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

Agrega `.env` a tu `.gitignore`:

```
.env
.env.local
.env.production
```

---

### 8. Probar la Configuración

1. Reinicia el servidor de desarrollo:
   ```bash
   npx expo start --clear
   ```

2. Abre la app en Expo Go

3. Intenta crear una cuenta:
   - Email: `test@furgokid.com`
   - Contraseña: `test123`

4. Verifica en Firebase Console > Authentication que el usuario se creó

---

### 9. Estructura de Datos Recomendada (Firestore)

#### Colección: `users`
```javascript
{
  uid: "user123",
  email: "padre@example.com",
  displayName: "Juan Pérez",
  role: "parent", // parent, driver, admin
  children: [
    {
      name: "María Pérez",
      age: 8,
      school: "Colegio ABC",
      vehicleId: "vehicle123"
    }
  ],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Colección: `drivers`
```javascript
{
  driverId: "driver123",
  name: "Carlos González",
  phone: "+56912345678",
  license: "A-1234567",
  vehicleId: "vehicle123",
  photo: "url_to_photo",
  rating: 4.8,
  verified: true,
  createdAt: timestamp
}
```

#### Colección: `vehicles`
```javascript
{
  vehicleId: "vehicle123",
  brand: "Mercedes-Benz",
  model: "Sprinter",
  plate: "ABC-123",
  year: 2022,
  capacity: 20,
  driverId: "driver123",
  currentLocation: {
    latitude: -33.4489,
    longitude: -70.6693,
    timestamp: timestamp
  },
  route: "Ruta A - Colegio ABC",
  active: true
}
```

#### Colección: `locations` (Historial GPS)
```javascript
{
  locationId: "loc123",
  vehicleId: "vehicle123",
  latitude: -33.4489,
  longitude: -70.6693,
  speed: 45,
  heading: 180,
  timestamp: timestamp,
  driverId: "driver123"
}
```

---

### 10. Próximos Pasos

Una vez configurado Firebase:

1. ✅ **Crear usuarios de prueba** en Authentication
2. ✅ **Agregar datos de prueba** en Firestore (conductores, vehículos)
3. ✅ **Probar login/logout** en la app
4. ✅ **Implementar rastreo GPS real** (próxima fase)
5. ✅ **Configurar notificaciones push** (Firebase Cloud Messaging)

---

### 🆘 Solución de Problemas

#### Error: "Firebase App named '[DEFAULT]' already exists"
**Solución**: Reinicia el servidor de desarrollo

#### Error: "auth/invalid-api-key"
**Solución**: Verifica que el API Key sea correcto en `firebase.ts`

#### Error: "auth/network-request-failed"
**Solución**: Verifica tu conexión a internet

#### Error: "Permission denied" en Firestore
**Solución**: Revisa las reglas de seguridad en Firebase Console

---

### 📚 Recursos Adicionales

- [Documentación Firebase](https://firebase.google.com/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [Firebase Storage](https://firebase.google.com/docs/storage)

---

**Última actualización**: 2025-11-25  
**Versión**: 1.0
