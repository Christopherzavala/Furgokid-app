# 🚀 Quick Setup Script - Furgokid
# Automatiza el setup inicial del proyecto

param(
    [switch]$InstallDependencies,
    [switch]$ConfigureOnly
)

$ErrorActionPreference = "Stop"

if ($InstallDependencies) {
    $installConfirmation = Read-Host "Esto instalará dependencias locales con npm ci. Escribe exactamente yes para continuar"
    if ($installConfirmation -cne 'yes') { throw 'Instalación cancelada; no se modificó el entorno.' }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   🚀 Furgokid Quick Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Node.js y npm
Write-Host "1️⃣  Verificando Node.js..." -ForegroundColor Yellow

try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js no instalado" -ForegroundColor Red
    Write-Host "   Descarga: https://nodejs.org/" -ForegroundColor Cyan
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Host "   ✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm no encontrado" -ForegroundColor Red
    exit 1
}

# 2. Verificar Firebase CLI
Write-Host ""
Write-Host "2️⃣  Verificando Firebase CLI..." -ForegroundColor Yellow

try {
    $firebaseVersion = firebase --version
    Write-Host "   ✅ Firebase CLI: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Firebase CLI no instalado; diagnóstico sin instalar herramientas" -ForegroundColor Yellow
}

# 3. Verificar EAS CLI
Write-Host ""
Write-Host "3️⃣  Verificando EAS CLI..." -ForegroundColor Yellow

try {
    $easVersion = eas --version
    Write-Host "   ✅ EAS CLI: $easVersion" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  EAS CLI no instalado; diagnóstico sin instalar herramientas" -ForegroundColor Yellow
}

if ($ConfigureOnly) {
    Write-Host ""
    Write-Host "✅ Herramientas verificadas. Saliendo (--ConfigureOnly)." -ForegroundColor Green
    exit 0
}

# 4. Instalar dependencias del proyecto
if ($InstallDependencies) {
    Write-Host ""
    Write-Host "4️⃣  Instalando dependencias del proyecto..." -ForegroundColor Yellow
    
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Error instalando dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Dependencias instaladas" -ForegroundColor Green
    
    # Instalar dependencias de Functions
    if (Test-Path "functions/package.json") {
        Write-Host ""
        Write-Host "5️⃣  Instalando dependencias de Functions..." -ForegroundColor Yellow
        Push-Location functions
        npm ci
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   ❌ Error instalando dependencias de Functions" -ForegroundColor Red
            Pop-Location
            exit 1
        }
        Pop-Location
        Write-Host "   ✅ Dependencies de Functions instaladas" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "⏭️  Dependencias sin cambios. Usa -InstallDependencies para iniciar una instalación local confirmada." -ForegroundColor Yellow
}

# 7. Verificar archivos críticos
Write-Host ""
Write-Host "7️⃣  Verificando archivos críticos..." -ForegroundColor Yellow

$criticalFiles = @(
    "package.json",
    "App.js",
    "firebase.json",
    "eas.json",
    ".firebaserc",
    "functions/index.js",
    "functions/package.json"
)

$missingFiles = @()
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ FALTA: $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "   ⚠️  Archivos faltantes: $($missingFiles.Count)" -ForegroundColor Yellow
    Write-Host "   El proyecto puede no funcionar correctamente" -ForegroundColor Yellow
}

# 8. Mostrar configuración local sin consultar el proyecto remoto
Write-Host ""
Write-Host "8️⃣  Verificando configuración local de Firebase..." -ForegroundColor Yellow
if (Test-Path '.firebaserc') { Write-Host '   ✅ .firebaserc presente; no se seleccionó ni consultó un proyecto.' -ForegroundColor Green }
else { Write-Host '   ⚠️  .firebaserc no existe; este diagnóstico no lo crea.' -ForegroundColor Yellow }

# RESUMEN
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "   ✅ Setup Completado" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Próximos pasos
Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. 🔐 Autenticación (si no lo has hecho):" -ForegroundColor Cyan
Write-Host "   firebase login" -ForegroundColor Gray
Write-Host "   eas login" -ForegroundColor Gray
Write-Host ""

Write-Host "2. 📱 Iniciar desarrollo:" -ForegroundColor Cyan
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""

Write-Host "3. 🧪 Testing local de Functions:" -ForegroundColor Cyan
Write-Host "   npm run emulators" -ForegroundColor Gray
Write-Host ""

Write-Host "4. 🚀 Deploy backend (cuando esté listo):" -ForegroundColor Cyan
Write-Host "   .\scripts\deploy-staging.ps1 -ProjectId furgokid-staging" -ForegroundColor Gray
Write-Host "   Para producción: .\scripts\deploy.ps1 -ProjectId furgokid" -ForegroundColor Gray
Write-Host ""

Write-Host "5. 🔍 Validar deploy:" -ForegroundColor Cyan
Write-Host "   npm run smoke:test" -ForegroundColor Gray
Write-Host ""

Write-Host "6. 📖 Documentación completa:" -ForegroundColor Cyan
Write-Host "   docs/README.md" -ForegroundColor Gray
Write-Host "   docs/QUICK_START.md" -ForegroundColor Gray
Write-Host ""

# Advertencias importantes
if ($missingFiles.Count -gt 0) {
    Write-Host "⚠️  IMPORTANTE: Faltan archivos críticos. Revisa arriba." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "✅ ¡Listo para desarrollar!" -ForegroundColor Green
Write-Host ""
