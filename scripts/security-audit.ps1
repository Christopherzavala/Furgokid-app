# ============================================================================
# Script de Auditoria de Seguridad - FurgoKid
# ============================================================================
# Autor: CTO/Senior Architect
# Proposito: Detectar leaks de secrets y validar configuracion de seguridad
# ============================================================================

Write-Host "[SEGURIDAD] AUDITORIA DE SEGURIDAD - FurgoKid" -ForegroundColor Cyan
Write-Host ("=" * 60)

$errorsFound = 0
$warningsFound = 0

# ============================================================================
# 1. Verificar que .env este en .gitignore
# ============================================================================
Write-Host "`n[1/5] Verificando .gitignore..." -ForegroundColor Yellow

if (Select-String -Path ".gitignore" -Pattern "^\.env$" -Quiet) {
    Write-Host "[OK] .env esta en .gitignore" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] .env NO esta en .gitignore" -ForegroundColor Red
    $errorsFound++
}

# ============================================================================
# 2. Buscar .env en historial de Git (CRITICO)
# ============================================================================
Write-Host "`n[2/5] Buscando .env en historial de Git..." -ForegroundColor Yellow

$envInHistory = git log --all --full-history -- .env 2>$null

if ($envInHistory) {
    Write-Host "[CRITICO] .env encontrado en historial de Git" -ForegroundColor Red
    Write-Host "  ACCION REQUERIDA: Rotar TODAS las API keys inmediatamente" -ForegroundColor Red
    Write-Host "  Ver: https://docs.github.com/es/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository" -ForegroundColor Yellow
    $errorsFound++
}
else {
    Write-Host "[OK] No se encontro .env en historial de Git" -ForegroundColor Green
}

# ============================================================================
# 3. Verificar secrets hardcodeados en codigo
# ============================================================================
Write-Host "`n[3/5] Buscando API keys hardcodeadas..." -ForegroundColor Yellow

$codeFiles = Get-ChildItem -Path "src", "App.js" -Recurse -Include *.js, *.jsx, *.ts, *.tsx -ErrorAction SilentlyContinue

# Google API Key
$googleKeyMatches = $codeFiles | Select-String -Pattern "AIza[0-9A-Za-z\-_]{35}"
if ($googleKeyMatches) {
    Write-Host "[WARNING] Posible Google API Key hardcodeada encontrada:" -ForegroundColor Yellow
    $googleKeyMatches | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber)" -ForegroundColor Gray }
    $warningsFound++
}

# Firebase Server Key
$firebaseServerKeyMatches = $codeFiles | Select-String -Pattern "AAAA[0-9A-Za-z\-_:]{100,}"
if ($firebaseServerKeyMatches) {
    Write-Host "[WARNING] Posible Firebase Server Key hardcodeada encontrada:" -ForegroundColor Yellow
    $firebaseServerKeyMatches | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber)" -ForegroundColor Gray }
    $warningsFound++
}

# AdMob IDs: allow Google test IDs (3940256099942544)
$admobMatches = $codeFiles | Select-String -Pattern "ca-app-pub-[0-9]{16}"
if ($admobMatches) {
    $nonTestAdmobMatches = $admobMatches | Where-Object { $_.Line -notmatch "ca-app-pub-3940256099942544" }
    if ($nonTestAdmobMatches) {
        Write-Host "[WARNING] Posible AdMob ID de producción hardcodeado encontrado:" -ForegroundColor Yellow
        $nonTestAdmobMatches | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber)" -ForegroundColor Gray }
        $warningsFound++
    }
}

if ($warningsFound -eq 0) {
    Write-Host "[OK] No se detectaron API keys hardcodeadas" -ForegroundColor Green
}

# ============================================================================
# 4. Validar que .env tenga todas las variables necesarias
# ============================================================================
Write-Host "`n[4/5] Validando variables de entorno..." -ForegroundColor Yellow

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    
    $requiredVars = @(
        "EXPO_PUBLIC_FIREBASE_API_KEY",
        "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
        "ADMOB_ANDROID_APP_ID",
        "ADMOB_IOS_APP_ID",
        "GOOGLE_MAPS_API_KEY"
    )
    
    $missingVars = @()
    foreach ($var in $requiredVars) {
        if ($envContent -notmatch "$var=") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Host "[WARNING] Variables faltantes en .env:" -ForegroundColor Yellow
        $missingVars | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
        $warningsFound++
    }
    else {
        Write-Host "[OK] Todas las variables requeridas estan presentes" -ForegroundColor Green
    }
    
    # Detectar placeholders
    if ($envContent -match "your-api-key-here|your-project-id|REPLACE_ME") {
        Write-Host "[WARNING] .env contiene valores placeholder" -ForegroundColor Yellow
        Write-Host "  Actualiza con valores reales antes de deployment" -ForegroundColor Gray
        $warningsFound++
    }
}
else {
    Write-Host "[WARNING] .env no existe. Copia .env.example" -ForegroundColor Yellow
    $warningsFound++
}

# ============================================================================
# 5. Validar configuracion de AdMob
# ============================================================================
Write-Host "`n[5/5] Validando configuracion de AdMob..." -ForegroundColor Yellow

$appConfigContent = Get-Content "app.config.js" -Raw

if (
    ($appConfigContent -match "process\.env\.ADMOB_ANDROID_APP_ID") -and
    ($appConfigContent -match "process\.env\.ADMOB_IOS_APP_ID") -and
    ($appConfigContent -match "process\.env\.BANNER_AD_UNIT_ID") -and
    ($appConfigContent -match "process\.env\.INTERSTITIAL_AD_UNIT_ID") -and
    ($appConfigContent -match "process\.env\.REWARDED_AD_UNIT_ID")
) {
    Write-Host "[OK] AdMob configurado via variables de entorno (sin hardcode)" -ForegroundColor Green
}
else {
    Write-Host "[WARNING] AdMob env wiring incompleto en app.config.js" -ForegroundColor Yellow
    Write-Host "  Revisa ADMOB_*_APP_ID y *_AD_UNIT_* en env/EAS Secrets" -ForegroundColor Gray
    $warningsFound++
}

# ============================================================================
# REPORTE FINAL
# ============================================================================
Write-Host ("`n" + ("=" * 60))
Write-Host "RESUMEN DE AUDITORIA" -ForegroundColor Cyan
Write-Host ("=" * 60)

if ($errorsFound -eq 0 -and $warningsFound -eq 0) {
    Write-Host "[APROBADO] No se encontraron problemas de seguridad" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "Errores criticos: $errorsFound" -ForegroundColor $(if ($errorsFound -gt 0) { "Red" }else { "Green" })
    Write-Host "Warnings: $warningsFound" -ForegroundColor Yellow
    
    if ($errorsFound -gt 0) {
        Write-Host "`n[ACCION REQUERIDA] Corrige los errores criticos" -ForegroundColor Red
        exit 1
    }
    else {
        Write-Host "`n[INFO] Revisa los warnings antes de deployment" -ForegroundColor Yellow
        exit 0
    }
}
