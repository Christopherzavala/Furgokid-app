#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Verifica todas las implementaciones de HIGH PRIORITY + CRITICAL
.DESCRIPTION
    Chequea configuración de Sentry, AdMob, Firebase, Privacy Policy, etc.
#>

Write-Host "🔍 VERIFICACIÓN DE IMPLEMENTACIONES" -ForegroundColor Cyan
Write-Host "=" * 80

$errors = @()
$warnings = @()
$success = @()

# ============================================================================
# 1. SENTRY CONFIGURATION
# ============================================================================
Write-Host "`n📊 1. SENTRY ERROR TRACKING" -ForegroundColor Yellow

# Check package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
if ($packageJson.dependencies.'@sentry/react-native') {
    $success += "✅ @sentry/react-native instalado ($($packageJson.dependencies.'@sentry/react-native'))"
} else {
    $errors += "❌ @sentry/react-native NO encontrado en package.json"
}

# Check App.js initialization
$appJs = Get-Content "App.js" -Raw
if ($appJs -match "import.*initSentry.*from.*sentry") {
    $success += "✅ initSentry importado en App.js"
} else {
    $errors += "❌ initSentry NO importado en App.js"
}

if ($appJs -match "initSentry\(\)") {
    $success += "✅ initSentry() llamado en App.js"
} else {
    $errors += "❌ initSentry() NO llamado en App.js"
}

# Check sentry.ts config
if (Test-Path "src/config/sentry.ts") {
    $success += "✅ src/config/sentry.ts existe"
    
    $sentryConfig = Get-Content "src/config/sentry.ts" -Raw
    if ($sentryConfig -match "import.*\*.*as.*Sentry.*from.*@sentry/react-native") {
        $success += "✅ Sentry import correcto (no placeholder)"
    } else {
        $errors += "❌ Sentry import incorrecto o placeholder"
    }
} else {
    $errors += "❌ src/config/sentry.ts NO existe"
}

# Check eas.json
$easJson = Get-Content "eas.json" -Raw | ConvertFrom-Json
if ($easJson.build.production.env.PSObject.Properties.Name -contains "SENTRY_DSN") {
    $warnings += "⚠️ SENTRY_DSN hardcodeado en eas.json (recomendado mover a EAS Secrets)"
} else {
    $success += "✅ SENTRY_DSN no está hardcodeado en eas.json (usa Secrets/env)"
}

# Check app.config.js
$appConfig = Get-Content "app.config.js" -Raw
if ($appConfig -match "SENTRY_DSN.*process\.env\.SENTRY_DSN") {
    $success += "✅ SENTRY_DSN en app.config.js extra"
} else {
    $warnings += "⚠️ SENTRY_DSN no expuesto en app.config.js extra"
}

# Check .env
if (Test-Path ".env") {
    $env = Get-Content ".env" -Raw
    if ($env -match "SENTRY_DSN=") {
        $success += "✅ SENTRY_DSN en .env"
    } else {
        $warnings += "⚠️ SENTRY_DSN no en .env (opcional en dev)"
    }
}

# ============================================================================
# 2. ADMOB CONFIGURATION
# ============================================================================
Write-Host "`n💰 2. ADMOB MONETIZATION" -ForegroundColor Yellow

if (
    ($appConfig -match "process\.env\.ADMOB_ANDROID_APP_ID") -and
    ($appConfig -match "process\.env\.ADMOB_IOS_APP_ID") -and
    ($appConfig -match "process\.env\.BANNER_AD_UNIT_ID") -and
    ($appConfig -match "process\.env\.INTERSTITIAL_AD_UNIT_ID") -and
    ($appConfig -match "process\.env\.REWARDED_AD_UNIT_ID")
) {
    $success += "✅ AdMob IDs configurados via env en app.config.js"
} else {
    $warnings += "⚠️ AdMob env vars incompletas en app.config.js (revisar wiring de IDs)"
}

if (Test-Path "src/services/admobService.ts") {
    $admobService = Get-Content "src/services/admobService.ts" -Raw
    if ($admobService -match "admobBannerAdUnitIdAndroid" -and $admobService -match "admobInterstitialAdUnitIdAndroid") {
        $success += "✅ admobService.ts usa IDs via expo.extra (sin hardcode)"
    } else {
        $warnings += "⚠️ admobService.ts no parece leer IDs desde expo.extra"
    }
}

# ============================================================================
# 3. PRIVACY POLICY
# ============================================================================
Write-Host "`n📄 3. PRIVACY POLICY" -ForegroundColor Yellow

if ($appConfig -match "christopherzavala\.github\.io/Furgokid-app/docs/PRIVACY_POLICY") {
    $success += "✅ Privacy Policy URL configurada (GitHub Pages)"
} else {
    $warnings += "⚠️ Privacy Policy URL no apunta a GitHub Pages"
}

if (Test-Path "docs/PRIVACY_POLICY.md") {
    $success += "✅ docs/PRIVACY_POLICY.md existe"
} else {
    $errors += "❌ docs/PRIVACY_POLICY.md NO existe"
}

if (Test-Path "docs/privacy-policy.html") {
    $success += "✅ docs/privacy-policy.html existe"
} else {
    $warnings += "⚠️ docs/privacy-policy.html NO existe (opcional)"
}

# ============================================================================
# 4. FIREBASE CONFIGURATION
# ============================================================================
Write-Host "`n🔥 4. FIREBASE" -ForegroundColor Yellow

if (Test-Path "firestore.rules") {
    $rules = Get-Content "firestore.rules" -Raw
    if ($rules -match "isAuthenticated|hasRole") {
        $success += "✅ firestore.rules con role-based security"
    } else {
        $warnings += "⚠️ firestore.rules sin helper functions"
    }
} else {
    $errors += "❌ firestore.rules NO existe"
}

if (Test-Path "firestore.indexes.json") {
    $indexes = Get-Content "firestore.indexes.json" -Raw | ConvertFrom-Json
    $indexCount = $indexes.indexes.Count
    if ($indexCount -gt 0) {
        $success += "✅ firestore.indexes.json con $indexCount indexes"
    } else {
        $warnings += "⚠️ firestore.indexes.json sin indexes"
    }
} else {
    $errors += "❌ firestore.indexes.json NO existe"
}

if (Test-Path "firebase.json") {
    $success += "✅ firebase.json existe"
} else {
    $warnings += "⚠️ firebase.json NO existe (necesario para deploy)"
}

if (Test-Path ".firebaserc") {
    $success += "✅ .firebaserc existe"
} else {
    $warnings += "⚠️ .firebaserc NO existe (necesario para deploy)"
}

# ============================================================================
# 5. HIGH PRIORITY FEATURES
# ============================================================================
Write-Host "`n🚀 5. HIGH PRIORITY FEATURES" -ForegroundColor Yellow

$features = @(
    @{File="src/utils/retryUtils.ts"; Name="Error Retry Logic"},
    @{File="src/components/LoadingSkeleton.tsx"; Name="Loading Skeletons"},
    @{File="src/components/OptimizedImage.tsx"; Name="Image Optimization"},
    @{File="src/components/Onboarding.tsx"; Name="User Onboarding"},
    @{File="src/utils/offlineCache.ts"; Name="Offline Support"}
)

foreach ($feature in $features) {
    if (Test-Path $feature.File) {
        $success += "✅ $($feature.Name) implementado"
    } else {
        $errors += "❌ $($feature.Name) NO implementado"
    }
}

# Check react-native-fast-image
if ($packageJson.dependencies.'react-native-fast-image') {
    $success += "✅ react-native-fast-image instalado"
} else {
    $warnings += "⚠️ react-native-fast-image NO instalado"
}

# ============================================================================
# 6. ACCESSIBILITY
# ============================================================================
Write-Host "`n♿ 6. ACCESSIBILITY" -ForegroundColor Yellow

$screens = @("src/screens/LoginScreen.js", "src/components/ConsentModal.tsx")
$accessibilityCount = 0

foreach ($screen in $screens) {
    if (Test-Path $screen) {
        $content = Get-Content $screen -Raw
        if ($content -match "accessibilityLabel") {
            $accessibilityCount++
        }
    }
}

if ($accessibilityCount -eq $screens.Count) {
    $success += "✅ Accessibility labels en $accessibilityCount screens"
} else {
    $warnings += "⚠️ Accessibility labels solo en $accessibilityCount/$($screens.Count) screens"
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "📊 RESUMEN" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan

Write-Host "`n✅ ÉXITOS ($($success.Count)):" -ForegroundColor Green
foreach ($s in $success) {
    Write-Host "  $s" -ForegroundColor Green
}

if ($warnings.Count -gt 0) {
    Write-Host "`n⚠️ ADVERTENCIAS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($w in $warnings) {
        Write-Host "  $w" -ForegroundColor Yellow
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`n❌ ERRORES ($($errors.Count)):" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "  $e" -ForegroundColor Red
    }
}

# Calculate score
$total = $success.Count + $warnings.Count + $errors.Count
$score = [math]::Round(($success.Count / $total) * 100, 1)

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "SCORE: $score% ($($success.Count)/$total checks passed)" -ForegroundColor $(if ($score -ge 90) { "Green" } elseif ($score -ge 75) { "Yellow" } else { "Red" })
Write-Host ("=" * 80) -ForegroundColor Cyan

if ($errors.Count -gt 0) {
    exit 1
} else {
    exit 0
}
