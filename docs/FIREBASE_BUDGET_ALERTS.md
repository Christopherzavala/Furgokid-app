# Firebase Budget Alerts (P0/P1)

## Objetivo

Evitar sorpresas de costo en plan Blaze.

## Configuración

1. Firebase Console → Billing → Budgets & alerts.
2. Crear budget mensual (ej: **$10 USD**).
3. Crear alertas:
   - 50% budget
   - 90% budget
   - 100% budget
4. Agregar emails de notificación.

## Recomendaciones

- Revisar Firestore reads/writes semanalmente post-lanzamiento.
- Limitar Functions `maxInstances` (ya está configurado en el proyecto).
