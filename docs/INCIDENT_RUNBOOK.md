# Incident Runbook - FurgoKid

## Severidades

- **P0**: App inusable / login imposible / crash masivo / pagos/ads rompen navegación.
- **P1**: Feature crítica degradada (tracking, requests, notificaciones).
- **P2**: Bugs menores / UI issues / performance puntual.

## P0 - Checklist (primeros 15 minutos)

1. Confirmar alcance (Sentry: users afectados, release, device/os).
2. Mitigación rápida:
   - Deshabilitar features vía flags (si existe) o hotfix.
   - Publicar aviso a usuarios (si aplica).
3. Identificar causa:
   - Stacktrace principal en Sentry.
   - Últimos cambios relevantes.
4. Rollback:
   - Si el issue comenzó en un release nuevo, preparar rollback del canal EAS.

## P1 - Checklist

1. Confirmar impacto (solo un flow/rol).
2. Crear issue + asignar fix.
3. Hotfix en 24-72h.

## Postmortem (obligatorio para P0)

- Timeline
- Root cause
- Fix
- Action items preventivos

## Contactos

- Firebase Console: Billing/Firestore/Functions
- Sentry: Alerts + Issues
