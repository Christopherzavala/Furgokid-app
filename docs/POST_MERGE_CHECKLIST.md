# ✅ Post-Merge Checklist (Producción)

**Objetivo:** dejar el proyecto listo para release real sin sorpresas (keys restringidas, App Check, budgets, Sentry, stores).

> Nota: este checklist complementa (no reemplaza) [docs/MANUAL_ACTIONS_REQUIRED.md](MANUAL_ACTIONS_REQUIRED.md) y [docs/PRE_LAUNCH_CHECKLIST.md](PRE_LAUNCH_CHECKLIST.md).

---

## 0) Identificadores y archivos Firebase (P0)

- **Android package:** `com.furgokid.app`
- **iOS bundle id:** `com.furgokid.app`

Acción:

1. En Firebase Console → Project Settings → Your apps:
   - Verifica que exista una app Android para `com.furgokid.app`.
   - Si NO existe (o existía con un package inválido), crea la app Android con `com.furgokid.app`.
2. Descarga el `google-services.json` nuevo y reemplaza el del repo.

Por qué:

- Android **no soporta** `applicationId` con mayúsculas; si no coincide, el build nativo falla o Firebase no inicializa.

---

## 1) Restringir API Keys (P0)

1. Firebase Web API Key

- Sigue [docs/SECURITY_ACTIONS_REQUIRED.md](SECURITY_ACTIONS_REQUIRED.md).
- Restricciones mínimas:
  - Android apps: `com.furgokid.app` + SHA-1
  - iOS apps: `com.furgokid.app`
  - (si aplica web) dominios autorizados

2. Google Maps API Key

- Restringir por **Android package + SHA-1** y por APIs permitidas.

---

## 2) Activar Firebase App Check (P0)

- Recomendación: habilitar App Check en **Firestore + Storage** (y Functions si aplica).
- Android: Play Integrity
- iOS: App Attest / DeviceCheck

Checklist:

- [ ] App Check habilitado
- [ ] Modo “monitoring” primero
- [ ] Luego “enforce” cuando confirmes tráfico válido

---

## 3) Budget alerts / costos (P0/P1)

- Configura límites y alertas siguiendo [docs/FIREBASE_BUDGET_ALERTS.md](FIREBASE_BUDGET_ALERTS.md).

Mínimo:

- [ ] Presupuesto mensual
- [ ] Alertas al 50% / 90% / 100%

---

## 4) Sentry listo para producción (P1)

- Sigue [docs/SENTRY_SETUP.md](SENTRY_SETUP.md).

Mínimo:

- [ ] `SENTRY_DSN` configurado (secrets de GitHub + EAS)
- [ ] `SENTRY_ENABLED=true` sólo en production
- [ ] Alertas: Crash-free sessions / spike de errores

---

## 5) AdMob listo para producción (P1)

En [app.config.js](../app.config.js) los App IDs de AdMob salen de env:

- `ADMOB_ANDROID_APP_ID`
- `ADMOB_IOS_APP_ID`

Checklist:

- [ ] Confirmar que NO se usen IDs de test en builds de producción
- [ ] `EXPO_PUBLIC_ADS_MODE=production` (si lo usas como flag)
- [ ] Validar consentimiento antes de ads/personalización (ya implementado)

---

## 6) Secrets en GitHub Actions / EAS (P1)

GitHub → Settings → Secrets and variables → Actions:

- [ ] `EXPO_PUBLIC_FIREBASE_*`
- [ ] `ADMOB_ANDROID_APP_ID`, `ADMOB_IOS_APP_ID`
- [ ] `GOOGLE_MAPS_API_KEY`
- [ ] `SENTRY_DSN`, `SENTRY_ENABLED`

Nota:

- El workflow valida env sólo en `push` a `main` (para no romper branches).

---

## 7) Stores (P1)

- Google Play: [docs/PLAY_CONSOLE_GO_LIVE_CHECKLIST.md](PLAY_CONSOLE_GO_LIVE_CHECKLIST.md)
- Global: [docs/STORE_SUBMISSION_CHECKLIST.md](STORE_SUBMISSION_CHECKLIST.md)

Mínimo:

- [ ] Privacy Policy URL pública accesible
- [ ] Terms of Service URL pública accesible
- [ ] Data safety form (Play Console)

---

## 8) Smoke test (P0/P1)

Local:

- `npm run type-check`
- `npm run lint`
- `npm run test:coverage`

App (mínimo manual):

- [ ] Abrir app sin crash
- [ ] Login → logout
- [ ] Registro crea `users/{uid}`
- [ ] Navegación por rol
