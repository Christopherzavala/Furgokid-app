# 🛡️ Main Branch Protection Rules

## Objetivo

Asegurar que `main` siempre esté en estado deployable:

- ✅ CI debe pasar (lint, tests, security audit)
- ✅ Code review obligatorio (mínimo 1 approval)
- ✅ No se puede force-push a `main`
- ✅ Todos los commits en `main` deben estar en branches protegidas

---

## 📋 Configuración Recomendada

### **1. Ir a GitHub Settings**

```
GitHub.com → Tu repositorio
  → Settings
  → Branches (menú izquierdo)
  → Add rule (o editar regla existente para "main")
```

### **2. Branch name pattern**

```
main
```

### **3. Protect matching branches - Checklist**

#### ✅ **Require a pull request before merging**

- [x] Require approvals: **1** (mínimo 1 reviewer)
- [x] Dismiss stale pull request approvals when new commits are pushed
- [ ] Require review from code owners

#### ✅ **Require status checks to pass before merging**

- [x] Require branches to be up to date before merging
- [x] Require the following status checks to pass:
  - [ ] `test` (del workflow ci-cd.yml)
  - [ ] `build-preview` (opcional, puede faltar en fork PRs)
  - [ ] `deploy` (solo corre en main, así que marcar como optional)

**OPT**: También puedes agregar:

- [ ] Codecov (si integras coverage)

#### ✅ **Require conversation resolution before merging**

- [x] Enable (asegurar todas las review comments estén resueltas)

#### ✅ **Require signed commits**

- [ ] Disable (opcional, pero recomendado después)

#### ✅ **Require linear history**

- [ ] Disable (para simplificar, pero recomendado: merge commits vs squash)

#### ✅ **Require deployments to succeed before merging**

- [ ] Disable (no aplica aún)

#### ✅ **Allow force pushes**

- [ ] Disabled (SIEMPRE disabled en main)

#### ✅ **Allow deletions**

- [ ] Disabled (SIEMPRE disabled en main)

### **4. Rules for administrators**

```
[ ] Include administrators (deja sin marcar para que admins puedan mergear emergencias)
```

---

## 🔄 Workflow Esperado

### **PRs a `main`**

```
Developer:
  1. git checkout -b fix/some-issue
  2. ... cambios ...
  3. git commit -m "fix: issue"
  4. git push origin fix/some-issue

GitHub:
  1. Crear PR a main
  2. CI/CD corre automáticamente:
     - test job: ✅ (lint, tests, audit)
     - build-preview: ✅ (si EAS_TOKEN, else skip)
  3. Requiere 1 approval de maintainer

Reviewer:
  1. Review código
  2. Click "Approve"
  3. Mergear PR (auto-delete branch)

Main:
  1. CI corre en main (test + deploy job)
  2. deploy job ejecuta npm run pre-build:prod ✅
  3. Main queda en estado deployable
```

### **Direct push a `main` (bloqueado)**

```
Developer intenta: git push origin main
  ↓
GitHub rechaza (branch is protected)
  ↓
Debes crear PR → pasar CI → pasar review → mergear
```

---

## 🚨 Casos de Emergencia

Si necesitas bypasear las rules:

```
OPCIÓN 1: Temporalmente desactivar regla
  - GitHub → Settings → Branches → Uncheck rules
  - Hacer push/fix emergencia
  - Re-activar rules

OPCIÓN 2: Usar "Dismiss stale approvals"
  - Si CI pasó, pero hubo cambios
  - Los PRs antiguos requieren new approval
  - Mantiene la rama segura

OPCIÓN 3: Admin override
  - Si incluiste admins en "Include administrators"
  - Solo admins pueden mergear sin aprovals
  - Usar SOLO para emergencias críticas
```

---

## ✅ Testing de Rules

### **Verificar que funciona**

```bash
# 1. Intentar push directo a main (debe fallar)
git checkout main
git commit --allow-empty -m "test direct push"
git push origin main
# Esperado:
# error: failed to push some refs to 'origin'
# "Updates to main were rejected because..."

# 2. Crear PR (debe pasar)
git checkout -b test/branch-protection
git commit --allow-empty -m "test pr"
git push origin test/branch-protection
# → Crear PR en GitHub
# → Esperar CI verde ✅
# → 1 approval
# → Mergear ✅

# 3. Limpiar
git checkout main
git pull origin main
git branch -D test/branch-protection
```

---

## 📊 Estado Esperado

Después de configurar:

```
main (protected)
├─ Require PR: ✅
├─ Require 1 approval: ✅
├─ Require CI to pass:
│  ├─ test: ✅ (obligatorio)
│  └─ deploy: (corre en main auto)
├─ Require up to date: ✅
├─ Require conversation resolution: ✅
├─ Force push disabled: ✅
└─ Deletion disabled: ✅
```

---

## 🎯 Próximos Pasos

1. **Configurar rules** (5 min)
2. **Verificar reglas funcionan** (2 min)
3. **Comunicar al equipo**:
   > "main está protegida. Ahora todo debe ir por PR."
4. **Crear first test PR** (10 min)
5. **Mergear y verificar CI en main** (5 min)

**Tiempo total: ~20 minutos**

---

## 📞 Referencias

- [GitHub Branch Protection Rules Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub Status Checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#about-branch-protection-rules)
