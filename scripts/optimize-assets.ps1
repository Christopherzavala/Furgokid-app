# Script de optimización de assets usando .NET System.Drawing
# Reduce tamaño de archivos manteniendo calidad visual

Add-Type -AssemblyName System.Drawing

function Optimize-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Quality = 85,
        [int]$MaxWidth = 0
    )
    
    try {
        $image = [System.Drawing.Image]::FromFile($InputPath)
        
        # Si se especifica MaxWidth, redimensionar
        if ($MaxWidth -gt 0 -and $image.Width -gt $MaxWidth) {
            $ratio = $MaxWidth / $image.Width
            $newHeight = [int]($image.Height * $ratio)
            $newImage = New-Object System.Drawing.Bitmap($MaxWidth, $newHeight)
            $graphics = [System.Drawing.Graphics]::FromImage($newImage)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($image, 0, 0, $MaxWidth, $newHeight)
            $image.Dispose()
            $image = $newImage
            $graphics.Dispose()
        }
        
        # Configurar encoder con calidad específica
        $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | 
            Where-Object { $_.MimeType -eq 'image/png' }
        
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
            [System.Drawing.Imaging.Encoder]::Quality, $Quality
        )
        
        # Guardar imagen optimizada
        $image.Save($OutputPath, $encoder, $encoderParams)
        $image.Dispose()
        
        # Obtener tamaños
        $originalSize = (Get-Item $InputPath).Length / 1KB
        $newSize = (Get-Item $OutputPath).Length / 1KB
        $savings = [math]::Round((($originalSize - $newSize) / $originalSize) * 100, 2)
        
        Write-Host "✅ Optimizado: $(Split-Path $InputPath -Leaf)" -ForegroundColor Green
        Write-Host "   Antes: $([math]::Round($originalSize, 2))KB → Después: $([math]::Round($newSize, 2))KB (Ahorro: $savings%)" -ForegroundColor Cyan
        
        return $true
    }
    catch {
        Write-Host "❌ Error optimizando $InputPath : $_" -ForegroundColor Red
        return $false
    }
}

function Resize-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )
    
    try {
        $image = [System.Drawing.Image]::FromFile($InputPath)
        $newImage = New-Object System.Drawing.Bitmap($Width, $Height)
        $graphics = [System.Drawing.Graphics]::FromImage($newImage)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($image, 0, 0, $Width, $Height)
        
        $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | 
            Where-Object { $_.MimeType -eq 'image/png' }
        
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
            [System.Drawing.Imaging.Encoder]::Quality, 90
        )
        
        $newImage.Save($OutputPath, $encoder, $encoderParams)
        $image.Dispose()
        $newImage.Dispose()
        $graphics.Dispose()
        
        Write-Host "✅ Redimensionado: $(Split-Path $OutputPath -Leaf) → ${Width}x${Height}px" -ForegroundColor Green
        
        return $true
    }
    catch {
        Write-Host "❌ Error redimensionando $InputPath : $_" -ForegroundColor Red
        return $false
    }
}

# Banner
Write-Host "`n🎨 OPTIMIZACIÓN DE ASSETS - FURGOKID" -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta
Write-Host ""

$baseDir = Resolve-Path "$PSScriptRoot\..\assets"

# 1. Optimizar icon.png (439KB → ~100KB target)
Write-Host "📦 Optimizando icon.png..." -ForegroundColor Yellow
Optimize-Image -InputPath "$baseDir\original\icon.png" -OutputPath "$baseDir\icon.png" -Quality 90

# 2. Optimizar adaptive-icon.png
Write-Host "`n📦 Optimizando adaptive-icon.png..." -ForegroundColor Yellow
Optimize-Image -InputPath "$baseDir\original\adaptive-icon.png" -OutputPath "$baseDir\adaptive-icon.png" -Quality 90

# 3. Optimizar splash.png (912KB → ~250KB target)
Write-Host "`n📦 Optimizando splash.png..." -ForegroundColor Yellow
Optimize-Image -InputPath "$baseDir\original\splash.png" -OutputPath "$baseDir\splash.png" -Quality 85

# 4. Optimizar logo.png
Write-Host "`n📦 Optimizando logo.png..." -ForegroundColor Yellow
Optimize-Image -InputPath "$baseDir\original\logo.png" -OutputPath "$baseDir\logo.png" -Quality 90

# 5. Optimizar bus-render.png
Write-Host "`n📦 Optimizando bus-render.png..." -ForegroundColor Yellow
Optimize-Image -InputPath "$baseDir\original\bus-render.png" -OutputPath "$baseDir\bus-render.png" -Quality 85

# 6. Optimizar favicon.png
Write-Host "`n📦 Optimizando favicon.png..." -ForegroundColor Yellow
Optimize-Image -InputPath "$baseDir\original\favicon.png" -OutputPath "$baseDir\favicon.png" -Quality 90

# 7. Crear versiones para redes sociales
Write-Host "`n📱 Creando versiones para redes sociales..." -ForegroundColor Yellow

# Icon para redes sociales (512x512px)
Resize-Image -InputPath "$baseDir\original\icon.png" -OutputPath "$baseDir\icon-social.png" -Width 512 -Height 512

# Favicon real 32x32px
Resize-Image -InputPath "$baseDir\original\icon.png" -OutputPath "$baseDir\favicon-32.png" -Width 32 -Height 32

# Logo versión cuadrada para Instagram (1080x1080px)
Resize-Image -InputPath "$baseDir\original\logo.png" -OutputPath "$baseDir\logo-square.png" -Width 1080 -Height 1080

# Resumen final
Write-Host "`n`n📊 RESUMEN DE OPTIMIZACIÓN" -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta

$originalTotal = (Get-ChildItem "$baseDir\original" | Measure-Object -Property Length -Sum).Sum / 1KB
$newTotal = (Get-ChildItem "$baseDir" -File -Include *.png,*.jpg | Where-Object { $_.DirectoryName -eq (Resolve-Path $baseDir).Path } | Measure-Object -Property Length -Sum).Sum / 1KB
$totalSavings = [math]::Round((($originalTotal - $newTotal) / $originalTotal) * 100, 2)

Write-Host "Tamaño original: $([math]::Round($originalTotal, 2))KB" -ForegroundColor White
Write-Host "Tamaño optimizado: $([math]::Round($newTotal, 2))KB" -ForegroundColor Green
Write-Host "Ahorro total: $([math]::Round($originalTotal - $newTotal, 2))KB ($totalSavings%)" -ForegroundColor Cyan

Write-Host "`n✅ Optimización completada con éxito!" -ForegroundColor Green
Write-Host ""
