# GitHub Actions CI/CD Setup

Este proyecto usa GitHub Actions para testing y deployment automático.

## 🔧 Setup Required

### 1. Secrets de GitHub

Configurar en GitHub → Settings → Secrets and variables → Actions:

#### **EXPO_TOKEN**

```bash
# Obtener token de Expo
eas login
eas whoami

# En Expo web dashboard → Access Tokens → Create
# Copiar token y agregar a GitHub Secrets
```

#### **FIREBASE_TOKEN**

```bash
# Obtener token de Firebase
firebase login:ci

# Output: 1//xxxxxxxxxxxxxxxxxxxxx
# Copiar token y agregar a GitHub Secrets
```

---

## 📋 Workflows

### **CI/CD Pipeline - Production Ready (ci-cd.yml)**

Se ejecuta en:

- Push a `main`, `develop`, `fix/**`
- Pull requests a `main`, `develop`

**Jobs:**

1. **test** - Gates de calidad

   - `validate:ids`, `validate:secrets`, typecheck, lint, tests
   - `npm audit` (bloqueante)
   - `validate:env:production` en push a `main`

2. **build-preview** - EAS preview build (Android)

   - Solo en PRs del mismo repo
   - Solo si existe `EAS_TOKEN`

3. **e2e-android** - Detox (manual)

   - Solo via `workflow_dispatch`

4. **deploy** - Gate de producción
   - Solo en `main`
   - Ejecuta `npm run pre-build:prod`

---

## 🚀 Usage

### Automatic (via GitHub Actions)

**Desarrollo:**

```bash
git checkout -b fix/my-feature
# ... hacer cambios ...
git commit -m "feat: add feature"
git push origin fix/my-feature
# Crear PR → CI ejecuta tests + build
```

**Production:**

```bash
git checkout main
git merge fix/my-feature
git push origin main
# → CI ejecuta tests + build + deploy automático
```

### Manual (local)

**Ejecutar tests localmente:**

```powershell
# App tests
npm test

# Functions tests
cd functions
npm test
```

**Deploy manual:**

```powershell
# Usar script automatizado
.\scripts\deploy.ps1

# O deploy directo
firebase deploy --only functions
```

---

## 📊 Monitoring

**GitHub Actions:**

- Ver runs: Repository → Actions tab
- Ver logs: Click en workflow run → Click en job

**Firebase Console:**

- Functions: https://console.firebase.google.com/project/furgokid/functions
- Logs: Firebase Console → Functions → Logs

**Coverage Reports:**

- Ver en GitHub Actions artifacts
- O generar localmente: `npm test -- --coverage`

---

## 🔐 Security

**Secrets protegidos:**

- ✅ EXPO_TOKEN - Token de Expo para builds
- ✅ FIREBASE_TOKEN - Token de Firebase para deploy

**Best practices:**

- No commitear tokens en código
- Rotar tokens cada 90 días
- Usar tokens con mínimos permisos necesarios

---

## 🐛 Troubleshooting

**Error: "EXPO_TOKEN not found"**

```bash
# Agregar en GitHub → Settings → Secrets
# Name: EXPO_TOKEN
# Value: (token de Expo)
```

**Error: "Firebase deployment failed"**

```bash
# Verificar token válido
firebase login:ci

# Actualizar secret en GitHub
```

**Error: "Tests failed"**

```bash
# Ejecutar localmente para ver error detallado
npm test -- --verbose
```

---

## 📚 Referencias

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Expo GitHub Actions](https://docs.expo.dev/build-reference/github-actions/)
- [Firebase CI/CD](https://firebase.google.com/docs/cli#cli-ci-systems)
