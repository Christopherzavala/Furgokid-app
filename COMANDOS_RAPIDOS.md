# QUICK REFERENCE - Comandos Útiles

## Validar estado actual de assets:

```powershell
Get-ChildItem assets -File -Include *.png,*.jpg | Where-Object { $_.DirectoryName -notmatch 'original' } | Select-Object Name, @{Name='KB';Expression={[math]::Round($_.Length/1KB,1)}} | Format-Table -AutoSize
```

## Ver tamaño total:

```powershell
$total = (Get-ChildItem assets -File -Include *.png,*.jpg | Where-Object { $_.DirectoryName -notmatch 'original' } | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Total assets: $([math]::Round($total, 2))MB"
```

## Iniciar emulador para screenshots:

```powershell
npx expo start --android
```

## Abrir TinyPNG:

```
https://tinypng.com
```

## Abrir Canva:

```
https://www.canva.com
```

## Commit cuando termines:

```powershell
git add assets/
git status
git commit -m "feat(assets): optimize images and add store listing assets"
git push origin fix/stabilize-startup-cz
```
