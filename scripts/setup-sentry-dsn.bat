@echo off
echo.
echo ========================================
echo  Configurando SENTRY_DSN en EAS
echo ========================================
echo.

echo Tu DSN de Sentry:
echo https://c87e2f9ecae7cda95071794487ae92d9@o4510621040574464.ingest.us.sentry.io/4510621106176000
echo.

echo Ejecutando comando...
echo.

call eas env:create --name SENTRY_DSN --value "https://c87e2f9ecae7cda95071794487ae92d9@o4510621040574464.ingest.us.sentry.io/4510621106176000" --scope project --visibility secret

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
