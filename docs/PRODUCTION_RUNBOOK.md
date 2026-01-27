# 🚀 Production Deployment Runbook

**Last Updated**: 2026-01-26  
**Status**: 🟢 Ready for Production  
**Version**: v1.0.0

---

## 📌 Resumen Ejecutivo

Este documento describe cómo llevar cambios desde desarrollo a producción en FurgoKid:

```
feature/fix branch
  ↓
PR a main
  ↓
CI valida (lint, tests, audit, secrets)
  ↓
Code review + approval
  ↓
Mergear a main
  ↓
CI ejecuta deploy gate (npm run pre-build:prod)
  ↓
EAS Build (Android APK/AAB) - MANUAL APPROVAL
  ↓
Play Store Release - MANUAL APPROVAL
  ↓
🎉 Live en producción
```

---

## 👥 Roles y Responsabilidades

| Rol              | Responsabilidades                                         | Acceso Necesario      |
| ---------------- | --------------------------------------------------------- | --------------------- |
| **Developer**    | Crear features, hacer commits, abrir PRs                  | GitHub (write)        |
| **Reviewer**     | Review código, aprobar PRs, validar lógica                | GitHub (write)        |
| **DevOps/Admin** | Configurar secrets, aprobar EAS builds, Play Store deploy | GitHub, Expo, Console |
| **QA**           | Testing en build preview, regression tests                | TestFlight/Google     |

---

## 📋 Prerequisitos

- [ ] Todos los secrets configurados en GitHub (ver [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md))
- [ ] Branch protection rules activas en `main` (ver [MAIN_BRANCH_PROTECTION.md](MAIN_BRANCH_PROTECTION.md))
- [ ] `npm run pre-build:prod` pasa localmente sin errores
- [ ] Firebase proyecto configurado (Blaze plan)
- [ ] AdMob app creada y ad units configuradas
- [ ] Expo project creado (eas.json actualizado)

---

## 🔄 Step-by-Step: Feature → Production

### **FASE 1: Development (Local)**

#### 1.1 Crear feature branch

```bash
# Checkout main y traer últimos cambios
git checkout main
git pull origin main

# Crear feature branch
git checkout -b feature/user-authentication
# O fix/some-issue, refactor/code-quality, etc.
```

#### 1.2 Desarrollar y testear localmente

```bash
# Hacer cambios
# ... editar código ...

# Testear localmente
npm test                 # Unit tests
npm run type-check      # TypeScript
npm run lint            # ESLint
npm run pre-build:prod  # Strict gate
```

#### 1.3 Commit y push

```bash
# Stage cambios
git add .

# Commit con mensaje convencional
git commit -m "feat: add user authentication"
# Tipos: feat, fix, refactor, docs, test, ci, chore

# Push a origin
git push origin feature/user-authentication
```

---

### **FASE 2: Pull Request (GitHub)**

#### 2.1 Crear PR

```
GitHub → New pull request
  - Base: main
  - Compare: feature/user-authentication
  - Título: "feat: add user authentication"
  - Descripción:
    - What: Describe cambios
    - Why: Por qué es necesario
    - Testing: Qué testeaste
    - Related issues: #123 (si aplica)

  → Click "Create pull request"
```

#### 2.2 Esperar CI/CD

```
GitHub Actions ejecutará automáticamente:

✅ test job (5-10 min):
   - validate:ids (AdMob IDs)
   - validate:secrets (no hardcoded keys)
   - type-check (TypeScript)
   - lint (ESLint)
   - test (Jest suite)
   - validate:env:production (en main, skipped en PR)
   - npm audit (security)
   - TruffleHog (secrets scanning - non-blocking en PR)

⏳ build-preview job (15-30 min, si EAS_TOKEN existe):
   - Setup Expo
   - Build Android APK
   - Artifact disponible para QA

Si algo falla:
  → Click en "Details" para ver logs
  → Revisar errors
  → Fix en local, push again
  → CI re-run automáticamente
```

#### 2.3 Code Review

```
GitHub → PR → Files changed:
  1. Reviewer lee el código
  2. Click "Review changes"
  3. Si todo OK: "Approve"
  4. Si hay issues: "Request changes" (requiere fixes)

Developer:
  - Recibe feedback
  - Hace fixes en local
  - Push (CI re-run automáticamente)
  - Reviewer re-reviews
  - Repeat hasta "Approved"
```

#### 2.4 Mergear PR

```
Una vez:
  ✅ CI/CD pasa (all green)
  ✅ 1+ approval
  ✅ 0 outstanding review requests

Reviewer o Developer puede:
  GitHub → PR → "Merge pull request"

Opciones:
  - "Squash and merge" (1 commit en main)
  - "Rebase and merge" (linear history)
  - "Create a merge commit" (preserva history)

→ Click "Confirm merge"
→ "Delete branch" (opcional pero recomendado)
```

---

### **FASE 3: Production Gate (CI/CD en Main)**

#### 3.1 Merge trigger CI en main

```
Una vez que mergeaste, GitHub Actions ejecuta:

✅ test job (igual a PR):
   - validate:ids, validate:secrets
   - type-check, lint, test
   - validate:env:production (AHORA SÍ, obligatorio)
   - npm audit --audit-level=low
   - TruffleHog (BLOCKING en main, no en PR)

✅ deploy job (solo corre en main):
   - Pre-build Validation: npm run pre-build:prod
     → Ejecuta TODOS los gates
     → Si falla algo → workflow falla
   - Build Production (disabled - manual approval needed)
   - Deploy to Play Store (disabled - manual approval needed)

Si CI falla:
  → Revert merge: git revert HEAD
  → O push fix rápido en PR a main
  → CI re-run

Si todo OK:
  → main está en estado deployable ✅
  → Listo para EAS build manual
```

---

### **FASE 4: EAS Build (Manual - Android APK/AAB)**

#### 4.1 Build en Expo (local o en Expo Cloud)

**Opción A: Build en Expo Cloud (Recomendado)**

```bash
# Ensure estás en main y sincronizado
git checkout main
git pull origin main

# Build para Play Store (AAB)
eas build --platform android --profile production --non-interactive

# O build para testing (APK)
eas build --platform android --profile preview

# Esperar build a completarse (~10-15 min)
# → Descargar APK/AAB desde Expo Console
# → Guardar para testing
```

**Opción B: Build automático en CI** (futuro - requiere EAS token en GitHub)

Actualmente desactivado en `ci-cd.yml` (manual-only).

Para habilitar:

```yaml
# .github/workflows/ci-cd.yml → deploy job → Build Production
- name: Build Production (Android)
  run: eas build --platform android --profile production --non-interactive
  env:
    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

#### 4.2 QA Testing

```
1. Descargar APK/AAB de Expo Console
2. Instalar en dispositivo físico o emulador
3. Testar:
   - Flujo de login
   - Crear request (parent)
   - Aceptar request (driver)
   - Chat y notificaciones
   - Pagos (si aplica)
   - Ads (banners, interstitials)
   - Offline mode
4. Reportar bugs si existen
5. Si todo OK → Go para Play Store
```

---

### **FASE 5: Play Store Release (Manual - Producción)**

#### 5.1 Subir AAB a Play Console

```
1. Ir a: https://play.google.com/console
2. Seleccionar app "FurgoKid"
3. Ir a: Release → Create new release
4. Seleccionar track: "Internal testing" o "Production"
5. Upload AAB: (subir desde Expo)
6. Release notes: Describe cambios
7. Review requerida por Google (24-48h)
8. Una aprobada → Scheduled o immediate release
```

#### 5.2 Monitoreo post-release

```
Después de release:

1. Monitor Sentry alerts (primeras 2h):
   - No crash spikes
   - No regresiones
   - Error rates normales

2. Monitor Firebase:
   - User sessions
   - Eventos críticos
   - Performance

3. Monitor Analytics:
   - DAU
   - Retention
   - Ad revenue

4. Si problema crítico → Rollback (revert commits + push hotfix)
```

---

## 🚨 Troubleshooting

### **CI falla en PR**

**Error: "npm audit found vulnerabilities"**

```bash
# Local
npm audit                    # Ver vulnerabilidades
npm audit fix                # Intentar fix automático
npm audit fix --force        # Force (puede breaks things)
git add package-lock.json
git commit -m "fix: security audit"
git push
```

**Error: "TruffleHog: Secrets detected"**

```bash
# Revisar qué fue detectado
# Remover del código
# NO commitear secrets
# Usar GitHub Secrets
git add .
git commit -m "fix: remove hardcoded secrets"
git push
```

### **CI falla en main (deploy job)**

**Error: "npm run pre-build:prod failed"**

```bash
# Este es el gate más estricto
# Revisar qué validación falló
# Hacer hotfix local
git checkout -b fix/deploy-issue
# ... fix ...
npm run pre-build:prod  # Verificar local
git commit -m "fix: deploy gate"
git push
# Crear PR nuevamente
```

### **EAS build falla**

**Error: "EAS_TOKEN invalid or expired"**

```bash
# Regenerate token
eas auth:logout
eas login

# Actualizar en GitHub secrets
GitHub → Settings → Secrets → Update EAS_TOKEN

# Re-trigger build
eas build --platform android --profile production
```

---

## 📊 Checklist: Ready for Production

Antes de mergear a main:

- [ ] Todos los cambios están en feature branch
- [ ] `npm run pre-build:prod` pasa localmente
- [ ] Tests pasan (100% de critical paths)
- [ ] ESLint sin warnings/errors
- [ ] TypeScript sin errores
- [ ] No hay hardcoded secrets
- [ ] PR creado con descripción detallada
- [ ] CI/CD verde (all checks passing)
- [ ] Code review aprobado por mínimo 1 reviewer
- [ ] No hay conflictos de merge

---

## ⏱️ Timing Esperado

```
Feature development:     1-5 días (variable)
PR review:              1-24 horas
CI/CD (PR):             5-10 minutos
CI/CD (main):           10-15 minutos
EAS Build:              10-15 minutos (cloud)
QA Testing:             2-4 horas (variable)
Play Store Review:      24-48 horas
Total:                  2-6 días
```

---

## 🎯 Production Readiness Indicators

Cuando puedas decir "estamos en 100% producción":

- ✅ main branch protegida (requiere CI + review)
- ✅ Todos los secrets configurados en GitHub
- ✅ CI/CD pipeline verde en main
- ✅ npm run pre-build:prod pasa sin warnings
- ✅ npm audit encontró 0 vulnerabilidades
- ✅ No hay hardcoded secrets (TruffleHog clean)
- ✅ EAS builds automáticos disponibles
- ✅ Play Store listing publicado
- ✅ Sentry monitoreando errores
- ✅ Firebase Analytics trackeando eventos

---

## 📞 Escalaciones

| Situación                   | Acción                                    | Contacto           |
| --------------------------- | ----------------------------------------- | ------------------ |
| PR bloqueado por CI         | Debug en GitHub Actions → Fix y re-push   | Developer          |
| PR bloqueado por review     | Contactar reviewer → Actualizar si needed | Tech Lead          |
| Secretos faltando en GitHub | Agregar en GitHub → Settings → Secrets    | DevOps/Admin       |
| Rollback de producción      | git revert + push hotfix                  | Tech Lead + DevOps |
| Sentry alertas post-release | Monitorear + prepare rollback si critical | DevOps + On-call   |

---

## 📚 Referencias Rápidas

- [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) - Cómo configurar secrets
- [MAIN_BRANCH_PROTECTION.md](MAIN_BRANCH_PROTECTION.md) - Branch protection rules
- [ci-cd.yml](.github/workflows/ci-cd.yml) - CI/CD workflow details
- [pre-build:prod](scripts/validate-*.js) - Validation scripts
- [Expo EAS Docs](https://docs.expo.dev/build/introduction/) - Building con Expo
- [Google Play Console](https://play.google.com/console) - Play Store release

---

## ✅ Sign-Off

Este runbook fue validado el 2026-01-26 y está listo para producción.

**Próximo review**: 2026-04-26 (cada 3 meses)  
**Última actualización**: 2026-01-26  
**Validado por**: AI Assistant  
**Status**: 🟢 APPROVED FOR PRODUCTION
