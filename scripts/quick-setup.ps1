# 🚀 Quick Setup Script - Furgokid
# Automatiza el setup inicial del proyecto

param(
    [switch]$SkipInstall,
    [switch]$ConfigureOnly
)

$ErrorActionPreference = "Stop"

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
    Write-Host "   ⚠️  Firebase CLI no instalado" -ForegroundColor Yellow
    Write-Host "   Instalando..." -ForegroundColor Cyan
    npm install -g firebase-tools
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Firebase CLI instalado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error instalando Firebase CLI" -ForegroundColor Red
        exit 1
    }
}

# 3. Verificar EAS CLI
Write-Host ""
Write-Host "3️⃣  Verificando EAS CLI..." -ForegroundColor Yellow

try {
    $easVersion = eas --version
    Write-Host "   ✅ EAS CLI: $easVersion" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  EAS CLI no instalado" -ForegroundColor Yellow
    Write-Host "   Instalando..." -ForegroundColor Cyan
    npm install -g eas-cli
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ EAS CLI instalado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error instalando EAS CLI" -ForegroundColor Red
        exit 1
    }
}

if ($ConfigureOnly) {
    Write-Host ""
    Write-Host "✅ Herramientas verificadas. Saliendo (--ConfigureOnly)." -ForegroundColor Green
    exit 0
}

# 4. Instalar dependencias del proyecto
if (-not $SkipInstall) {
    Write-Host ""
    Write-Host "4️⃣  Instalando dependencias del proyecto..." -ForegroundColor Yellow
    
    npm install
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
        npm install
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
    Write-Host "⏭️  Saltando instalación de dependencias (--SkipInstall)" -ForegroundColor Yellow
}

# 6. Configurar Husky
Write-Host ""
Write-Host "6️⃣  Configurando Husky..." -ForegroundColor Yellow

if (Test-Path ".husky") {
    Write-Host "   ✅ Husky ya configurado" -ForegroundColor Green
} else {
    npm run prepare
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Husky configurado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Error configurando Husky (no crítico)" -ForegroundColor Yellow
    }
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

# 8. Verificar serviceAccountKey.json
Write-Host ""
Write-Host "8️⃣  Verificando serviceAccountKey.json..." -ForegroundColor Yellow

if (Test-Path "serviceAccountKey.json") {
    Write-Host "   ✅ serviceAccountKey.json encontrado" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  serviceAccountKey.json NO encontrado" -ForegroundColor Yellow
    Write-Host "   Necesario para:" -ForegroundColor Cyan
    Write-Host "   - Scripts de monitoring (monitor-health.js)" -ForegroundColor Cyan
    Write-Host "   - Testing local de Functions" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Descarga desde Firebase Console:" -ForegroundColor Cyan
    Write-Host "   https://console.firebase.google.com/project/furgokid/settings/serviceaccounts/adminsdk" -ForegroundColor Cyan
}

# 9. Verificar configuración de Firebase
Write-Host ""
Write-Host "9️⃣  Verificando configuración de Firebase..." -ForegroundColor Yellow

try {
    $firebaseProject = firebase use | Out-String
    Write-Host "   ✅ Proyecto Firebase: $firebaseProject" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  No estás autenticado en Firebase" -ForegroundColor Yellow
    Write-Host "   Ejecuta: firebase login" -ForegroundColor Cyan
}

# 10. Crear directorios necesarios
Write-Host ""
Write-Host "🔟  Creando directorios necesarios..." -ForegroundColor Yellow

$directories = @(
    "docs/logs",
    "backups",
    "assets/screenshots"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   ✅ Creado: $dir" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Existe: $dir" -ForegroundColor Green
    }
}

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
Write-Host "   cd functions && npm ci && cd .." -ForegroundColor Gray
Write-Host "   firebase deploy --only functions" -ForegroundColor Gray
Write-Host ""

Write-Host "5. 🔍 Validar deploy:" -ForegroundColor Cyan
Write-Host "   npm run smoke:test" -ForegroundColor Gray
Write-Host ""

Write-Host "6. 📖 Documentación completa:" -ForegroundColor Cyan
Write-Host "   docs/README.md" -ForegroundColor Gray
Write-Host "   docs/QUICK_START.md" -ForegroundColor Gray
Write-Host ""

# Advertencias importantes
if (-not (Test-Path "serviceAccountKey.json")) {
    Write-Host "⚠️  IMPORTANTE: Descarga serviceAccountKey.json antes de usar scripts de monitoring" -ForegroundColor Yellow
    Write-Host ""
}

if ($missingFiles.Count -gt 0) {
    Write-Host "⚠️  IMPORTANTE: Faltan archivos críticos. Revisa arriba." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "✅ ¡Listo para desarrollar!" -ForegroundColor Green
Write-Host ""
