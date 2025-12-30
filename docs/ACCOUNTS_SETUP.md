# Cuentas Necesarias - Setup Completo

## 📋 Cuentas Requeridas (por Prioridad)

### 🔴 CRÍTICAS - Necesarias para producción

#### 1. **Expo Account** (EAS Build & Submit)

- **URL**: https://expo.dev
- **Costo**: Gratis (plan hobby) o $29/mes (production)
- **Qué incluye**:
  - EAS Build (15 builds/mes gratis)
  - EAS Submit para stores
  - EAS Secrets management
  - Updates OTA
- **Setup**:
  ```bash
  eas login
  eas whoami  # Verificar sesión
  ```

#### 2. **Google Play Console** (Android Store)

- **URL**: https://play.google.com/console
- **Costo**: $25 USD (pago único)
- **Qué incluye**:
  - Publicación en Play Store
  - Analytics de instalaciones
  - Revenue tracking (AdMob/IAP)
  - Testing tracks (internal, alpha, beta)
- **Requisitos**:
  - Cuenta Google
  - Tarjeta de crédito para pago
  - Dirección física verificada

#### 3. **Apple Developer Program** (iOS Store)

- **URL**: https://developer.apple.com
- **Costo**: $99 USD/año
- **Qué incluye**:
  - Publicación en App Store
  - TestFlight para beta testing
  - Push notifications certificates
  - App signing certificates
- **Requisitos**:
  - Apple ID
  - Tarjeta de crédito
  - Verificación de identidad (puede tardar 48hrs)

#### 4. **Firebase Console** (Backend/Auth)

- **URL**: https://console.firebase.google.com
- **Costo**: Gratis (Spark plan) hasta ciertos límites
  - Auth: 50K MAU gratis
  - Firestore: 50K lecturas/día
  - Storage: 5GB
- **Qué incluye**:
  - Authentication (email, Google, etc)
  - Firestore database
  - Cloud Storage
  - Cloud Messaging (push)
  - Remote Config
  - Analytics (cuando SDK 55 esté listo)
- **Ya configurado**: ✅ (según tus archivos)

#### 5. **Google AdMob** (Monetización)

- **URL**: https://apps.admob.com
- **Costo**: Gratis
- **Revenue**: Google toma 32%, tú recibes 68%
- **Qué incluye**:
  - Banner ads
  - Interstitial ads
  - Rewarded ads
  - Mediation platform
- **Requisitos**:
  - Cuenta Google
  - Tax information (W-8BEN o W-9)
  - Payment method (para recibir pagos)
- **Ya configurado**: ⚠️ Usando TEST IDs (cambiar antes de producción)

---

### 🟡 IMPORTANTES - Recomendadas para producción

#### 6. **Sentry** (Error Tracking)

- **URL**: https://sentry.io
- **Costo**:
  - Gratis: 5K eventos/mes
  - Developer: $26/mes (50K eventos)
  - Team: $80/mes (100K eventos)
- **Qué incluye**:
  - Crash reporting
  - Error tracking
  - Performance monitoring
  - Release tracking
  - Alertas por email/Slack
- **Setup**: Ver [docs/SENTRY_SETUP.md](../SENTRY_SETUP.md)

#### 7. **Google Cloud Platform** (Maps API, Backend)

- **URL**: https://console.cloud.google.com
- **Costo**:
  - Maps: $200 crédito gratis/mes
  - Después: ~$0.005 por request
- **Qué incluye**:
  - Google Maps SDK
  - Geocoding API
  - Places API
  - Cloud Functions (opcional para backend)
- **Ya configurado**: ✅ (tienes GOOGLE_MAPS_API_KEY)

---

### 🟢 OPCIONALES - Para futuras fases

#### 8. **Stripe** (Pagos Premium/Subscriptions)

- **URL**: https://stripe.com
- **Costo**: 2.9% + $0.30 por transacción
- **Cuándo**: Fase 7 (monetización premium)
- **Alternativa**: RevenueCat (IAP simplificado)

#### 9. **RevenueCat** (In-App Purchases Management)

- **URL**: https://www.revenuecat.com
- **Costo**:
  - Gratis: hasta $10K MTR (Monthly Tracked Revenue)
  - Grow: 1% de MTR después
- **Qué incluye**:
  - Gestión de IAP/subscriptions
  - Server-side receipt validation
  - Analytics de subscriptions
  - Webhooks
- **Cuándo**: Fase 7 (cuando implementes premium)

#### 10. **GitHub** (CI/CD, Issues)

- **URL**: https://github.com
- **Costo**: Gratis para repos públicos/privados básicos
- **Ya configurado**: ✅ (tienes workflows en .github/)

#### 11. **Codecov** (Coverage Reporting)

- **URL**: https://codecov.io
- **Costo**: Gratis para open source
- **Ya configurado**: ⚠️ Referenciado en CI pero sin token

---

## 🛠️ Checklist de Setup por Cuenta

### Google Play Console

- [ ] Crear cuenta ($25 USD)
- [ ] Verificar identidad
- [ ] Completar perfil de desarrollador
- [ ] Crear aplicación ("FurgoKid")
- [ ] Configurar data safety declarations
- [ ] Completar content rating questionnaire
- [ ] Subir privacy policy
- [ ] Configurar pricing (gratis)
- [ ] Setup de internal testing track

### Apple Developer

- [ ] Crear cuenta ($99 USD/año)
- [ ] Verificar identidad (48hrs)
- [ ] Aceptar términos y condiciones
- [ ] Setup de certificates (EAS lo hace automático)
- [ ] Crear App ID en App Store Connect
- [ ] Configurar App privacy details
- [ ] Setup de TestFlight

### Firebase

- [ ] ✅ Proyecto creado
- [ ] ✅ Authentication configurado
- [ ] ✅ Firestore configurado
- [ ] Verificar quotas/limits
- [ ] Configurar billing (si superas free tier)
- [ ] Setup de Cloud Messaging (push)
- [ ] Remote Config (para toggles)

### AdMob

- [ ] Crear cuenta
- [ ] Registrar app Android/iOS
- [ ] Crear ad units:
  - [ ] Banner (home screen)
  - [ ] Interstitial (después de acciones)
  - [ ] Rewarded (opcional - features premium)
- [ ] Cambiar TEST IDs a production IDs en código
- [ ] Completar tax information
- [ ] Configurar payment method

### Sentry

- [ ] Crear cuenta
- [ ] Crear proyecto "FurgoKid" (React Native)
- [ ] Obtener DSN
- [ ] Configurar en EAS Secrets:
  ```bash
  eas secret:create --scope project --name SENTRY_DSN --value "https://..."
  ```
- [ ] Instalar package:
  ```bash
  npm install @sentry/react-native
  ```
- [ ] Configurar alertas (crash rate, errors)

### Google Cloud Platform

- [ ] ✅ API Key creado (GOOGLE_MAPS_API_KEY)
- [ ] Verificar restricciones:
  - [ ] Android app restriction (package name)
  - [ ] iOS app restriction (bundle ID)
- [ ] Habilitar APIs necesarias:
  - [ ] Maps SDK for Android
  - [ ] Maps SDK for iOS
  - [ ] Geocoding API (si usas)
- [ ] Setup de billing alert (para no exceder budget)

---

## 💰 Costos Totales Estimados

### Año 1

| Cuenta              | Costo    | Frecuencia       |
| ------------------- | -------- | ---------------- |
| Google Play Console | $25      | Una vez          |
| Apple Developer     | $99      | Anual            |
| Expo (Hobby)        | $0       | Gratis           |
| Firebase (Spark)    | $0       | Gratis\*         |
| AdMob               | $0       | Gratis (revenue) |
| Sentry (Free)       | $0       | Gratis\*         |
| Google Maps         | $0       | Gratis\*         |
| **TOTAL**           | **$124** | **Primer año**   |

\*Gratis dentro de limits; puede tener costos si superas free tier.

### Año 2+

- Apple Developer: $99/año
- Posibles upgrades: Expo Production ($348/año), Sentry Developer ($312/año)

---

## 🎯 Prioridades ANTES del Testing

### 1️⃣ Inmediato (Esta Semana)

- [ ] Crear cuenta Expo (si no tienes)
- [ ] Crear cuenta Google Play Console ($25)
- [ ] Crear cuenta Sentry (gratis)
- [ ] Configurar AdMob production IDs
- [ ] Migrar todos los secrets a EAS

### 2️⃣ Corto Plazo (Próxima Semana)

- [ ] Crear cuenta Apple Developer ($99) - si vas a lanzar en iOS
- [ ] Verificar Firebase quotas
- [ ] Configurar Google Maps API restrictions
- [ ] Preparar assets (icons, screenshots)
- [ ] Escribir/publicar Privacy Policy

### 3️⃣ Durante Testing

- [ ] Setup internal testing track (Play Console)
- [ ] Configurar TestFlight (Apple)
- [ ] Configurar Sentry alerts
- [ ] Monitorear AdMob fill rate

---

## 📞 Contactos de Soporte

| Servicio    | Soporte                                                 |
| ----------- | ------------------------------------------------------- |
| Expo        | https://expo.dev/support                                |
| Google Play | https://support.google.com/googleplay/android-developer |
| Apple       | https://developer.apple.com/contact/                    |
| Firebase    | https://firebase.google.com/support                     |
| Sentry      | https://sentry.io/support/                              |

---

## ⚠️ Notas Importantes

1. **Apple Developer**: Verificación puede tardar 48hrs - hacerlo ANTES de necesitarlo
2. **Google Play**: Primer app puede tardar hasta 7 días en revisión
3. **AdMob**: Cambiar a production IDs solo DESPUÉS de tener app publicada
4. **Tax Info**: AdMob y Apple requieren información fiscal para pagos
5. **Privacy Policy**: Requerida por ambas stores - debe estar pública ANTES de submit

---

**Última actualización**: 2025-12-29  
**Siguiente paso**: Crear cuentas críticas y configurar secrets
