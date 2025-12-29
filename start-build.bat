@echo off
echo.
echo =============================================
echo   INICIANDO BUILD DE ANDROID CON EAS
echo =============================================
echo.

echo Verificando usuario...
call eas whoami

echo.
echo Commit actual:
git log --oneline -1

echo.
echo Lanzando build (esto puede tardar varios minutos)...
call eas build --platform android --profile preview --clear-cache

echo.
echo =============================================
echo   BUILD INICIADO
echo =============================================
echo.
echo Verifica el progreso en:
echo https://expo.dev/accounts/christopher69/projects/furgokid/builds
echo.
pause
