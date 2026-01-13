# Sentry Alerts Setup (P0)

## Objetivo

Detectar incidentes rápido (MTTD < 5 min) y reducir MTTR.

## Alertas recomendadas

### 1) Spike Detection (P0)

- Tipo: Error spike
- Umbral sugerido: +10% en 5 min (o 20 eventos/5 min)
- Acción: Email al owner + Slack/Discord si aplica

### 2) High User Impact (P0)

- Tipo: Users affected
- Umbral sugerido: 50+ usuarios afectados en 1h (ajustar según DAU)
- Acción: notificar inmediato

### 3) Regression por Release (P0)

- Tipo: New issue / Regression
- Scope: release actual (`furgokid@x.y.z`)
- Acción: revisar y decidir rollback

## Pasos

1. Abrir Sentry Project → Alerts.
2. Crear 3 reglas anteriores.
3. Probar disparo con un error controlado en staging.
