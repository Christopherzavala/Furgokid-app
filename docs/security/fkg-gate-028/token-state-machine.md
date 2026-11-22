# MÁQUINA DE ESTADOS Y TRANSICIONES: FKG-GATE-028 (ARQUITECTURA PRAGMÁTICA)

**Proyecto:** FurgoKid  
**Estado del Documento:** ESPECIFICACIÓN TÉCNICA DE ESTADOS (`IMPLEMENTADO`)

---

## 1. Estados del Ciclo de Vida del Token

- `active`: El dispositivo y token push están registrados y activos para recibir notificaciones.
- `detached`: El usuario ha cerrado sesión (`logout`) o el token ha sido transferido a otro usuario, desvinculando el dispositivo.
- `unregistered`: Expo Push API ha reportado `DeviceNotRegistered` (aplicación desinstalada o token invalidado).
