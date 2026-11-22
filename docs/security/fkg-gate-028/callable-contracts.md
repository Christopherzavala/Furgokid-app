# CONTRATOS TÉCNICOS DE CALLABLES: FKG-GATE-028 (ARQUITECTURA PRAGMÁTICA)

**Proyecto:** FurgoKid  
**Estado del Documento:** ESPECIFICACIÓN TÉCNICA Y FIRMAS CALLABLE (`IMPLEMENTADO`)

---

## 1. Contrato `registerPushDevice`

- **Autenticación & App Check:** Requeridos obligatoriamente (`onCall({ enforceAppCheck: true })`).
- **Entrada (data):** `expoPushToken`, `deviceId`, `platform`.
- **Procesamiento (Transacción Firestore):**
  - Valida formato de token (`ExponentPushToken[...]` o `ExpoPushToken[...]`).
  - Calcula `tokenHash = sha256(expoPushToken)`.
  - Verifica si `tokenHash` pertenece a otro usuario; si es así, desvincula (`detached`) el registro anterior.
  - Almacena/actualiza en `/users/{uid}/devices/{deviceId}` y `/pushTokenIndex/{tokenHash}` con `status: 'active'`.
  - Elimina el campo legacy `users/{uid}.pushToken`.
- **Salida:** `{ success: true, deviceId }`.

---

## 2. Contrato `revokePushDevice`

- **Autenticación & App Check:** Requeridos obligatoriamente (`onCall({ enforceAppCheck: true })`).
- **Entrada (data):** `deviceId` (opcional; si se omite, revoca todos los dispositivos activos del usuario).
- **Procesamiento (Transacción Firestore):**
  - Cambia estado a `'detached'` en `/users/{uid}/devices/{deviceId}` y `/pushTokenIndex/{tokenHash}`.
  - Limpia el campo legacy `users/{uid}.pushToken`.
- **Salida:** `{ success: true }`.
