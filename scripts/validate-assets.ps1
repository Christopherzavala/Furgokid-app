# Script de Validación de Assets Optimizados
# Verifica que todos los assets cumplan con los targets de tamaño y dimensiones

Write-Host "`n🔍 VALIDACIÓN DE ASSETS - FURGOKID" -ForegroundColor Magenta
Write-Host "====================================" -ForegroundColor Magenta
Write-Host ""

$assetsPath = "$PSScriptRoot\..\assets"
$hasErrors = $false
$warnings = @()
$successes = @()

# Función para validar asset
function Test-Asset {
    param(
        [string]$FileName,
        [int]$MaxSizeKB,
        [int]$MinWidth = 0,
        [int]$MinHeight = 0,
        [bool]$Required = $true
    )
    
    $filePath = Join-Path $assetsPath $FileName
    
    if (-not (Test-Path $filePath)) {
        if ($Required) {
            Write-Host "❌ FALTA: $FileName" -ForegroundColor Red
            $script:hasErrors = $true
        } else {
            Write-Host "⚠️  OPCIONAL: $FileName (no encontrado)" -ForegroundColor Yellow
            $script:warnings += "Asset opcional no encontrado: $FileName"
        }
        return
    }
    
    # Verificar tamaño
    $fileSize = (Get-Item $filePath).Length / 1KB
    $sizeOk = $fileSize -le $MaxSizeKB
    
    # Verificar dimensiones si es imagen
    $dimensionsOk = $true
    $dimensionsText = ""
    
    if ($FileName -match '\.(png|jpg|jpeg)$') {
        try {
            Add-Type -AssemblyName System.Drawing
            $img = [System.Drawing.Image]::FromFile($filePath)
            $width = $img.Width
            $height = $img.Height
            $img.Dispose()
            
            $dimensionsText = " ${width}x${height}px"
            
            if ($MinWidth -gt 0 -and $width -lt $MinWidth) {
                $dimensionsOk = $false
            }
            if ($MinHeight -gt 0 -and $height -lt $MinHeight) {
                $dimensionsOk = $false
            }
        }
        catch {
            $dimensionsText = " (dimensiones no verificables)"
        }
    }
    
    # Status
    if ($sizeOk -and $dimensionsOk) {
        Write-Host "✅ $FileName" -ForegroundColor Green -NoNewline
        Write-Host " - $([math]::Round($fileSize, 1))KB$dimensionsText" -ForegroundColor Cyan
        $script:successes += $FileName
    }
    elseif (-not $sizeOk) {
        Write-Host "❌ $FileName" -ForegroundColor Red -NoNewline
        Write-Host " - $([math]::Round($fileSize, 1))KB (excede $MaxSizeKB KB)$dimensionsText" -ForegroundColor Red
        $script:hasErrors = $true
    }
    else {
        Write-Host "❌ $FileName" -ForegroundColor Red -NoNewline
        Write-Host " - Dimensiones incorrectas$dimensionsText (mínimo ${MinWidth}x${MinHeight}px)" -ForegroundColor Red
        $script:hasErrors = $true
    }
}

# VALIDAR ASSETS CORE (OBLIGATORIOS)
Write-Host "📱 ASSETS CORE:" -ForegroundColor Yellow
Write-Host ""

Test-Asset -FileName "icon.png" -MaxSizeKB 120 -MinWidth 512 -MinHeight 512 -Required $true
Test-Asset -FileName "adaptive-icon.png" -MaxSizeKB 120 -MinWidth 512 -MinHeight 512 -Required $true
Test-Asset -FileName "splash.png" -MaxSizeKB 300 -MinWidth 1080 -MinHeight 1920 -Required $true
Test-Asset -FileName "logo.png" -MaxSizeKB 100 -MinWidth 200 -MinHeight 0 -Required $true
Test-Asset -FileName "favicon.png" -MaxSizeKB 80 -MinWidth 32 -MinHeight 32 -Required $true

Write-Host ""
Write-Host "🎨 ASSETS SECUNDARIOS:" -ForegroundColor Yellow
Write-Host ""

Test-Asset -FileName "bus-render.png" -MaxSizeKB 250 -MinWidth 0 -MinHeight 0 -Required $true
Test-Asset -FileName "brand-image.jpg" -MaxSizeKB 150 -MinWidth 0 -MinHeight 0 -Required $false

Write-Host ""
Write-Host "📱 ASSETS REDES SOCIALES:" -ForegroundColor Yellow
Write-Host ""

Test-Asset -FileName "icon-social.png" -MaxSizeKB 100 -MinWidth 512 -MinHeight 512 -Required $false
Test-Asset -FileName "favicon-32.png" -MaxSizeKB 10 -MinWidth 32 -MinHeight 32 -Required $false
Test-Asset -FileName "logo-square.png" -MaxSizeKB 200 -MinWidth 1080 -MinHeight 1080 -Required $false

Write-Host ""
Write-Host "🏪 ASSETS PLAY STORE:" -ForegroundColor Yellow
Write-Host ""

Test-Asset -FileName "og-image.png" -MaxSizeKB 300 -MinWidth 1200 -MinHeight 630 -Required $false
Test-Asset -FileName "feature-graphic.png" -MaxSizeKB 200 -MinWidth 1024 -MinHeight 500 -Required $false

# Verificar screenshots
$screenshotsPath = Join-Path $assetsPath "screenshots"
if (Test-Path $screenshotsPath) {
    $screenshots = Get-ChildItem $screenshotsPath -Filter "*.png"
    Write-Host ""
    Write-Host "📸 SCREENSHOTS:" -ForegroundColor Yellow
    Write-Host ""
    
    if ($screenshots.Count -eq 0) {
        Write-Host "⚠️  No se encontraron screenshots (mínimo 2 requeridos)" -ForegroundColor Yellow
        $warnings += "Faltan screenshots para Play Store (mínimo 2)"
    }
    elseif ($screenshots.Count -lt 2) {
        Write-Host "⚠️  Solo $($screenshots.Count) screenshot(s) encontrado(s) (mínimo 2 requeridos)" -ForegroundColor Yellow
        $warnings += "Insuficientes screenshots (mínimo 2, recomendado 4-8)"
    }
    else {
        Write-Host "✅ $($screenshots.Count) screenshots encontrados" -ForegroundColor Green
        
        foreach ($screenshot in $screenshots) {
            $size = $screenshot.Length / 1KB
            
            try {
                Add-Type -AssemblyName System.Drawing
                $img = [System.Drawing.Image]::FromFile($screenshot.FullName)
                $width = $img.Width
                $height = $img.Height
                $img.Dispose()
                
                if ($width -ge 1080 -and $height -ge 1920) {
                    Write-Host "  ✅ $($screenshot.Name) - $([math]::Round($size, 1))KB ${width}x${height}px" -ForegroundColor Green
                }
                else {
                    Write-Host "  ⚠️  $($screenshot.Name) - Dimensiones pequeñas ${width}x${height}px (mín 1080x1920)" -ForegroundColor Yellow
                    $warnings += "Screenshot $($screenshot.Name) tiene dimensiones menores a 1080x1920px"
                }
            }
            catch {
                Write-Host "  ⚠️  $($screenshot.Name) - No se pudo verificar" -ForegroundColor Yellow
            }
        }
    }
}
else {
    Write-Host "⚠️  Carpeta screenshots/ no encontrada" -ForegroundColor Yellow
    $warnings += "Falta carpeta /assets/screenshots"
}

# RESUMEN
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "📊 RESUMEN DE VALIDACIÓN" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host ""

# Calcular tamaño total
$allAssets = Get-ChildItem $assetsPath -File -Include *.png,*.jpg,*.jpeg -Recurse | 
    Where-Object { $_.DirectoryName -notmatch 'original' }
$totalSize = ($allAssets | Measure-Object -Property Length -Sum).Sum / 1KB

Write-Host "Assets validados: $($successes.Count)" -ForegroundColor Green
Write-Host "Errores: $(if($hasErrors) { 'SÍ' } else { 'NO' })" -ForegroundColor $(if($hasErrors) { 'Red' } else { 'Green' })
Write-Host "Advertencias: $($warnings.Count)" -ForegroundColor $(if($warnings.Count -gt 0) { 'Yellow' } else { 'Green' })
Write-Host "Tamaño total: $([math]::Round($totalSize, 2))KB ($([math]::Round($totalSize / 1024, 2))MB)" -ForegroundColor Cyan
Write-Host ""

# Mostrar advertencias
if ($warnings.Count -gt 0) {
    Write-Host "⚠️  ADVERTENCIAS:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Benchmark vs target
$targetSize = 800 # KB (0.78MB)
if ($totalSize -le $targetSize) {
    $savings = [math]::Round((($targetSize - $totalSize) / $targetSize) * 100, 2)
    Write-Host "🎉 OBJETIVO CUMPLIDO: Assets optimizados ≤ ${targetSize}KB" -ForegroundColor Green
    Write-Host "   Ahorro adicional: $([math]::Round($targetSize - $totalSize, 2))KB ($savings% mejor que target)" -ForegroundColor Green
}
elseif ($totalSize -le 1500) {
    Write-Host "✅ BUENO: Assets dentro de rango aceptable (<1.5MB)" -ForegroundColor Green
}
else {
    Write-Host "⚠️  REVISAR: Assets exceden target de optimización" -ForegroundColor Yellow
    Write-Host "   Target: ${targetSize}KB, Actual: $([math]::Round($totalSize, 2))KB" -ForegroundColor Yellow
}

Write-Host ""

# Status final
if ($hasErrors) {
    Write-Host "❌ VALIDACIÓN FALLIDA - Corrige los errores arriba" -ForegroundColor Red
    exit 1
}
elseif ($warnings.Count -gt 0) {
    Write-Host "⚠️  VALIDACIÓN OK CON ADVERTENCIAS - Revisa las advertencias" -ForegroundColor Yellow
    exit 0
}
else {
    Write-Host "✅ VALIDACIÓN EXITOSA - Todos los assets optimizados correctamente" -ForegroundColor Green
    exit 0
}
