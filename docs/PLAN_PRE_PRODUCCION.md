# Plan Pre-Producción: 30-31 Diciembre

## 🎯 Objetivo

Maximizar calidad y compliance antes del primer build APK (1 enero 2026)

---

## 📅 DÍA 1 - Lunes 30 Diciembre (Hoy)

### ⏰ Sesión Mañana (4-5h)

#### 1. **Staging Environment Setup** (2h) - PRIORIDAD MÁXIMA

**Por qué primero:**

- Permite testear GDPR y E2E en ambiente seguro
- Separa testing de producción
- Previene errores costosos en Firebase producción

**Implementación:**

```bash
# Crear proyecto Firebase staging
1. Firebase Console → Add Project → "furgokid-staging"
2. Copiar credenciales a .env.staging
3. Configurar EAS profile staging en eas.json
4. Setup Firestore staging con mismas reglas
```

**Archivos a crear:**

- `.env.staging` (credenciales Firebase staging)
- `app.config.staging.js` (config staging)
- Update `eas.json` con profile staging

**Entregable:** Poder correr `npm run build:staging` sin tocar producción

---

#### 2. **GDPR/COPPA Compliance - Parte 1** (2-3h) - LEGAL REQUIREMENT

**Por qué crítico:**

- App maneja datos de niños (transporte escolar)
- COPPA multas: hasta $43,280 USD por violación (FTC)
- GDPR multas: hasta 4% revenue anual o €20M (ICO)
- Google Play RECHAZARÁ sin compliance

**Implementación Priority:**

**a) Parental Consent Flow** (90min)

```typescript
// src/screens/ParentalConsentScreen.tsx
- Verificación de edad
- Email parental verification
- Consent explícito para datos de menores
```

**b) Data Minimization** (30min)

```typescript
// Revisar qué datos recolectamos de niños
- SOLO: Nombre, edad, dirección pickup/dropoff
- ELIMINAR: Cualquier dato no esencial
```

**c) Right to Erasure** (30min)

```typescript
// src/services/gdprService.ts
- Función deleteUserData(userId)
- Botón "Delete My Account" en Settings
```

---

### ⏰ Sesión Tarde (3-4h)

#### 3. **GDPR/COPPA Compliance - Parte 2** (3h)

**d) Data Export Feature** (90min)

```typescript
// src/screens/SettingsScreen.tsx
- Botón "Download My Data"
- Genera JSON con todos los datos del usuario
- Envía por email
```

**e) Privacy Updates** (60min)

```
- Actualizar PRIVACY_POLICY.md con COPPA compliance
- Agregar sección "Children's Privacy"
- Link a parental consent flow
- DPO contact: privacy@furgokid.app
```

**f) Cookie Banner (Web)** (30min)

```typescript
// src/components/CookieBanner.tsx
- Solo si web version existe
- Accept/Reject cookies
- Granular controls
```

---

### 📊 Fin Día 1 - Checklist

- [ ] Staging environment funcionando
- [ ] Parental consent implementado
- [ ] Right to erasure funcionando
- [ ] Data export feature
- [ ] Privacy policy actualizada
- [ ] Tested en staging (no producción)

**Score esperado:** 82/100 → 87/100

---

## 📅 DÍA 2 - Martes 31 Diciembre

### ⏰ Sesión Mañana (4h)

#### 4. **E2E Testing Básico** (4h) - QUALITY GATE

**Por qué importante:**

- Previene regresiones en flujos críticos
- Documenta user journeys esperados
- CI/CD puede correr automáticamente

**Setup Detox** (60min)

```bash
npm install --save-dev detox detox-cli
detox init -r jest
```

**5 Tests Críticos** (3h)

```typescript
// e2e/critical-flows.test.js

1. User Registration Flow (30min)
   - Parent registers
   - Driver registers
   - Email validation
   - Role selection

2. Login Flow (20min)
   - Valid credentials
   - Invalid credentials
   - Forgot password

3. Search & Match Flow (40min)
   - Parent searches drivers
   - Filters work (zone, schedule)
   - Contact button works

4. Tracking Flow (40min)
   - Driver starts route
   - Parent sees real-time location
   - Notifications received

5. AdMob Integration (30min)
   - Banner loads
   - Interstitial shows
   - No crashes
```

---

### ⏰ Sesión Tarde (3-4h)

#### 5. **Pre-Build Checklist Final** (4h)

**a) Security Final Review** (60min)

```bash
# Audit completo
npm audit --audit-level=moderate
npm run security:audit

# Verificar .env no commiteado
git status --ignored

# Rotar API keys si hubo leaks
```

**b) Performance Optimization** (60min)

```typescript
// Verificar:
- Hermes enabled ✅
- ProGuard enabled ✅
- Bundle size < 50MB ✅
- Images optimized
- Unused deps removed

// Run:
npm run analyze:bundle
npx expo-doctor
```

**c) Compliance Documentation** (60min)

```
Crear: docs/COMPLIANCE_REPORT.md
- GDPR checklist ✅
- COPPA checklist ✅
- Accessibility WCAG AA ✅
- Privacy policy link
- Terms of service link
```

**d) Build Configuration** (60min)

```bash
# Validar eas.json production profile
- Correct bundle identifier
- Correct app name
- Version: 1.0.0
- Build number: 1

# Validar app.config.js
- Privacy policy URL
- Support email
- Permissions justificadas

# Test build preview (no production)
npm run build:preview  # En staging!
```

---

### 📊 Fin Día 2 - Checklist Pre-Build

**Compliance:**

- [ ] GDPR compliant (Right to erasure, data export)
- [ ] COPPA compliant (Parental consent)
- [ ] Privacy policy updated
- [ ] DPO contact published

**Quality:**

- [ ] 5 E2E tests passing
- [ ] TypeScript: 0 errors
- [ ] Unit tests: 87/87 passing
- [ ] Bundle: < 50MB
- [ ] Security audit passed

**Configuration:**

- [ ] Staging tested
- [ ] Production secrets validated
- [ ] Build config verified
- [ ] Version numbers set

**Documentation:**

- [ ] COMPLIANCE_REPORT.md
- [ ] README updated
- [ ] CHANGELOG created
- [ ] Release notes drafted

**Score esperado:** 87/100 → **92/100** 🎯

---

## 🚀 DÍA 3 - Miércoles 1 Enero (Build Day)

### Pre-Build Morning (2h)

```bash
# 1. Final smoke test en staging
npm run smoke:test

# 2. Validate all
npm run validate

# 3. Bundle check
npm run analyze:bundle

# 4. Backup database
# Firebase Console → Firestore → Export

# 5. Commit final
git add .
git commit -m "chore: pre-production final validation"
git push

# 6. Tag release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### Production Build (30min)

```bash
# Android APK (Google Play Internal Testing)
npm run build:production

# Esperar build en EAS dashboard
# Descargar APK
# Test manual en dispositivo físico
```

### Submit to Play Store (1h)

```bash
# Internal Testing track
eas submit --platform android --profile production

# Completar en Play Console:
- Screenshots (1080x1920 mínimo 2)
- Feature graphic (1024x500)
- App description (ES/EN)
- Privacy policy link
- Support email
- Content rating questionnaire
```

---

## 📊 Scores Proyectados

| Día             | Trabajo            | Score      | Mejora |
| --------------- | ------------------ | ---------- | ------ |
| **Hoy (30/12)** | Staging + GDPR     | **87/100** | +5     |
| **31/12**       | E2E + Final checks | **92/100** | +5     |
| **1/1**         | Build + Submit     | **95/100** | +3     |

---

## 💡 Alternativa: Plan Conservador

Si prefieres menos trabajo y más descanso en Año Nuevo:

**30 Diciembre (Solo):**

- Staging Environment (2h)
- GDPR básico (Right to erasure + Privacy update) (3h)
- **Total: 5h**

**31 Diciembre:**

- Descanso / Año Nuevo

**1 Enero (Build):**

- Pre-build checks (2h)
- Production build (1h)
- **Total: 3h**

**Score final:** ~85/100 (suficiente para MVP)

---

## 🎯 Mi Recomendación

### Plan Óptimo (si puedes dedicar ~16h en 2 días):

**DÍA 1 (30 dic):**

1. ✅ Staging Environment (2h)
2. ✅ GDPR/COPPA Full (6h)

**DÍA 2 (31 dic):** 3. ✅ E2E Tests básicos (4h) 4. ✅ Pre-build final (3h)

**DÍA 3 (1 ene):** 5. ✅ Build + Submit (3h)

**Resultado:** Score 92/100, compliance legal, quality assured

---

### Plan Conservador (si quieres menos presión):

**DÍA 1 (30 dic):**

1. ✅ Staging Environment (2h)
2. ✅ GDPR mínimo (3h)

**DÍA 2 (31 dic):**

- Descanso

**DÍA 3 (1 ene):** 3. ✅ Pre-build + Build (3h)

**Resultado:** Score 85/100, funcional pero menos pulido

---

## ❓ ¿Con cuál empezamos?

**Opción A:** Plan Óptimo (92/100) - Empezamos con Staging ahora
**Opción B:** Plan Conservador (85/100) - Solo lo esencial
**Opción C:** Personalizado - Dime qué prefieres priorizar

**¿Qué prefieres?** 🚀
