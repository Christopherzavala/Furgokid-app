# 🔄 Rollback Automation - Emergency Recovery

Procedimientos y scripts para revertir deploys fallidos en emergencias.

## 🚨 ¿Cuándo hacer Rollback?

### **Triggers de Rollback Inmediato:**

- ✅ Error rate > 50% en 5 minutos
- ✅ Cloud Functions crasheando constantemente
- ✅ Notificaciones push no enviándose (0% delivery)
- ✅ Firestore rules bloqueando operaciones legítimas
- ✅ Costos disparados (> $50 en 1 hora)

### **Triggers de Investigación (no rollback inmediato):**

- ⚠️ Error rate 10-20%
- ⚠️ Latencia alta pero funcional
- ⚠️ Algunos usuarios afectados (< 10%)

## 🛠️ Herramientas de Rollback

### **1. Firebase Functions Rollback**

```powershell
# scripts/rollback.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$FunctionName,

    [switch]$All,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🔄 ROLLBACK - Furgokid Backend" -ForegroundColor Red
Write-Host "===========================================" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    Write-Host "⚠️  WARNING: Esto eliminará las Functions actuales" -ForegroundColor Yellow
    $confirm = Read-Host "¿Estás seguro? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "❌ Rollback cancelado" -ForegroundColor Yellow
        exit 0
    }
}

# Verificar ambiente
Write-Host "📋 Verificando ambiente..." -ForegroundColor Yellow
$currentProject = firebase use | Out-String

Write-Host "   Proyecto actual: $currentProject" -ForegroundColor Cyan

if ($currentProject -match "production") {
    Write-Host "⚠️  ESTÁS EN PRODUCTION" -ForegroundColor Red
    if (-not $Force) {
        $confirm = Read-Host "¿Seguro que quieres hacer rollback en PRODUCTION? (yes/no)"
        if ($confirm -ne "yes") {
            exit 0
        }
    }
}

# Backup current state
Write-Host ""
Write-Host "💾 Creando backup del estado actual..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "backups/functions-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# List current functions
Write-Host "📋 Functions actuales:" -ForegroundColor Yellow
firebase functions:list | Tee-Object -FilePath "$backupDir/functions-list.txt"

# Export Firestore data (safety backup)
Write-Host ""
Write-Host "💾 Exportando Firestore (safety backup)..." -ForegroundColor Yellow
firebase firestore:export "gs://furgokid.appspot.com/backups/rollback-$timestamp"

# Delete functions
if ($All) {
    Write-Host ""
    Write-Host "🗑️  Eliminando TODAS las Cloud Functions..." -ForegroundColor Red

    $functions = @(
        "notifyDriversNewRequest",
        "notifyParentsNewVacancy",
        "sendWelcomeEmail",
        "testNotification"
    )

    foreach ($fn in $functions) {
        Write-Host "   Eliminando $fn..." -ForegroundColor Yellow
        firebase functions:delete $fn --force

        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $fn eliminada" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Error eliminando $fn (puede no existir)" -ForegroundColor Yellow
        }
    }

} elseif ($FunctionName) {
    Write-Host ""
    Write-Host "🗑️  Eliminando Function: $FunctionName..." -ForegroundColor Yellow

    firebase functions:delete $FunctionName --force

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ $FunctionName eliminada" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error eliminando $FunctionName" -ForegroundColor Red
        exit 1
    }

} else {
    Write-Host "❌ Especifica -FunctionName o -All" -ForegroundColor Red
    Write-Host "   Ejemplo: .\scripts\rollback.ps1 -FunctionName notifyDriversNewRequest" -ForegroundColor Cyan
    Write-Host "   Ejemplo: .\scripts\rollback.ps1 -All" -ForegroundColor Cyan
    exit 1
}

# Deploy previous version (if exists)
if (Test-Path "backups/functions-backup/index.js") {
    Write-Host ""
    Write-Host "📦 ¿Deployar versión anterior de backup? (y/N): " -ForegroundColor Yellow -NoNewline
    $deployBackup = Read-Host

    if ($deployBackup -eq "y") {
        Write-Host "🚀 Deployando versión de backup..." -ForegroundColor Yellow

        # Copy backup to functions/
        Copy-Item -Path "backups/functions-backup/*" -Destination "functions/" -Recurse -Force

        # Deploy
        firebase deploy --only functions

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Versión anterior deployada" -ForegroundColor Green
        } else {
            Write-Host "❌ Error deployando backup" -ForegroundColor Red
        }
    }
}

# Verify rollback
Write-Host ""
Write-Host "🔍 Verificando estado post-rollback..." -ForegroundColor Yellow
firebase functions:list

# Log rollback
$logEntry = "$timestamp - ROLLBACK: $($All ? 'ALL' : $FunctionName)"
Add-Content -Path "docs/logs/rollback-history.txt" -Value $logEntry

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "✅ Rollback completado" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Investigar causa del fallo" -ForegroundColor Cyan
Write-Host "   2. Fixear código en functions/" -ForegroundColor Cyan
Write-Host "   3. Deploy a staging primero" -ForegroundColor Cyan
Write-Host "   4. Smoke tests en staging" -ForegroundColor Cyan
Write-Host "   5. Deploy a production cuando esté OK" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Backup guardado en: $backupDir" -ForegroundColor Gray
Write-Host "📝 Firestore backup en: gs://furgokid.appspot.com/backups/rollback-$timestamp" -ForegroundColor Gray
Write-Host ""
```

### **2. Firestore Rules Rollback**

```powershell
# Guardar versión actual
firebase firestore:rules > backups/firestore-rules-$(Get-Date -Format "yyyyMMdd-HHmmss").rules

# Revertir a versión anterior
firebase deploy --only firestore:rules
```

### **3. Manual Emergency Stop**

```powershell
# Deshabilitar todas las Functions
firebase functions:delete notifyDriversNewRequest --force
firebase functions:delete notifyParentsNewVacancy --force
firebase functions:delete sendWelcomeEmail --force
firebase functions:delete testNotification --force

# Verificar que ya no haya Functions activas
firebase functions:list
# Output esperado: "No functions deployed"
```

## 📦 Backup Strategy

### **Pre-Deploy Backup (Automático)**

Agregar a `scripts/deploy.ps1`:

```powershell
# Crear backup antes de deploy
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Write-Host "💾 Creando backup pre-deploy..." -ForegroundColor Yellow

# Backup de código
Copy-Item -Path "functions/" -Destination "backups/functions-backup-$timestamp" -Recurse -Force

# Backup de Firestore
firebase firestore:export "gs://furgokid.appspot.com/backups/pre-deploy-$timestamp"

Write-Host "✅ Backup creado: $timestamp" -ForegroundColor Green
```

### **Backup de Firestore Data**

```powershell
# Export completo
firebase firestore:export gs://furgokid.appspot.com/backups/$(Get-Date -Format "yyyyMMdd")

# Export específico (solo una colección)
gcloud firestore export gs://furgokid.appspot.com/backups/users-only \
  --collection-ids=users

# Restore desde backup
firebase firestore:import gs://furgokid.appspot.com/backups/20250615
```

## 🔍 Detección de Fallos

### **Script de Monitoreo Continuo**

```javascript
// scripts/watch-health.js
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
let lastCheck = new Date();

async function checkHealth() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

  // Check errors in last 5 minutes
  const errorsSnapshot = await db
    .collection('notification_errors')
    .where('timestamp', '>=', fiveMinutesAgo)
    .get();

  const logsSnapshot = await db
    .collection('notification_logs')
    .where('timestamp', '>=', fiveMinutesAgo)
    .get();

  const total = logsSnapshot.size;
  const errors = errorsSnapshot.size;
  const errorRate = total > 0 ? (errors / total) * 100 : 0;

  console.log(`[${now.toISOString()}] Error Rate: ${errorRate.toFixed(2)}%`);

  // TRIGGER ROLLBACK if error rate > 50%
  if (errorRate > 50 && total > 10) {
    console.log('🚨 CRITICAL: Error rate > 50% - ROLLBACK NEEDED');
    console.log('   Run: .\\scripts\\rollback.ps1 -All -Force');

    // Opcional: Auto-rollback
    // require('child_process').execSync('powershell .\\scripts\\rollback.ps1 -All -Force');
  }

  lastCheck = now;
}

// Check every 5 minutes
setInterval(checkHealth, 5 * 60 * 1000);
checkHealth(); // First check immediately
```

**Ejecutar en servidor/local:**

```powershell
# Mantener corriendo en background
Start-Job -ScriptBlock { node scripts/watch-health.js } -Name "HealthMonitor"

# Ver logs
Receive-Job -Name "HealthMonitor" -Keep

# Detener
Stop-Job -Name "HealthMonitor"
Remove-Job -Name "HealthMonitor"
```

## 📋 Checklist de Recovery

### **Post-Rollback Steps:**

1. **Verificación Inmediata**

   - [ ] Functions eliminadas (firebase functions:list)
   - [ ] Error rate bajó a 0%
   - [ ] App funcionando sin crashes

2. **Investigación**

   - [ ] Revisar logs: `firebase functions:log`
   - [ ] Identificar causa raíz (código, timeout, quota, billing)
   - [ ] Documentar findings en incident report

3. **Fix & Test**

   - [ ] Fixear código problemático
   - [ ] Unit tests pasando
   - [ ] Deploy a staging
   - [ ] Smoke tests en staging
   - [ ] E2E testing en staging

4. **Re-Deploy**

   - [ ] Crear backup pre-deploy
   - [ ] Deploy a production
   - [ ] Smoke tests post-deploy
   - [ ] Monitorear por 1 hora

5. **Post-Mortem**
   - [ ] Escribir incident report
   - [ ] Identificar prevención (más tests, alertas, etc.)
   - [ ] Actualizar runbook

## 🔗 Emergency Contacts

```yaml
Incident Response Team:
  - Primary: Tu Email (tu-email@example.com)
  - Backup: Backup Email

Critical Links:
  - Firebase Console: https://console.firebase.google.com/project/furgokid
  - Error Logs: https://console.firebase.google.com/project/furgokid/functions/logs
  - Cloud Monitoring: https://console.cloud.google.com/monitoring
  - Billing: https://console.cloud.google.com/billing

Rollback Script:
  - Location: scripts/rollback.ps1
  - Usage: .\scripts\rollback.ps1 -All -Force

Backup Locations:
  - Code: backups/functions-backup-YYYYMMDD-HHMMSS/
  - Firestore: gs://furgokid.appspot.com/backups/
```

## 📝 Incident Report Template

```markdown
# Incident Report - [Date]

## Summary

Brief description of what went wrong.

## Timeline

- HH:MM - Deploy initiated
- HH:MM - Error rate increased to X%
- HH:MM - Rollback triggered
- HH:MM - Service restored

## Root Cause

What caused the failure?

## Impact

- Users affected: X
- Duration: X minutes
- Notifications lost: X

## Resolution

How was it fixed?

## Prevention

What can we do to prevent this in the future?

## Action Items

- [ ] Add test for edge case
- [ ] Update monitoring alerts
- [ ] Improve documentation
```

---

**Preparación para emergencias = Menos downtime.** 🔄
