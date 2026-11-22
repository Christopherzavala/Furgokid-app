# ESTRATEGIA DE MIGRACIÓN Y RETIRO LEGACY: FKG-GATE-028 (IMPLEMENTADO)

**Proyecto:** FurgoKid  
**Estado del Documento:** ESPECIFICACIÓN TÉCNICA Y POLÍTICA (`IMPLEMENTADO`)

---

## 1. Retiro del Campo Legacy `pushToken`

1. **Eliminación de Escritura Cliente:**  
   Se eliminó la escritura directa `updateDoc(doc(db, 'users', userId), { pushToken: ... })` en [notificationService.js](file:///C:/Users/Stack/Desktop/Furgokid/src/services/notificationService.js).
2. **Autoridad de Registro (Cloud Functions):**  
   El registro se realiza exclusivamente mediante la Cloud Function `registerPushDevice`, almacenando los dispositivos en `/users/{uid}/devices/{deviceId}` y el índice global en `/pushTokenIndex/{tokenHash}`, eliminando automáticamente cualquier campo `pushToken` legacy del perfil de usuario mediante `FieldValue.delete()`.
3. **Despacho Exclusivo:**  
   El backend consulta únicamente la subcolección de dispositivos activos (`status == 'active'`) para enviar notificaciones push.
