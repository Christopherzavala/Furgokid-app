# Pull Request Draft: feat(ola-4): portal web de seguimiento compartido y alertas push accionables

## Información del PR

- **Rama origen:** `feat/fkg-ola4-web-tracking-and-whatsapp`
- **Rama destino:** `main` (o `staging`)
- **Título:** `feat(ola-4): portal web de seguimiento compartido y alertas push accionables`

---

## Resumen de Cambios

### Paso 4A — Portal Web de Seguimiento Compartido (#7) + Atajo WhatsApp (`wa.me`)

- **Firestore & Reglas (`firestore.rules`):** Colección `trackingShares/{shareToken}` con lectura restringida a participantes autorizados (`ownerUid`, `parentId`, `driverId`) o `admin`/`ops`, y escritura directa desde cliente bloqueada (`allow write: if false;`).
- **Cloud Functions (`functions/src/webTrackingCallables.js`):**
  - `createTrackingShareLink`: Genera token temporal de seguimiento con expiración configurable (`1` a `168` horas, por defecto `24h`).
  - `revokeTrackingShareLink`: Revoca un `shareToken` activo (`revoked: true`).
  - `getSharedTrackingSnapshot` / `buildSharedTrackingSnapshot`: Valida existencia, vigencia y estado de revocación, devolviendo un snapshot seguro sin exponer PII sensible (sin emails, teléfonos, direcciones exactas ni datos sensibles de menores).
- **Cliente Móvil y Visor Web (`src/services/webTrackingService.js`, `src/screens/TrackingMap.js`, `web/tracking.html`, `web/tracking.js`):**
  - Generación y revocación de enlaces de seguimiento temporal desde `TrackingMap.js`.
  - Helper `buildWhatsAppShareUrl` para armar enlaces `https://wa.me/?text=...` sin requerir API de pago de WhatsApp.
  - Visor web liviano (`web/tracking.html` + `web/tracking.js`) para visualizar estados de viaje mediante `?token=...`.

### Paso 4B — Alertas Push Accionables y Preferencias de Usuario (#8)

- **Preferencias y Payload (`functions/src/alertPreferences.js`):**
  - Valores por defecto (`boardingAlert`, `etaProximityAlert`, `handoverAlert`, `absenceAlert` en `true`).
  - Helpers `resolveAlertPreferences`, `shouldSendAlertForEvent` y `buildActionablePushPayload` (`OPEN_TRACKING`, `REPORT_ABSENCE`).
  - Callable `updateAlertPreferences` para persistir `alertPreferences` en `users/{uid}`.
- **Cliente Móvil (`src/services/alertPreferencesService.js`, `src/screens/SettingsScreen.js`):**
  - Lectura/guardado de preferencias y switches interactivos en `SettingsScreen.js` con retroalimentación vía `toastService`.

---

## Checklist de Smoke Test en `furgokid-staging`

- [ ] **1. Generación y revocación de enlace de seguimiento (`TrackingMap`):**

  - _Acción:_ Entrar a un viaje activo como apoderado o conductor y generar un enlace compartido.
  - _Observación:_ [ ] Documento creado en `trackingShares/{shareToken}` con `revoked: false`, `expiresAt` futuro, URL de seguimiento y enlace `wa.me` generados correctamente.

- [ ] **2. Visualización en el portal web (`web/tracking.html?token=...`):**

  - _Acción:_ Abrir la URL generada con `?token=...` en el navegador y probar el botón de compartir por WhatsApp.
  - _Observación:_ [ ] El visor carga el estado del viaje, ubicación y estados de pasajeros sin exponer PII sensible; el botón `wa.me` abre el compositor con el texto prearmado.

- [ ] **3. Bloqueo de token revocado o expirado (`getSharedTrackingSnapshot`):**

  - _Acción:_ Revocar el token desde la app (`revokeTrackingShareLink`) y recargar la vista web con el mismo `?token=...`.
  - _Observación:_ [ ] El snapshot rechaza el acceso por token revocado/expirado de forma limpia.

- [ ] **4. Preferencias de alertas en `SettingsScreen` (`updateAlertPreferences`):**

  - _Acción:_ Cambiar el estado de los switches de alertas en `SettingsScreen`.
  - _Observación:_ [ ] Toast de confirmación visible y campo `users/{uid}.alertPreferences` actualizado en Firestore.

- [ ] **5. Verificación de Linter y Pruebas Unitarias:**
  - _Acción:_ Ejecutar tests y linter localmente.
  - _Observación:_ [ ] 0 errores, 0 advertencias, todos los tests unitarios pasados en verde.
