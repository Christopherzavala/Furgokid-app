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

# Patrones de API keys conocidas
$patterns = @{
    "Google API Key"      = "AIza[0-9A-Za-z\-_]{35}"
    "Firebase Server Key" = "AAAA[0-9A-Za-z\-_:]{100,}"
    "AdMob ID"            = "ca-app-pub-[0-9]{16}"
}

foreach ($name in $patterns.Keys) {
    $pattern = $patterns[$name]
    $matches = Get-ChildItem -Path "src", "App.js" -Recurse -Include *.js, *.jsx, *.ts, *.tsx -ErrorAction SilentlyContinue | 
    Select-String -Pattern $pattern
    
    if ($matches) {
        Write-Host "[WARNING] Posible $name hardcodeada encontrada:" -ForegroundColor Yellow
        $matches | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber)" -ForegroundColor Gray }
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
        "FIREBASE_API_KEY",
        "FIREBASE_PROJECT_ID",
        "ADMOB_ANDROID_APP_ID",
        "ADMOB_IOS_APP_ID"
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

if ($appConfigContent -match "ca-app-pub-3940256099942544") {
    Write-Host "[CRITICO] AdMob usando IDs de TEST en produccion" -ForegroundColor Red
    Write-Host "  Impacto: `$0 revenue + riesgo de ban de Google" -ForegroundColor Red
    Write-Host "  Accion: Configurar IDs reales en https://admob.google.com" -ForegroundColor Yellow
    $errorsFound++
}
else {
    Write-Host "[OK] AdMob configurado con IDs reales" -ForegroundColor Green
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
