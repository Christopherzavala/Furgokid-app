# 🔔 PUSH NOTIFICATIONS SETUP GUIDE

**Proyecto:** FurgoKid  
**Fecha:** Enero 10, 2026  
**Versión:** 1.0.0

---

## 📋 OVERVIEW

Push Notifications son **CRÍTICAS** para re-engagement y conversión:

**Impacto estimado:**

- +60% re-engagement (usuarios vuelven a la app)
- +45% matches exitosos (notificaciones en tiempo real)
- +$8,000 revenue Mes 6 (más sesiones activas = más AdMob)

**Casos de uso:**

**PADRE:**

```
1. "Nuevo conductor disponible en tu zona" (match automático)
2. "Tu solicitud fue vista por 3 conductores"
3. Recordatorio: "¿Encontraste conductor? Actualiza tu búsqueda"
```

**CONDUCTOR:**

```
1. "Nueva solicitud en tu ruta" (match geográfico)
2. "Padre interesado en tu cupo"
3. Recordatorio: "¿Tienes cupos libres? Publícalos ahora"
```

---

## 🛠️ IMPLEMENTACIÓN (3 PASOS)

### **PASO 1: Configurar Firebase Cloud Messaging**

#### 1.1 Enable FCM en Firebase Console

```bash
# 1. Ir a Firebase Console
https://console.firebase.google.com/project/furgokid/settings/cloudmessaging

# 2. Copiar Server Key (Cloud Messaging API)
# Guardar en .env:
FIREBASE_SERVER_KEY=AAAAxxx...
```

#### 1.2 Configurar app.json

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#4ECDC4",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json",
      "useNextNotificationsApi": true
    }
  }
}
```

#### 1.3 Instalar dependencias

```bash
npx expo install expo-notifications expo-device expo-constants
```

---

### **PASO 2: Crear NotificationService**

**Archivo:** `src/services/notificationService.js`

```javascript
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.token = null;
  }

  // Request permissions and get push token
  async registerForPushNotifications(userId) {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions not granted');
        return null;
      }

      // Get push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.token = token;

      // Save token to Firestore user profile
      if (userId) {
        await updateDoc(doc(db, 'users', userId), {
          pushToken: token,
          pushTokenUpdatedAt: new Date(),
        });
      }

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'FurgoKid Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4ECDC4',
        });
      }

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  // Send local notification (for testing)
  async sendLocalNotification(title, body, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // immediate
    });
  }

  // Listen for notification taps
  addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Listen for notifications received while app is foregrounded
  addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
  }
}

export default new NotificationService();
```

---

### **PASO 3: Integrar en AuthContext**

**Archivo:** `src/context/AuthContext.js`

```javascript
// Add import
import notificationService from '../services/notificationService';

// Inside AuthProvider, after user login/signup:
useEffect(() => {
  if (user && user.emailVerified) {
    // Register for push notifications
    notificationService.registerForPushNotifications(user.uid);
  }
}, [user]);
```

---

## 🔥 FIREBASE CLOUD FUNCTIONS (Backend)

### **Función: Notificar matches nuevos**

**Archivo:** `functions/index.js` (crear si no existe)

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Trigger when new request is created (parent)
exports.notifyDriversNewRequest = functions.firestore
  .document('requests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();

    // Find drivers in the same zone
    const driversSnapshot = await admin
      .firestore()
      .collection('users')
      .where('role', '==', 'driver')
      .where('zone', '==', request.zone) // assuming zone field exists
      .get();

    const notifications = [];
    driversSnapshot.forEach((doc) => {
      const driver = doc.data();
      if (driver.pushToken) {
        notifications.push({
          to: driver.pushToken,
          sound: 'default',
          title: '🚌 Nueva solicitud en tu zona',
          body: `${request.parentName} busca transporte para ${request.childrenCount} niños`,
          data: { requestId: snap.id, type: 'new_request' },
        });
      }
    });

    // Send notifications via Expo Push API
    if (notifications.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notifications),
      });
    }

    return null;
  });

// Trigger when new vacancy is created (driver)
exports.notifyParentsNewVacancy = functions.firestore
  .document('vacancies/{vacancyId}')
  .onCreate(async (snap, context) => {
    const vacancy = snap.data();

    // Find parents searching in the same zone
    const parentsSnapshot = await admin
      .firestore()
      .collection('requests')
      .where('zone', '==', vacancy.zone)
      .where('status', '==', 'active')
      .get();

    const notifications = [];
    for (const requestDoc of parentsSnapshot.docs) {
      const request = requestDoc.data();
      const parentDoc = await admin.firestore().collection('users').doc(request.parentId).get();

      const parent = parentDoc.data();
      if (parent.pushToken) {
        notifications.push({
          to: parent.pushToken,
          sound: 'default',
          title: '✅ Nuevo conductor disponible',
          body: `${vacancy.driverName} tiene ${vacancy.seatsAvailable} cupos en tu zona`,
          data: { vacancyId: snap.id, type: 'new_vacancy' },
        });
      }
    }

    if (notifications.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications),
      });
    }

    return null;
  });
```

### **Deploy Cloud Functions:**

```bash
# 1. Install Firebase CLI (si no lo tienes)
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Initialize Functions
firebase init functions

# 4. Select JavaScript
# 5. Install dependencies

# 6. Deploy
firebase deploy --only functions
```

---

## 📱 TESTING

### **Test local notification:**

```javascript
// En cualquier screen:
import notificationService from '../services/notificationService';

// Test button:
<Button
  title="Test Notification"
  onPress={() => {
    notificationService.sendLocalNotification('Test Title', 'Test Body', { data: 'test' });
  }}
/>;
```

### **Test en dispositivo físico:**

```bash
# 1. Build development
npx expo start

# 2. Scan QR en Expo Go app
# 3. Registrar cuenta
# 4. Ver push token en console
# 5. Crear request/vacancy desde otra cuenta
# 6. Verificar notificación llegue
```

---

## 🚀 PRODUCTION SETUP

### **1. Generar Firebase Server Key:**

```bash
# Firebase Console → Project Settings → Cloud Messaging
# Copy "Server Key"
# Save in Firebase Functions config:
firebase functions:config:set fcm.server_key="AAAAxxx..."
```

### **2. Enable FCM API:**

```bash
# Go to:
https://console.cloud.google.com/apis/library/fcm.googleapis.com

# Enable "Firebase Cloud Messaging API"
```

### **3. Test production build:**

```bash
# Build APK
eas build --platform android --profile preview

# Install on device
# Test notifications
```

---

## ⚠️ LIMITACIONES

### **Expo Go (Development):**

```
✅ Local notifications funcionan
❌ Push notifications remotas NO funcionan
→ Requiere build development o production
```

### **iOS (Requiere extra setup):**

```
1. Apple Developer Account ($99/año)
2. APNs certificate
3. Configurar en Firebase Console
```

**Recomendación:** Implementa Android primero, iOS en v1.1

---

## 📊 ANALYTICS TRACKING

**Agregar a notificationService.js:**

```javascript
// Track notification received
addNotificationReceivedListener((notification) => {
  analyticsService.trackEvent('notification_received', {
    title: notification.request.content.title,
    type: notification.request.content.data?.type,
  });
});

// Track notification tapped
addNotificationResponseListener((response) => {
  analyticsService.trackEvent('notification_tapped', {
    title: response.notification.request.content.title,
    type: response.notification.request.content.data?.type,
  });

  // Navigate based on notification type
  const { type, requestId, vacancyId } = response.notification.request.content.data;
  if (type === 'new_request') {
    navigation.navigate('Search', { requestId });
  } else if (type === 'new_vacancy') {
    navigation.navigate('Search', { vacancyId });
  }
});
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

```
[ ] Paso 1: Configurar Firebase Cloud Messaging
    [ ] Enable FCM en Firebase Console
    [ ] Agregar expo-notifications a app.json
    [ ] Instalar dependencias (expo install)

[ ] Paso 2: Crear NotificationService
    [ ] Crear src/services/notificationService.js
    [ ] Implementar registerForPushNotifications()
    [ ] Agregar listeners

[ ] Paso 3: Integrar en AuthContext
    [ ] Import notificationService
    [ ] Register on user login/signup

[ ] Paso 4: Cloud Functions (Backend)
    [ ] Crear functions/index.js
    [ ] Implementar notifyDriversNewRequest
    [ ] Implementar notifyParentsNewVacancy
    [ ] Deploy: firebase deploy --only functions

[ ] Paso 5: Testing
    [ ] Test local notifications
    [ ] Test en dispositivo físico
    [ ] Verificar pushToken se guarda en Firestore
    [ ] Crear request/vacancy y verificar notificación

[ ] Paso 6: Production
    [ ] Generar Firebase Server Key
    [ ] Enable FCM API en Google Cloud
    [ ] Build production APK
    [ ] Test en production
```

---

## 🎯 PRIORIDAD

**Implementación:**

- Prioridad: **MUY ALTA**
- Tiempo estimado: **1-2 semanas**
- Impacto: +60% re-engagement, +$8,000 revenue Mes 6

**Recomendación:**

```
✅ Implementar después de Email Verification
✅ Antes de lanzamiento v1.0 si es posible
⚠️ Si no, lanzar v1.0 sin push, agregar en v1.1 (1 semana post-launch)
```

**Razón:**

- Email Verification es BLOQUEADOR (Play Store rechaza sin esto)
- Push Notifications mejora UX pero NO es bloqueador
- Mejor lanzar v1.0 rápido, agregar push en v1.1

---

## 📞 SOPORTE

**Documentación oficial:**

- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging
- Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/

**Testing tools:**

- Expo Push Tool: https://expo.dev/notifications
- Firebase Console: https://console.firebase.google.com/project/furgokid/notification

---

**NEXT STEP:** ¿Implemento NotificationService ahora o continuamos con Onboarding primero?
