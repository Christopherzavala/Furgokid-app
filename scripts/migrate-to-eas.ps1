# ============================================================================
# Script de Migracion Automatica a EAS Secrets
# ============================================================================
# Autor: CTO/Senior Architect
# Proposito: Migrar secrets desde .env a EAS de forma segura
# ============================================================================

param(
    [switch]$DryRun,
    [switch]$Force
)

Write-Host "[EAS] MIGRACION A EAS SECRETS - FurgoKid" -ForegroundColor Cyan
Write-Host ("=" * 60)

# ============================================================================
# Prerequisitos
# ============================================================================
Write-Host "`n[1/5] Verificando prerequisitos..." -ForegroundColor Yellow

# Verificar que eas-cli este instalado
$easVersion = eas --version 2>$null
if (-not $easVersion) {
    Write-Host "[ERROR] EAS CLI no esta instalado" -ForegroundColor Red
    Write-Host "  Instalar con: npm install -g eas-cli" -ForegroundColor Gray
    exit 1
}

Write-Host "[OK] EAS CLI instalado: $easVersion" -ForegroundColor Green

# Verificar login
$easWhoami = eas whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] No has hecho login en EAS" -ForegroundColor Red
    Write-Host "  Ejecutar: eas login" -ForegroundColor Gray
    exit 1
}

Write-Host "[OK] Logged in como: $easWhoami" -ForegroundColor Green

# ============================================================================
# Verificar que .env existe
# ============================================================================
Write-Host "`n[2/5] Verificando archivo .env..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env no encontrado" -ForegroundColor Red
    Write-Host "  Copia .env.example y configura los valores" -ForegroundColor Gray
    exit 1
}

Write-Host "[OK] .env encontrado" -ForegroundColor Green

# ============================================================================
# Parsear secrets desde .env
# ============================================================================
Write-Host "`n[3/5] Parseando secrets desde .env..." -ForegroundColor Yellow

$secrets = @{}
$envContent = Get-Content ".env"

foreach ($line in $envContent) {
    # Saltar comentarios y lineas vacias
    if ($line -match "^\s*#" -or $line -match "^\s*$") {
        continue
    }
    
    if ($line -match "^([A-Z_][A-Z0-9_]*)=(.*)$") {
        $key = $matches[1]
        $value = $matches[2]
        
        # Remover quotes si existen
        $value = $value.Trim('"').Trim("'")
        
        # Validar que no sea placeholder
        if ($value -match "your-|REPLACE_ME|TODO") {
            Write-Host "[WARNING] $key tiene valor placeholder: $value" -ForegroundColor Yellow
            if (-not $Force) {
                Write-Host "  Saltando (usa -Force para incluir placeholders)" -ForegroundColor Gray
                continue
            }
        }
        
        $secrets[$key] = $value
    }
}

Write-Host "[OK] Encontrados $($secrets.Count) secrets para migrar" -ForegroundColor Green

# ============================================================================
# Mostrar preview
# ============================================================================
Write-Host "`n[4/5] Preview de secrets a migrar:" -ForegroundColor Yellow

foreach ($key in $secrets.Keys | Sort-Object) {
    $value = $secrets[$key]
    $maskedValue = if ($value.Length -gt 10) { 
        $value.Substring(0, 10) + "***" 
    }
    else { 
        "***" 
    }
    Write-Host "  $key = $maskedValue" -ForegroundColor Gray
}

if ($DryRun) {
    Write-Host "`n[DRY RUN] Completado (no se crearon secrets)" -ForegroundColor Green
    exit 0
}

# ============================================================================
# Confirmacion
# ============================================================================
Write-Host "`n[WARNING] IMPORTANTE: Esto sobrescribira secrets existentes en EAS" -ForegroundColor Yellow
$confirmation = Read-Host "Continuar? (y/N)"

if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-Host "[CANCELADO] Por el usuario" -ForegroundColor Red
    exit 0
}

# ============================================================================
# Crear secrets en EAS
# ============================================================================
Write-Host "`n[5/5] Creando secrets en EAS..." -ForegroundColor Yellow

$successCount = 0
$failCount = 0

foreach ($key in $secrets.Keys | Sort-Object) {
    $value = $secrets[$key]
    
    Write-Host "  Creando: $key..." -NoNewline
    
    try {
        # Usar env:create (secret:create está deprecado)
        $output = eas env:create $key --value $value --scope project --force 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " [OK]" -ForegroundColor Green
            $successCount++
        }
        else {
            Write-Host " [ERROR]" -ForegroundColor Red
            Write-Host "    Error: $output" -ForegroundColor Gray
            $failCount++
        }
    }
    catch {
        Write-Host " [ERROR]" -ForegroundColor Red
        Write-Host "    Exception: $_" -ForegroundColor Gray
        $failCount++
    }
}

# ============================================================================
# Reporte final
# ============================================================================
Write-Host ("`n" + ("=" * 60))
Write-Host "RESUMEN DE MIGRACION" -ForegroundColor Cyan
Write-Host ("=" * 60)

Write-Host "Exitosos: $successCount" -ForegroundColor Green
Write-Host "Fallidos: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" }else { "Green" })

if ($successCount -gt 0) {
    Write-Host "`n[OK] Secrets creados exitosamente en EAS" -ForegroundColor Green
    Write-Host "`nVerificar con:" -ForegroundColor Yellow
    Write-Host "  eas env:list" -ForegroundColor Gray
    
    Write-Host "`nProximos pasos:" -ForegroundColor Yellow
    Write-Host "  1. Renombrar .env a .env.backup" -ForegroundColor Gray
    Write-Host "  2. Crear nuevo .env con valores de DEV (test IDs)" -ForegroundColor Gray
    Write-Host "  3. Build de produccion: eas build --profile production --platform android" -ForegroundColor Gray
    Write-Host "  4. Verificar en logs que se cargaron secrets: 'Loaded environment variables from EAS'" -ForegroundColor Gray
}

if ($failCount -gt 0) {
    Write-Host "`n[WARNING] Algunos secrets fallaron" -ForegroundColor Yellow
    exit 1
}

exit 0
