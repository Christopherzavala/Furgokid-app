# CONTRATOS DE DATOS Y COLECCIONES: FKG-GATE-028 (ARQUITECTURA PRAGMÁTICA)

**Proyecto:** FurgoKid  
**Estado del Documento:** ESPECIFICACIÓN TÉCNICA DE COLECCIONES (`IMPLEMENTADO`)

---

## 1. Esquema de Colecciones de Dispositivos y Tokens

### 1.1 Dispositivos del Usuario (`/users/{uid}/devices/{deviceId}`)

- **Campos:**
  - `deviceId`: Identificador estable del dispositivo local.
  - `userId`: UID del propietario (`uid`).
  - `expoPushToken`: Token push completo de Expo.
  - `tokenHash`: Hash SHA-256 del token push.
  - `platform`: `ios` | `android`.
  - `status`: `'active' | 'detached' | 'unregistered'`.
  - `updatedAt`: Timestamp de última actualización.

### 1.2 Índice Global de Tokens (`/pushTokenIndex/{tokenHash}`)

- **Campos:**
  - `tokenHash`: Hash SHA-256 del token push (ID del documento).
  - `uid`: UID del propietario actual.
  - `deviceId`: ID del dispositivo asociado.
  - `status`: `'active' | 'detached' | 'unregistered'`.
  - `updatedAt`: Timestamp de última actualización.
