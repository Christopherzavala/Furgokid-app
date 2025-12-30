# FurgoKid - App de Tracking de Transporte Escolar

[![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-blue.svg)](https://expo.dev/)
[![React Native 0.81.5](https://img.shields.io/badge/React%20Native-0.81.5-green.svg)](https://reactnative.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12.6.0-orange.svg)](https://firebase.google.com/)

> [!IMPORTANT] > **Proyecto en fase de desarrollo.** Antes de deployment a producción, sigue las guías de **Seguridad** y **Monetización** en `/docs`.
>
> **Índice de documentación (centralizado):** `docs/root-info/INDEX.md`

---

## 🚀 Quick Start

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Firebase/AdMob

# 3. Iniciar servidor de desarrollo
npm start

# 4. Ejecutar auditoría de seguridad (opcional pero recomendado)
npm run security:audit
```

---

## 📁 Estructura del Proyecto

```
furgokid/
├── src/                          # Código fuente
│   ├── components/               # Componentes React reutilizables
│   ├── screens/                  # Pantallas de la app
│   ├── navigation/               # Configuración de navegación
│   ├── config/                   # Configuración (Firebase, constants)
│   └── services/                 # Lógica de negocio y APIs
├── assets/                       # Imágenes, fuentes, etc
├── docs/                         # 📚 Documentación técnica
│   ├── ADMOB_SETUP_GUIDE.md     # Guía completa de monetización
│   └── EAS_SECRETS_MIGRATION.md # Migración de secrets a EAS
├── scripts/                      # Scripts de automatización
│   ├── security-audit.ps1       # Auditoría de seguridad
│   └── migrate-to-eas.ps1       # Migración automatizada a EAS
├── .husky/                       # Git hooks (pre-commit validation)
├── app.config.js                 # Configuración de Expo
├── package.json                  # Dependencias y scripts
└── README.md                     # Este archivo
```

---

## 🛠️ Scripts NPM Disponibles

| Script                     | Descripción            | Cuándo usarlo                            |
| -------------------------- | ---------------------- | ---------------------------------------- |
| `npm start`                | Inicia servidor Expo   | Desarrollo local                         |
| `npm run android`          | Build Android nativo   | Testing en emulador/device               |
| `npm run test:coverage`    | Tests con cobertura    | Antes de commits importantes             |
| `npm run smoke:test`       | Smoke tests post-build | **Después de cada build**                |
| `npm run security:audit`   | Auditoría de seguridad | **Antes de cada commit importante**      |
| `npm run validate:config`  | Valida `app.config.js` | Después de editar configuración          |
| `npm run eas:migrate`      | Migra secrets a EAS    | **Antes del primer deploy a producción** |
| `npm run build:production` | Build producción (EAS) | Para submit a stores                     |

---

## 🔐 Seguridad y Best Practices

### ⚠️ CRÍTICO: Antes de Deployment

1. **Ejecutar auditoría:**

   ```bash
   npm run security:audit
   ```

2. **Migrar secrets a EAS:**

   ```bash
   # Login a Expo
   eas login

   # Migrar secrets (producción)
   npm run eas:migrate
   ```

3. **Verificar .gitignore:**

   - ✅ `.env` debe estar en `.gitignore`
   - ✅ No debe haber secrets en historial de Git
   - ✅ Firebase keys con restricciones de app configuradas

4. **Rotar keys si hubo leak:**
   - [Ver guía completa](docs/EAS_SECRETS_MIGRATION.md#paso-7-rotar-secrets-si-hubo-leak)

### Pre-commit Hooks (Automático)

El proyecto tiene Git hooks configurados que validan:

- ✅ Sintaxis de `app.config.js`
- ✅ No se commitee `.env`
- ✅ No hay API keys hardcodeadas

---

## 💰 Monetización con AdMob

**Estado actual:** 🚨 **USANDO TEST IDs** → $0 revenue

### Quick Setup

1. **Crear cuenta AdMob:**

   - Ir a [admob.google.com](https://admob.google.com)
   - Registrar app Android/iOS
   - Crear ad units (Banner, Interstitial, Rewarded)

2. **Actualizar `.env`:**

   ```bash
   ADMOB_ANDROID_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
   ADMOB_IOS_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
   ```

3. **Testing en Development Build:**
   ```bash
   eas build --profile development --platform android --local
   ```

📖 **[Guía completa de AdMob](docs/ADMOB_SETUP_GUIDE.md)** con benchmarks y proyecciones de revenue.

---

## 🏗️ Arquitectura Técnica

### Stack Principal

- **Frontend:** React Native 0.81.5 + Expo SDK 54
- **Backend/Auth:** Firebase Authentication & Firestore
- **Maps:** React Native Maps + Google Maps API
- **Monetización:** AdMob (react-native-google-mobile-ads)
- **State Management:** React Context API
- **Navigation:** React Navigation 6

### Features Implementados

- ✅ Autenticación con Firebase (Email/Password)
- ✅ Tracking en tiempo real de ubicación GPS
- ✅ Mapa con marcadores de rutas
- ✅ Notificaciones push (expo-notifications)
- ✅ Background location tracking (expo-task-manager)
- ✅ AdMob integration (banners, interstitials)
- ✅ Error tracking con Sentry (production-ready)
- ✅ Remote config para feature flags
- ✅ Smoke tests automatizados
- ✅ Perfiles EAS production/preview

---

## 📊 Roadmap de Desarrollo

> Criterios detallados: [docs/roadmap-criteria.md](docs/roadmap-criteria.md)

### ✅ Fase 1: MVP y Estabilización (Completado)

- Reparación de errores críticos de configuración
- Setup de entorno de desarrollo
- Validación de dependencias

### ✅ Fase 2: Automatización (Completado)

- Pre-commit hooks con validación de configs
- Scripts de automatización (auditoría, migración)
- Documentación técnica completa

### ✅ Fase 3: Hardening de Seguridad (Completado)

- Auditoría de secrets
- Guía de migración a EAS Secrets
- Validación automática en CI

### 🔄 Fase 4: Monetización (En Progreso)

- [x] Guía de setup de AdMob
- [x] Documentación de ad units
- [ ] Testing de ads en producción
- [ ] Optimización de eCPM

### 🚀 Fase 5: Production Release (Próximo)

- [ ] Build de producción con EAS
- [ ] Submit a Google Play Store
- [ ] Submit a Apple App Store
- [ ] Configuración de Firebase Analytics (cuando Expo SDK 55 sea estable)
- [ ] Integración de Sentry para crash/error reporting

### 📈 Fase 6: Optimización y Escalabilidad

- [ ] A/B testing de frecuencia de ads
- [ ] Implementación de mediation (AppLovin, Meta)
- [ ] Optimización de performance (reduce bundle size)
- [ ] Implementación de features premium (rewarded ads)

### 🧭 Fase 7: Integraciones y QA End-to-End

- [ ] Integración backend (API segura para datos de usuario y rutas)
- [ ] Monetización premium con Stripe/IAP
- [ ] E2E automatizado con Detox
- [ ] Activar Firebase Analytics en cuanto sea compatible

---

## 🧪 Testing

### Development Build

```bash
# Android
eas build --profile development --platform android --local

# iOS (requiere Mac)
eas build --profile development --platform ios --local
```

### Testing de Ads

> [!WARNING]
> Los ads **NO funcionan en Expo Go**. Debes usar Development Build.

1. Instalar development build en dispositivo
2. Iniciar app y verificar que banners se muestren
3. Validar que interstitials aparezcan después de acciones
4. Verificar en AdMob Console (esperar 24-48 hrs para metrics)

---

## 📚 Documentación Adicional

| Archivo                                                             | Descripción                                      |
| ------------------------------------------------------------------- | ------------------------------------------------ |
| [ADMOB_SETUP_GUIDE.md](docs/ADMOB_SETUP_GUIDE.md)                   | Guía completa de monetización con benchmarks     |
| [SENTRY_SETUP.md](docs/SENTRY_SETUP.md)                             | Error tracking y performance monitoring          |
| [STORE_SUBMISSION_CHECKLIST.md](docs/STORE_SUBMISSION_CHECKLIST.md) | Checklist para Google Play y App Store           |
| [roadmap-criteria.md](docs/roadmap-criteria.md)                     | Criterios de aceptación y KPIs por fase          |
| [EAS_SECRETS_MIGRATION.md](docs/EAS_SECRETS_MIGRATION.md)           | Migración de secrets con security best practices |

---

## 🐛 Troubleshooting Común

### "expo-task-manager version not found"

**Solución:**

```bash
npm uninstall expo-task-manager
npx expo install expo-task-manager
```

### "Ad failed to load: ERROR_CODE_NO_FILL"

**Causa:** AdMob aún no tiene ads para tu app nueva.  
**Solución:** Esperar 24-48 horas después de crear la cuenta.

### Pre-commit hook falla

**Solución:**

```bash
# Verificar sintaxis de app.config.js
npm run validate:config

# Si falla, revisar errores de sintaxis (comas, llaves)
```

---

## 🤝 Contribución

Este proyecto sigue las siguientes convenciones:

- **Commits:** Conventional Commits (feat:, fix:, docs:, etc)
- **Branches:** feature/_, bugfix/_, hotfix/\*
- **Code Style:** Prettier + ESLint (ejecutar automáticamente en pre-commit)

---

## 📄 Licencia

Privado - Todos los derechos reservados.

---

## 📞 Soporte

Para problemas técnicos o preguntas:

1. Revisar [Troubleshooting](#-troubleshooting-común)
2. Ejecutar `npm run security:audit` para diagnóstico
3. Consultar documentación en `/docs`

---

**Última actualización:** 2025-12-19  
**Versión:** 1.0.0  
**Autor:** CTO/Senior Architect
