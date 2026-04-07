# 🛠️ INCIDENT RUNBOOK - FurgoKid

## Objetivo

Estandarizar la respuesta a incidentes críticos en producción (crashes, caídas, errores masivos).

---

## 🚨 ¿Cuándo activar este runbook?

- Spike de errores en Sentry (>10x en 5 min)
- Firebase Performance: Latencia >2s o crash rate >0.5%
- Caída total/parcial de la app
- Incidente reportado por usuarios clave

---

## 📋 Pasos de respuesta

1. **Detección**

   - Revisar alertas automáticas en Sentry y Firebase
   - Confirmar si el spike es real (no falso positivo)

2. **Comunicación**

   - Notificar a equipo (Slack, WhatsApp, email)
   - Asignar responsable (on-call)

3. **Diagnóstico**

   - Revisar logs en Sentry y Firebase
   - Identificar commit/PR sospechoso
   - Reproducir bug en entorno de staging/dev

4. **Mitigación**

   - Si es posible: rollback (revertir commit en main)
   - Desplegar hotfix urgente
   - Comunicar workaround a usuarios (si aplica)

5. **Resolución**

   - Validar fix en producción
   - Monitorear que el spike desaparece

6. **Post-mortem**
   - Documentar causa raíz, impacto, acciones correctivas
   - Actualizar este runbook si fue necesario improvisar

---

## 📄 Plantilla de Post-Mortem

| Campo                | Detalle                           |
| -------------------- | --------------------------------- |
| Fecha/Hora           |                                   |
| Detectado por        | (alerta, usuario, monitoreo)      |
| Impacto              | (usuarios afectados, duración, $) |
| Root cause           |                                   |
| Timeline             | (hora a hora, acciones tomadas)   |
| Fix aplicado         |                                   |
| Acciones preventivas |                                   |
| Owner                |                                   |

---

## ✅ Checklist de alertas (pendiente configurar en consola)

- [ ] Sentry: Spike detection (10x errores en 5 min)
- [ ] Sentry: High user impact (>50 usuarios en 1h)
- [ ] Firebase: Crash rate >0.5%
- [ ] Firebase: Latencia API >2s
- [ ] Notificación a Slack/email

> **IMPORTANTE:** Configura estas alertas en Sentry y Firebase Console. Documenta aquí el canal de notificación y responsables.

---

## Severidades

- **P0**: App inusable / login imposible / crash masivo / pagos/ads rompen navegación.
- **P1**: Feature crítica degradada (tracking, requests, notificaciones).
- **P2**: Bugs menores / UI issues / performance puntual.

## Contactos

- Firebase Console: Billing/Firestore/Functions
- Sentry: Alerts + Issues
