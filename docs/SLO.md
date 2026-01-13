# SLO / SLI - FurgoKid

## Objetivo

Definir métricas mínimas de confiabilidad para pre-lanzamiento y post-lanzamiento.

## SLOs (targets)

- **Crash-free sessions**: ≥ 99.5% (mensual)
- **Crash-free users**: ≥ 99.0% (mensual)
- **App start (TTI/P95)**: < 3s
- **Screen transition (P95)**: < 500ms
- **Push delivery success**: ≥ 95% en < 30s
- **Firebase Functions error rate**: < 1% diario

## SLIs (cómo medir)

- **Sentry**: Crash-free sessions/users, regressions por release.
- **Firebase Console**: Functions (errors/latency), Firestore usage.
- **PerformanceService**: trazas locales y métricas custom si aplica.

## Error Budget

Con crash-free sessions 99.5%, el error budget es 0.5%.

- Si el budget se consume rápido: congelar features, priorizar estabilidad.

## Revisión

- Frecuencia: semanal (pre-lanzamiento), luego mensual.
