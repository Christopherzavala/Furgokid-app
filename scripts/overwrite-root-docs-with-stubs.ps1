Param(
  [string]$RepoRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location $RepoRoot

$files = @(
  'ADMOB_IMPLEMENTATION_READY.md',
  'ADMOB_RESPUESTAS_USUARIO.md',
  'ADMOB_SETUP.md',
  'ADMOB_STRATEGY_COMPLETA.md',
  'ADMOB_VISUAL_SUMMARY.txt',
  'AUDITORÍA_FINAL_SUMARIO.txt',
  'AUDITORÍA_RESUMEN_TÉCNICO.md',
  'AUDITORÍA_VISUAL_SUMMARY.txt',
  'CHECKLIST_POST_AUDITORIA.md',
  'CODIGO_AUDIT_REPORTE.md',
  'DESARROLLO_LOCAL.md',
  'ERRORES-CORREGIDOS.md',
  'FINALIZACION_MVP.md',
  'FIXES_APLICADOS.md',
  'IMPLEMENTACION_COMPLETADA.md',
  'INICIO_AQUI.txt',
  'INSTRUCCIONES_PRODUCTION_BUILD.md',
  'MASTER_CHECKLIST.md',
  'MVP_COMPLETADO.md',
  'PRIVACY_POLICY.md',
  'README-CONFIGURACION.md',
  'README_AUDITORÍA.md',
  'README_MVP_SUMMARY.md',
  'README_SENIOR_ULTRA.md',
  'REFERENCIA_RAPIDA_FIXES.md',
  'REPARACION_COMPLETADA.md',
  'REPORTE_REPARACION.md',
  'SUMMARY.txt',
  'TESTING.md'
)

$updated = 0
$skipped = 0

foreach ($f in $files) {
  $canonical = Join-Path -Path (Join-Path -Path 'docs' -ChildPath 'root-info') -ChildPath $f
  if (-not (Test-Path -LiteralPath $canonical)) {
    $skipped++
    continue
  }

  $isTxt = $f.ToLowerInvariant().EndsWith('.txt')
  if ($isTxt) {
    $content = @(
      'MOVIDO A /docs (stub)',
      '',
      'Este archivo se mantiene como stub para compatibilidad.',
      '',
      "Copia canónica: docs/root-info/$f",
      'Índice: docs/root-info/INDEX.md',
      ''
    ) -join "`n"
  } else {
    $content = @(
      '# MOVIDO A /docs (stub)',
      '',
      'Este archivo se mantiene como **stub** para compatibilidad. La versión canónica está en docs/root-info.',
      '',
      "- Copia canónica: docs/root-info/$f",
      '- Índice: docs/root-info/INDEX.md',
      ''
    ) -join "`n"
  }

  Set-Content -LiteralPath $f -Value $content -Encoding utf8
  $updated++
}

Write-Host "root-doc stubs: updated=$updated skipped=$skipped"