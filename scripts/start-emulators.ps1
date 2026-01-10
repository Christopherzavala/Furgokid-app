# Firebase Emulators Startup Script
# Inicia emulators y seed data automaticamente

Write-Host "Starting Firebase Emulators with Seed Data" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar firebase.json existe
if (!(Test-Path "firebase.json")) {
    Write-Host "Error: firebase.json not found" -ForegroundColor Red
    Write-Host "   Run from project root" -ForegroundColor Yellow
    exit 1
}

# Verificar Firebase CLI
try {
    $firebaseVersion = firebase --version
    Write-Host "Firebase CLI: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "Firebase CLI not installed" -ForegroundColor Red
    Write-Host "   Install: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Verificar Java 21+
Write-Host ""
Write-Host "Checking Java version..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-String -Pattern "version" | Select-Object -First 1
    if ($javaVersion -match '"(\d+)\.') {
        $majorVersion = [int]$Matches[1]
        if ($majorVersion -lt 21) {
            Write-Host "ERROR: Java $majorVersion found, but Firebase requires Java 21+" -ForegroundColor Red
            Write-Host ""
            Write-Host "Install Java 21:" -ForegroundColor Yellow
            Write-Host "   Option 1 (Chocolatey): choco install openjdk21" -ForegroundColor Cyan
            Write-Host "   Option 2 (Manual): https://adoptium.net/temurin/releases/" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "After installation, restart your terminal and try again." -ForegroundColor Yellow
            exit 1
        }
        Write-Host "Java version: $majorVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "ERROR: Java not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install Java 21:" -ForegroundColor Yellow
    Write-Host "   Option 1 (Chocolatey): choco install openjdk21" -ForegroundColor Cyan
    Write-Host "   Option 2 (Manual): https://adoptium.net/temurin/releases/" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Kill existing emulator processes
Write-Host ""
Write-Host "Cleaning up old processes..." -ForegroundColor Yellow

$ports = @(4000, 5001, 8080, 9099)
foreach ($port in $ports) {
    try {
        $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connection) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Stop-Process -Id $process.Id -Force
                Write-Host "   Killed process on port $port" -ForegroundColor Green
            }
        }
    } catch {
        # Port not in use, ignore
    }
}

# Start emulators in background
Write-Host ""
Write-Host "Starting Firebase Emulators..." -ForegroundColor Cyan

Start-Job -Name "FirebaseEmulators" -ScriptBlock {
    Set-Location $using:PWD
    firebase emulators:start --import=./emulator-data --export-on-exit
} | Out-Null

# Wait for emulators to start
Write-Host "   Waiting for emulators to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if UI is up
$maxRetries = 10
$retries = 0
while ($retries -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4000" -Method Head -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "   Emulators UI running on http://localhost:4000" -ForegroundColor Green
            break
        }
    } catch {
        $retries++
        Start-Sleep -Seconds 2
    }
}

if ($retries -eq $maxRetries) {
    Write-Host "   Warning: Could not verify emulators started" -ForegroundColor Yellow
    Write-Host "   Check manually: http://localhost:4000" -ForegroundColor Yellow
}

# Seed data
Write-Host ""
Write-Host "Seeding test data..." -ForegroundColor Cyan

# Install dependencies if needed
if (!(Test-Path "functions/node_modules")) {
    Write-Host "   Installing dependencies first..." -ForegroundColor Yellow
    Set-Location functions
    npm install | Out-Null
    Set-Location ..
}

# Run seed script
node scripts/seed-emulators.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Seed script had issues" -ForegroundColor Yellow
    Write-Host "   Emulators are still running" -ForegroundColor Yellow
}

# Display info
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "EMULATORS RUNNING" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dashboard: http://localhost:4000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Endpoints:" -ForegroundColor Yellow
Write-Host "   Firestore: localhost:8080" -ForegroundColor Cyan
Write-Host "   Auth: localhost:9099" -ForegroundColor Cyan
Write-Host "   Functions: localhost:5001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Users:" -ForegroundColor Yellow
Write-Host "   maria.garcia@example.com / password123 (Parent)" -ForegroundColor Cyan
Write-Host "   carlos.rodriguez@example.com / password123 (Driver)" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop: Press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Keep script running
Write-Host "Press Ctrl+C to stop emulators..." -ForegroundColor Gray
try {
    # Wait for job to finish (never, unless killed)
    Wait-Job -Name "FirebaseEmulators"
} catch {
    Write-Host ""
    Write-Host "Stopping emulators..." -ForegroundColor Yellow
    Stop-Job -Name "FirebaseEmulators"
    Remove-Job -Name "FirebaseEmulators"
    Write-Host "Emulators stopped" -ForegroundColor Green
}
