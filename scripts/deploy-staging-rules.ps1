# ============================================================================
# Firestore Rules Deployment Script (PowerShell)
# ============================================================================
# Deploy Firestore security rules to staging environment
# Usage: .\scripts\deploy-staging-rules.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔥 FurgoKid - Firestore Staging Rules Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Check if Firebase CLI is installed
try {
    $null = Get-Command firebase -ErrorAction Stop
} catch {
    Write-Host "❌ Error: Firebase CLI not installed" -ForegroundColor Red
    Write-Host "Install: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if firestore.rules exists
if (-not (Test-Path "firestore.rules")) {
    Write-Host "❌ Error: firestore.rules file not found" -ForegroundColor Red
    exit 1
}

# Login check
Write-Host ""
Write-Host "Checking Firebase authentication..." -ForegroundColor Yellow
try {
    firebase projects:list 2>&1 | Out-Null
} catch {
    Write-Host "❌ Not logged in to Firebase" -ForegroundColor Red
    Write-Host "Run: firebase login" -ForegroundColor Yellow
    exit 1
}

# List available projects
Write-Host ""
Write-Host "Available Firebase projects:" -ForegroundColor Green
firebase projects:list

# Deploy to staging
Write-Host ""
Write-Host "📤 Deploying Firestore rules to STAGING..." -ForegroundColor Yellow
Write-Host "Project: furgokid-staging" -ForegroundColor Cyan
Write-Host ""

$response = Read-Host "Continue with deployment? (y/N)"
if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 1
}

# Deploy rules only (not indexes)
Write-Host ""
Write-Host "Deploying..." -ForegroundColor Yellow
firebase deploy --only firestore:rules --project furgokid-staging

Write-Host ""
Write-Host "✅ Firestore rules deployed to staging successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Verify deployment:" -ForegroundColor Cyan
Write-Host "https://console.firebase.google.com/project/furgokid-staging/firestore/rules" -ForegroundColor Blue
