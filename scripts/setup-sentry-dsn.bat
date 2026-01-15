@echo off
echo.
echo ========================================
echo  Configurando SENTRY_DSN en EAS
echo ========================================
echo.

echo Tu DSN de Sentry:
echo https://YOUR_DSN@o123.ingest.sentry.io/1234567
echo.

echo Ejecutando comando...
echo.

call eas env:create --name SENTRY_DSN --value "PASTE_YOUR_DSN_HERE" --scope project --visibility secret

echo.
echo ========================================
echo Verificando configuración...
echo ========================================
echo.

call eas env:list

echo.
echo LISTO! Sentry DSN configurado.
echo.
pause
