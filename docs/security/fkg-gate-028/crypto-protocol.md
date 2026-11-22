# PROTOCOLO Y ARQUITECTURA PRAGMÁTICA: FKG-GATE-028 (CIERRE DE DISEÑO)

**Proyecto:** FurgoKid  
**Estado del Documento:** DICTAMEN TÉCNICO Y ARQUITECTURA AUTORIZADA (`IMPLEMENTADO`)

---

## 1. Decisión Ejecutiva: Arquitectura Pragmática Sin Criptografía Cliente

- Se descarta formalmente el uso de criptografía asimétrica en el cliente (`@noble/curves`) y cifrado envolvente AES-256-GCM para Expo Push Tokens.
- La seguridad del ciclo de vida de notificaciones se sustenta sobre:
  1. **Firebase Authentication:** UID verificado exclusivamente en servidor (Cloud Functions).
  2. **Firebase App Check (`enforceAppCheck: true`):** Obligatorio en todas las Cloud Functions Callables.
  3. **Admin SDK como única autoridad de escritura:** Las reglas de Firestore prohíben toda escritura directa de clientes en `/users/{uid}/devices/{deviceId}` y `/pushTokenIndex/{tokenHash}`.
  4. **Revocación explícita y manejo de recibos de Expo:** Inactivación ante `DeviceNotRegistered` y revocación en `logout`.

---

## 2. Contratos de Cloud Functions Callables

- `registerPushDevice`: Registra o actualiza el token con hash SHA-256, desvinculando registros previos si el token cambia de usuario.
- `revokePushDevice`: Inactiva el dispositivo activo al cerrar sesión (`logout`).
