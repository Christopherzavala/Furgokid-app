@echo off
setlocal enableextensions

rem Change to repo root (this script lives in scripts\)
cd /d "%~dp0"
cd ..

set "TRASH_DIR=docs\root-trash"
if not exist "%TRASH_DIR%" mkdir "%TRASH_DIR%"

rem List of root docs to move out of the root
set FILES=
set FILES=%FILES% ADMOB_IMPLEMENTATION_READY.md
set FILES=%FILES% ADMOB_RESPUESTAS_USUARIO.md
set FILES=%FILES% ADMOB_SETUP.md
set FILES=%FILES% ADMOB_STRATEGY_COMPLETA.md
set FILES=%FILES% ADMOB_VISUAL_SUMMARY.txt
set FILES=%FILES% AUDITORÍA_FINAL_SUMARIO.txt
set FILES=%FILES% AUDITORÍA_RESUMEN_TÉCNICO.md
set FILES=%FILES% AUDITORÍA_VISUAL_SUMMARY.txt
set FILES=%FILES% CHECKLIST_POST_AUDITORIA.md
set FILES=%FILES% CODIGO_AUDIT_REPORTE.md
set FILES=%FILES% DESARROLLO_LOCAL.md
set FILES=%FILES% ERRORES-CORREGIDOS.md
set FILES=%FILES% FINALIZACION_MVP.md
set FILES=%FILES% FIXES_APLICADOS.md
set FILES=%FILES% IMPLEMENTACION_COMPLETADA.md
set FILES=%FILES% INICIO_AQUI.txt
set FILES=%FILES% INSTRUCCIONES_PRODUCTION_BUILD.md
set FILES=%FILES% MASTER_CHECKLIST.md
set FILES=%FILES% MVP_COMPLETADO.md
set FILES=%FILES% PRIVACY_POLICY.md
set FILES=%FILES% README-CONFIGURACION.md
set FILES=%FILES% README_AUDITORÍA.md
set FILES=%FILES% README_MVP_SUMMARY.md
set FILES=%FILES% README_SENIOR_ULTRA.md
set FILES=%FILES% REFERENCIA_RAPIDA_FIXES.md
set FILES=%FILES% REPARACION_COMPLETADA.md
set FILES=%FILES% REPORTE_REPARACION.md
set FILES=%FILES% SUMMARY.txt
set FILES=%FILES% TESTING.md

set MOVED_COUNT=0
for %%F in (%FILES%) do (
  if exist "%%~F" (
    echo Moving "%%~F" -> "%TRASH_DIR%\%%~F"
    move /y "%%~F" "%TRASH_DIR%\%%~F" >nul
    if exist "%TRASH_DIR%\%%~F" (
      set /a MOVED_COUNT+=1
    ) else (
      echo WARNING: Failed to move "%%~F"
    )
  )
)

echo.
echo Moved %MOVED_COUNT% files to "%TRASH_DIR%".
echo Root should now be cleaner; canonical docs remain in docs\root-info.
echo.
echo You can delete the trash folder later after validating.
echo Done.

endlocal
