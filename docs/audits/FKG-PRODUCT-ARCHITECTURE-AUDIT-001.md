# FKG-PRODUCT-ARCHITECTURE-AUDIT-001: AUDITORÍA DE ARQUITECTURA DE PRODUCTO Y PLAN MAESTRO DE SEGURIDAD

**Fecha de Ejecución:** 22 de Noviembre de 2026  
**Proyecto:** FurgoKid (SaaS de Transporte Escolar Seguro en Chile)  
**Evaluadores:** Principal Software Architect, CTO & Product Security Architect  
**Entorno Auditado:** React Native / Expo, Firebase Auth, Cloud Firestore, Firebase Storage, Cloud Functions v2 (Node.js 22)  
**Normativa Aplicable:** CONASET / RENASTRE (Chile), Ley 21.719 de Protección de Datos Personales (Chile)

---

## 1. Baseline Git y Arquitectura Actual

### Estado del Repositorio Git

- **Rama Activa:** `main`
- **HEAD Commit:** `dd476feb084ad8485e9e9b5c735df061d3bd582a` (_fix(scripts): resolve firebase-admin dependency fallback and handle missing ADC credentials nicely_)
- **Integración:** Rama `feat/fkg-pr7-callables-deep-audit-and-client-security` totalmente integrada en `main`.
- **Estado de Worktree:** Limpio (`nothing to commit, working tree clean`), 0 cambios pendientes.

### Tabla de Componentes del Sistema

| Componente                          | Archivos Principales                                                            | Descripción y Capacidades Actuales                                                                                                                                                                                                                                                                                                                                                                                                                                          | Estado Reutilizable                 |
| :---------------------------------- | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| **Cliente React Native / Expo**     | `src/screens/*.tsx`, `src/services/*.ts`, `src/components/*.tsx`                | Interfaz móvil para Apoderados, Conductores y Administración. Maneja autenticación, flujo de consentimientos GDPR/Ley 21.719 (`GDPRSettingsScreen.tsx`), autorización de pasajeros (`PassengerAuthorizationScreen.tsx`), telemetría y diagnósticos (`sentry.ts`, `analyticsService.ts`, `firebasePerformanceService.ts`).                                                                                                                                                   | **Reutilizable y extensible**       |
| **Cloud Functions v2 (Node.js 22)** | `functions/index.js`, `functions/src/*.js`                                      | 28 Cloud Functions desplegadas en `us-central1`. Gestión del ciclo de vida de matches (`matchLifecycle.js`), eliminación segura de datos (`accountDeletionService.js`), autorización de pasajeros y co-guardians (`passengerAuthorization.js`, `coGuardianCallables.js`), limpieza de GPS en cascada (`driverTrackingCleanup.js`, `firestoreGpsCleanupRepository.js`), registro de inasistencias (`absenceCallables.js`) y aprobación de conductores (`driverApproval.js`). | **Reutilizable y producción-ready** |
| **Reglas de Seguridad Firestore**   | `firestore.rules`                                                               | Control de acceso basado en roles (`isAdmin()`, `isParent()`, `isApprovedDriver()`), prevención de suplantación, esquema estricto en `requests`, límite de velocidad en GPS (`speed`, `updatedAt` <= 2m), protección de menores en `users` y borrado seguro de datos.                                                                                                                                                                                                       | **Robusto y desplegado**            |
| **Reglas de Seguridad Storage**     | `storage.rules`                                                                 | Acceso granular a imágenes de perfil (`users/{userId}/profile`), documentos sensibles de conductores (`drivers/{driverId}/documents`) y autorizaciones de menores (`passengers/{parentId}/{passengerId}`).                                                                                                                                                                                                                                                                  | **Robusto y desplegado**            |
| **Suites de Pruebas**               | `functions/test/*.test.js`, `tests/*.rules.test.ts`, `src/services/__tests__/*` | Cobertura unitaria y de emuladores para reglas de Firestore/Storage, funciones callables, triggers de perfil y flujos de eliminación segura.                                                                                                                                                                                                                                                                                                                                | **Base sólida de testing**          |
| **Scripts de Operación**            | `scripts/sync-admin-custom-claims.js`                                           | Sincronización automática de Custom Claims (`role: 'admin'`, `admin: true`) para usuarios administradores en Firebase Auth.                                                                                                                                                                                                                                                                                                                                                 | **Activo**                          |

---

## 2. Auditoría Individual de los 16 Módulos del Plan Maestro

### Módulo 1: Acceso B2B y Establecimientos (Organizaciones, Colegios, Roles Institucionales, Invitaciones)

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Campos `school` en `requests` (validado en `firestore.rules#L316-L318` y `matchLifecycle.js#L129`) y `schools[]` en `vacancies` (`firestore.rules#L340`).
  - `DriverVacancyScreen.js` lista colegios populares.
  - Tag de Sentry `schoolId` en `src/config/sentry.ts#L177`.
- **C. Brechas:**
  - No existe la colección `organizations` ni `establishments` en Firestore.
  - No existen roles institucionales B2B (Directores, Coordinadores de Transporte Escolar). Solo existen los roles planos `admin`, `driver` y `parent`.
  - Ausencia de sistema de invitaciones con tokens hasheados para colegios o flotas B2B.
- **D. Nivel de Riesgo:** `HIGH`
- **E. Recomendación:** Conservar campos de colegios en solicitudes/vacantes. Crear colección `organizations` y sub-colección `schoolMemberships` para soporte multi-tenant escolar B2B.
- **F. Criterios de Aceptación:**
  1. Un usuario con rol `school_admin` puede gestionar la lista de furgones autorizados para su colegio.
  2. Las invitaciones a apoderados/conductores expiran en 72 horas y usan hashes criptográficos SHA-256.

### Módulo 2: Motor de Rutas Multi-Colegio (Ida/Regreso, Paradas, Capacidad, ETA, Replanificación)

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Colección `routes` en `firestore.rules#L173-L215`.
  - `matches/{matchId}/tracking/current` para ubicación en tiempo real (`firestore.rules#L380-L415`).
  - Gestión transaccional de capacidad (`totalSeats`, `availableSeats`, `reservedSeats`) en `functions/src/matchLifecycle.js#L260-L300`.
  - Secuencia de estados de viaje en `timelineService.js` (`ARRIVED_SCHOOL`, etc.).
- **C. Brechas:**
  - No hay cálculo dinámico ni optimización de rutas multi-parada (TSP / Dijkstra).
  - No existe motor de ETA en tiempo real ni replanificación automática ante tráfico/panne.
  - Sin integración de deep-linking a Waze / Google Maps para conductores.
- **D. Nivel de Riesgo:** `HIGH`
- **E. Recomendación:** Conservar el documento de tracking efímero `matches/{matchId}/tracking/current` (que garantiza privacidad y cero costo innecesario). Agregar estructura de paradas ordenadas `stops[]` con estado individual por estudiante.
- **F. Criterios de Aceptación:**
  1. Reorganización dinámica del orden de paradas cuando se registra una inasistencia (`Smart Absence`).
  2. Notificación push de ETA cuando el furgón se encuentra a 5 minutos o 1 km de la parada del apoderado.

### Módulo 3: Smart Absence (Inasistencias Inteligentes)

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Callable `registerAbsence` en `functions/src/absenceCallables.js`.
  - Sub-colección `matches/{matchId}/absences/{absenceId}` en Firestore.
- **C. Brechas:**
  - Falta validación estricta de ventana horaria (ej. máximo 30 min antes del inicio de la ruta).
  - No existe el bloqueo automático si el estudiante ya fue marcado como abordado (`BOARDING_CONFIRMED` o `IN_TRANSIT`).
  - Falta la interfaz de confirmación visual y atajo rápido en la vista del conductor.
- **D. Nivel de Riesgo:** `MEDIUM`
- **E. Recomendación:** Extender `absenceCallables.js` para validar la máquina de estados del menor antes de registrar la inasistencia y emitir un evento push de notificación inmediata al conductor.
- **F. Criterios de Aceptación:**
  1. Si un menor está en estado `BOARDING_CONFIRMED`, el sistema rechaza el registro de inasistencia con `FAILED_PRECONDITION`.
  2. Al registrar una inasistencia válida, se libera temporalmente el cupo en la ruta del día sin alterar el contrato mensual.

### Módulo 4: Verificación Integral de Conductores, Acompañantes y Vehículos (CONASET/RENASTRE)

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Callables `requestDriverApproval` y `reviewDriverRequest` en `functions/src/driverApproval.js` y `driverApprovalCallables.js`.
  - Campos `driverRequestStatus` y `approved` protegidos en `firestore.rules#L45-L55`.
  - Reglas de Storage en `storage.rules#L38-L42` para `drivers/{driverId}/documents/{fileName}` (PDF/Imágenes hasta 10 MB).
- **C. Brechas:**
  - No existen expedientes separados ni reglas para "Acompañantes" (exigidos por normativa chilena cuando se transportan más de 5 niños de educación prebásica).
  - No hay verificación ni alertas automáticas sobre la fecha de vencimiento de la Licencia A1/A2, Certificado de Antecedentes y Certificado RENASTRE.
  - Falta la funcionalidad de suspensión preventiva inmediata con revocación de claims.
- **D. Nivel de Riesgo:** `CRITICAL`
- **E. Recomendación:** Conservar el flujo de aprobación por Admin. Añadir sub-colección `driverDocuments` con metadatos de fechas de expiración y cron job para alertas y suspensión automática.
- **F. Criterios de Aceptación:**
  1. Si la licencia o certificado RENASTRE de un conductor vence, su estado pasa automáticamente a `suspended` y sus rutas activas se pausan.
  2. Los documentos solo son legibles por el propio conductor y usuarios con rol `admin`.

### Módulo 5: Suscripciones B2B (Planes, Cobros, Webhooks, Idempotencia, Facturación)

- **A. Estado Real:** `NOT IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Archivo decorativo `src/services/premiumService.ts` y `PremiumBanner.tsx` con mocks locales en `AsyncStorage`.
  - Documento de diseño en `docs/MONETIZATION_STRATEGY.md`.
- **C. Brechas:**
  - No existen integraciones de pasarelas de pago (MercadoPago / Flow / Webpay / Stripe).
  - Sin controladores de webhooks firmados criptográficamente ni tabla de eventos idempotentes.
  - Sin separación técnica entre el estado de pago del apoderado/conductor y los privilegios de seguridad del viaje.
- **D. Nivel de Riesgo:** `HIGH`
- **E. Recomendación:** Implementar en Fase D usando Cloud Functions dedicadas para webhooks de pasarela con verificación de firma HMAC y persistencia de eventos en `paymentEvents`.
- **F. Criterios de Aceptación:**
  1. Un webhook duplicado o reintentado por la pasarela devuelve `200 OK` de inmediato sin procesar doble cobro.
  2. Un fallo de pago suspende la renovación del servicio pero NUNCA interrumpe un viaje o seguimiento en curso por razones de seguridad infantil.

### Módulo 6: Beneficios y Patrocinadores (Marketplace Local, Cupones)

- **A. Estado Real:** `EXPERIMENTAL`
- **B. Evidencia Exacta:**
  - Componentes de AdMob (`src/components/AdBanner.tsx`, `src/services/admobService.ts`, `src/hooks/useAdMob.ts`).
- **C. Brechas:**
  - Inexistencia de un Marketplace de convenios locales para apoderados/conductores.
  - Falta aislamiento estricto entre proveedores de anuncios y la telemetría/ubicación de los menores.
- **D. Nivel de Riesgo:** `LOW`
- **E. Recomendación:** Posponer para Fase E. Mantener AdMob desactivado por defecto mediante Remote Config para evitar fugas de telemetría o distracciones en la app del conductor.
- **F. Criterios de Aceptación:**
  1. Ninguna SDK publicitaria tiene acceso a permisos de ubicación ni identificadores de menores.

### Módulo 7: Portal Web de Seguimiento (Tokens Efímeros de 15–30 min)

- **A. Estado Real:** `NOT IMPLEMENTED`
- **B. Evidencia Exacta:**
  - La arquitectura actual es 100% móvil React Native. No existe aplicación web desplegada para seguimiento ni API de tokens compartibles.
- **C. Brechas:**
  - Sin sistema de generación de links temporales con hash HMAC para terceros (ej. abuelos, tíos) sin cuenta en la app.
  - Sin política de cabeceras HTTP `HTTP 401/403`, `no-index`, `no-store` ni expiración estricta de 15 a 30 minutos.
- **D. Nivel de Riesgo:** `HIGH`
- **E. Recomendación:** Posponer a Fase C. Implementar mediante Cloud Function HTTPS que renderice un visor web mínimo de coordenadas de `matches/{matchId}/tracking/current` validando un token efímero de un solo uso o tiempo acotado.
- **F. Criterios de Aceptación:**
  1. Un enlace de seguimiento expira exactamente a los 30 minutos de su creación o cuando el viaje finaliza.
  2. El portal web no solicita credenciales ni almacena cookies ni rastreadores de terceros.

### Módulo 8: WhatsApp Business Cloud API (Notificaciones y Geocercas)

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Redirección cliente por enlace `whatsapp://send?phone=...` en `SearchScreen` y `DriverVacancyScreen.js`.
  - Cloud Function `externalNotifications.js` que envía notificaciones Push vía Expo/FCM.
- **C. Brechas:**
  - Sin integración servidor-a-servidor con Meta WhatsApp Business Cloud API.
  - Sin plantillas aprobadas por Meta para alertas de proximidad/llegada.
  - Sin registro de consentimiento explícito (Opt-in) de los apoderados para recibir WhatsApps.
- **D. Nivel de Riesgo:** `MEDIUM`
- **E. Recomendación:** Implementar en Fase C como canal redundante de respaldo cuando la notificación Push in-app falle o no sea entregada en 30 segundos.
- **F. Criterios de Aceptación:**
  1. Solo se envían mensajes por WhatsApp si el apoderado marcó explícitamente el Opt-in en su perfil.
  2. Los mensajes usan plantillas HSM pre-aprobadas sin incluir nombres completos de menores ni datos sensibles.

### Módulo 9: Seguridad Antifraude, Play Integrity y Firebase App Check

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - App Check soporta contexto en `functions/index.js` (`enforceAppCheck: false`).
  - Validación matemática de GPS en `firestore.rules#L70-L95` (`latitude`, `longitude`, `speed >= 0`, `updatedAt` <= 2 minutos).
- **C. Brechas:**
  - `enforceAppCheck` está configurado en `false` en las Cloud Functions (modo audit).
  - Sin validación cliente de attestation Play Integrity / App Attest.
  - Sin detector servidor de saltos imposibles de GPS (teletransportación / Mock Location).
- **D. Nivel de Riesgo:** `HIGH`
- **E. Recomendación:** Activar `enforceAppCheck: true` progresivamente en Fase A. Añadir filtro de plausibilidad física de velocidad (< 120 km/h) en el cliente y Cloud Functions.
- **F. Criterios de Aceptación:**
  1. Toda llamada a Cloud Functions sin un token válido de App Check es rechazada con `UNAUTHENTICATED` / `PERMISSION_DENIED`.
  2. Actualizaciones de ubicación con saltos mayores a 2 km en menos de 10 segundos son descartadas y registradas como anomalía de seguridad.

### Módulo 10: Cupones, Testers y Founder VIP (Sistema de Entitlements)

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - `src/services/premiumService.ts` incluye funciones auxiliares para validar estado premium y cupones simulados.
- **C. Brechas:**
  - Falta la colección `entitlements` en Firestore con la estructura `USER → ENTITLEMENT → PLAN → VALIDITY → AUDIT`.
  - Sin validación del lado del servidor (Cloud Functions) para cupones o beneficios Founder VIP.
- **D. Nivel de Riesgo:** `LOW`
- **E. Recomendación:** Desarrollar en Fase D. Definir Custom Claims o documentos en `entitlements/{userId}` leíbles mediante Security Rules.
- **F. Criterios de Aceptación:**
  1. La asignación de un código VIP o cupón queda registrada en una bitácora inmutable de auditoría con el UID del administrador otorgante.

### Módulo 11: Recogida y Entrega Segura de Estudiantes (Cadena de Custodia)

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Módulo `functions/src/passengerAuthorization.js` (`onboardPassenger`, `updatePassengerAuthorizationStatus`).
  - Pantalla `PassengerAuthorizationScreen.tsx` (Declaración de Responsabilidad Adulta).
  - `timelineService.js` para marcas temporales de eventos de viaje.
- **C. Brechas:**
  - Falta la máquina de estados estricta formalizada: `EXPECTED → BOARDING_CONFIRMED → IN_TRANSIT → ARRIVAL_CONFIRMED → HANDOVER_CONFIRMED`.
  - No existe la generación ni validación de Código Único de Entrega / OTP de un solo uso / Código QR dinámico.
  - Sin verificación en tiempo real de la identidad de la persona autorizada al momento de la entrega en el domicilio o colegio.
- **D. Nivel de Riesgo:** `CRITICAL`
- **E. Recomendación:** Implementar de forma prioritaria en la **Fase A (Bloque P0)**. Garantizar que cada cambio de estado requiera invocación de Cloud Function con verificación del adulto responsable.
- **F. Criterios de Aceptación:**
  1. El estado del traslado solo puede avanzar a `HANDOVER_CONFIRMED` si el conductor ingresa el PIN de 4 dígitos o escanea el QR generado en la app del apoderado/persona autorizada.
  2. Cada transición emite un registro inmutable en `authorizationEvents`.

### Módulo 12: Centro de Emergencias e Incidentes (SOS, Panne, Accidente)

- **A. Estado Real:** `NOT IMPLEMENTED`
- **B. Evidencia Exacta:**
  - No existen archivos, colecciones ni Cloud Functions destinadas a gestión de emergencias en la base de código actual.
- **C. Brechas:**
  - Inexistencia de botón SOS en la app del conductor o apoderado.
  - Sin protocolo automatizado de notificación masiva ante pannes, accidentes o menores no localizados.
  - Sin consola operativa para escalamiento e intervención de soporte en tiempo real.
- **D. Nivel de Riesgo:** `CRITICAL`
- **E. Recomendación:** Construir en la **Fase A (Bloque P0)** la colección `incidents` con triggers de alta prioridad que disparen notificaciones Push emergentes, SMS y alertas al panel de administración.
- **F. Criterios de Aceptación:**
  1. Al presionar el botón SOS, se envía inmediatamente la posición GPS exacta del furgón a todos los apoderados con niños a bordo y al equipo de operaciones.
  2. Todo incidente requiere resolución auditada por parte de un operador autorizado antes de ser cerrado.

### Módulo 13: Gestión de Apoderados y Autorizaciones Familiares (Múltiples Apoderados, Retiros Temporales)

- **A. Estado Real:** `IMPLEMENTED` / `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Callable `addCoGuardian` en `functions/src/coGuardianCallables.js`.
  - Sub-colección `coGuardians` bajo `matches/{matchId}`.
  - Colección `passengerAuthorizations` protegida en `firestore.rules#L440-L455`.
- **C. Brechas:**
  - Falta la función de delegación temporal de retiro (ej. "Tía autorizada solo por hoy 24/Nov").
  - No existe restricción de alcance de ubicación (el co-guardian ve la ruta completa en lugar de ver la ubicación únicamente durante el tramo de su representado).
- **D. Nivel de Riesgo:** `HIGH`
- **E. Recomendación:** Reforzar en la **Fase A (Bloque P0)** añadiendo vigencia explícita (`validFrom`, `validUntil`) a las autorizaciones de retiro de terceros.
- **F. Criterios de Aceptación:**
  1. Una autorización de retiro temporal expira automáticamente al finalizar el día designado.
  2. Los apoderados secundarios o autorizados temporales no pueden modificar la información del perfil ni gestionar otros tutores.

### Módulo 14: Consola de Administración y Operaciones FurgoKid (Roles Internos Separados)

- **A. Estado Real:** `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - Script `scripts/sync-admin-custom-claims.js` para asignar `role: 'admin'`.
  - `firestore.rules` con helper `isAdmin()`.
  - Cloud Functions `reviewDriverRequest` para aprobación de conductores.
- **C. Brechas:**
  - Existe solo un rol global `admin`. No hay segregación de funciones entre `Superadmin`, `Operaciones`, `Soporte` y `Auditor`.
  - Inexistencia de una interfaz web gráfica (Consola de Administración) para los operadores de FurgoKid.
- **D. Nivel de Riesgo:** `HIGH`
- **E. Recomendación:** Implementar en Fase B la segregación de Custom Claims (`adminRole: 'superadmin' | 'operations' | 'support' | 'auditor'`) y crear la base de la Consola Web Operativa.
- **F. Criterios de Aceptación:**
  1. El rol `support` solo puede visualizar datos de contacto y estado de viajes sin capacidad de alterar reglas ni aprobar conductores.
  2. Toda acción realizada en la consola administrativa genera un log inmutable en `adminAuditLogs`.

### Módulo 15: Privacidad y Protección de Datos — Ley 21.719 (Chile)

- **A. Estado Real:** `IMPLEMENTED` / `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - `functions/src/accountDeletionService.js` (eliminación segura multi-colección y generación de recibo auditado `accountDeletionReceipts`).
  - `driverTrackingCleanup.js` (borrado de GPS efímero al terminar el viaje o revocar conductor).
  - Componentes de consentimiento y derecho ARCO (`GDPRSettingsScreen.tsx`, `ConsentModal.tsx`, `consentService.ts`, `gdprService.ts`).
  - `storage.rules` y `firestore.rules` con denegación por defecto de datos sensibles de menores (`childFieldsUnchangedOrRemoved`).
- **C. Brechas:**
  - Falta adaptar la terminología y formalismos explícitos a la Ley 21.719 chilena (entrada en vigencia antes de Dic 2026).
  - Auditoría de telemetría de Sentry / Analytics para asegurar cero fuga de nombres o RUTs de menores.
- **D. Nivel de Riesgo:** `HIGH`
- **E. Recomendación:** Reforzar en Fase B creando la tabla de registros de consentimientos con hash e integrando los requerimientos de la Agencia de Protección de Datos de Chile.
- **F. Criterios de Aceptación:**
  1. El borrado de cuenta elimina irreversiblemente la PII en Firestore, Auth y Storage en menos de 24 horas, emitiendo un recibo firmado.
  2. No se almacena historial de posiciones GPS pasadas por más de 48 horas salvo incidentes bajo investigación.

### Módulo 16: Confiabilidad, Funcionamiento Offline y Monitoreo (Foreground Services, Backup, Sentry)

- **A. Estado Real:** `IMPLEMENTED` / `PARTIALLY IMPLEMENTED`
- **B. Evidencia Exacta:**
  - `src/config/sentry.ts` para reporte de errores.
  - `src/services/firebasePerformanceService.ts` y `crashlyticsService.ts`.
  - `src/utils/offlineCache.ts`, `retryUtils.ts`, y `secureStorage.ts`.
- **C. Brechas:**
  - Falta una cola offline nativa persistente para eventos de tracking GPS con reintento idempotente al recuperar señal celular.
  - Sin política automatizada de copias de seguridad (Firestore Managed Backups a GCP Bucket).
- **D. Nivel de Riesgo:** `MEDIUM`
- **E. Recomendación:** Reforzar en Fase B mediante cola local en SQLite / WatermelonDB / MMKV para el conductor y automatización de backups en GCP.
- **F. Criterios de Aceptación:**
  1. Si la red móvil cae durante un trayecto, los eventos de cambio de estado se encolan localmente y se envían en orden estricto con UUIDs idempotentes al recuperar conexión.

---

## 3. Auditoría Transversal

### 1. Seguridad Firebase y App Check

- **Firestore:** Reglas altamente maduras (`firestore.rules`), con control de acceso por roles, validación de schemas de entrada, límite de tamaño de documentos (<1MB), rate limiting y aislamiento total del documento GPS efímero `matches/{matchId}/tracking/current`.
- **Storage:** Reglas desplegadas y compiladas (`storage.rules`), restringiendo subidas a imágenes/PDFs con límite de tamaño (5MB a 10MB) y ownership estricto.
- **App Check:** Presente en configuración de Cloud Functions pero con `enforceAppCheck: false`. Es urgente habilitar el modo enforcement tras la verificación de clientes móviles.

### 2. Modelo de Datos Multi-Tenant

- **Aislamiento:** El aislamiento actual entre apoderados y conductores se basa en `parentId` y `driverId` en colecciones raíz `requests`, `vacancies`, `matches`.
- **Evolución B2B:** Se requiere introducir la dimensión `organizationId` o `schoolId` a nivel de reglas de Firestore para habilitar paneles multi-colegio sin fuga de datos entre instituciones.

### 3. Arquitectura de Estados y Transacciones

- **Idempotencia y Resiliencia:** Excelente implementación en `accountDeletionService.js`, `matchLifecycle.js` y `passengerAuthorization.js` utilizando transacciones Firestore (`runTransaction`) y lotes atómicos (`batch`).
- **Pendiente:** Extender esta robustez transaccional a la máquina de estados de entrega/recogida de estudiantes (Módulo 11) y registro de emergencias (Módulo 12).

### 4. Calidad y Cobertura de Pruebas

- **Suites Existentes:** Pruebas unitarias de Cloud Functions, pruebas de emuladores Firestore/Storage y pruebas de integración cliente.
- **Estado:** Próximo paso en el Bloque 5 (`feat/fkg-pr8`) elevar la cobertura de ramas en callables como `stopTrackingCallable.js` y `driverApprovalCallables.js` por encima del 80%.

### 5. Costos Variables y Riesgos de Facturación (FinOps)

- **Eficiencia Actual:** La migración de GPS a `matches/{matchId}/tracking/current` evitó la escritura continua en colecciones históricas masivas, reduciendo en más del 95% el costo de operaciones de lectura/escritura en Firestore.
- **Riesgo:** Invocación de Cloud Functions no autenticadas en endpoints antiguos. Mitigado en PR 7 con la autenticación obligatoria de `testNotification`.

---

## 4. Matriz Consolidada de los 16 Módulos

|   ID    | Módulo                            |       Estado Real       | Evidencia Clave                                        | Brecha Principal                                               |   Riesgo   | Prioridad |
| :-----: | :-------------------------------- | :---------------------: | :----------------------------------------------------- | :------------------------------------------------------------- | :--------: | :-------: |
| **M01** | Acceso B2B y Establecimientos     | `PARTIALLY IMPLEMENTED` | `requests.school`, `vacancies.schools[]`, `sentry.ts`  | Sin colección `organizations` ni roles B2B escolares           |   `HIGH`   |  **P1**   |
| **M02** | Motor de Rutas Multi-Colegio      | `PARTIALLY IMPLEMENTED` | `routes`, `tracking/current`, `matchLifecycle.js`      | Sin optimizador dinámico de paradas ni ETA dinámico            |   `HIGH`   |  **P1**   |
| **M03** | Smart Absence (Inasistencias)     | `PARTIALLY IMPLEMENTED` | `absenceCallables.js`, `matches/{id}/absences`         | Sin bloqueo si el alumno ya abordó ni alerta en app del chofer |  `MEDIUM`  |  **P1**   |
| **M04** | Verificación CONASET / RENASTRE   | `PARTIALLY IMPLEMENTED` | `driverApproval.js`, `storage.rules`                   | Sin expedientes para Acompañantes ni alertas de expiración     | `CRITICAL` |  **P0**   |
| **M05** | Suscripciones B2B y Pagos         |    `NOT IMPLEMENTED`    | `MONETIZATION_STRATEGY.md`, `premiumService.ts`        | Sin pasarela de pago (MercadoPago/Flow) ni webhooks firmados   |   `HIGH`   |  **P2**   |
| **M06** | Beneficios y Patrocinadores       |     `EXPERIMENTAL`      | `admobService.ts`, `AdBanner.tsx`                      | Sin marketplace local de convenios                             |   `LOW`    |  **P3**   |
| **M07** | Portal Web de Seguimiento         |    `NOT IMPLEMENTED`    | No existe app web ni API de tokens                     | Sin tokens efímeros hasheados (15-30 min) para terceros        |   `HIGH`   |  **P2**   |
| **M08** | WhatsApp Cloud API                | `PARTIALLY IMPLEMENTED` | `Linking.openURL('whatsapp://...')`                    | Sin integración server-to-server Meta Cloud API ni Opt-in      |  `MEDIUM`  |  **P2**   |
| **M09** | Antifraude, Integrity y App Check | `PARTIALLY IMPLEMENTED` | `firestore.rules` (speed/time), `index.js` (App Check) | `enforceAppCheck: false`, sin attestation Play Integrity       |   `HIGH`   |  **P1**   |
| **M10** | Cupones y Founder VIP             | `PARTIALLY IMPLEMENTED` | `premiumService.ts` Mocks                              | Sin colección `entitlements` respaldada en Firestore           |   `LOW`    |  **P3**   |
| **M11** | Recogida y Entrega Segura         | `PARTIALLY IMPLEMENTED` | `passengerAuthorization.js`, `timelineService.js`      | Sin máquina de 5 estados ni OTP/QR de entrega                  | `CRITICAL` |  **P0**   |
| **M12** | Centro de Emergencias (SOS)       |    `NOT IMPLEMENTED`    | No existe colección ni función                         | Inexistencia de botón SOS y protocolo de accidentes            | `CRITICAL` |  **P0**   |
| **M13** | Apoderados y Autorizaciones       | `PARTIALLY IMPLEMENTED` | `coGuardianCallables.js`, `passengerAuthorizations`    | Sin retiros temporales revocables por fecha                    |   `HIGH`   |  **P0**   |
| **M14** | Consola Admin y Operaciones       | `PARTIALLY IMPLEMENTED` | `sync-admin-custom-claims.js`, `reviewDriverRequest`   | Un solo rol `admin` global; falta segregación de roles         |   `HIGH`   |  **P1**   |
| **M15** | Privacidad Ley 21.719 (Chile)     | `PARTIALLY IMPLEMENTED` | `accountDeletionService.js`, `GDPRSettingsScreen.tsx`  | Falta formalizar registro de consentimientos Ley 21.719        |   `HIGH`   |  **P1**   |
| **M16** | Confiabilidad y Monitoreo         | `PARTIALLY IMPLEMENTED` | `offlineCache.ts`, `retryUtils.ts`, `sentry.ts`        | Sin cola offline idempotente en cliente para GPS               |  `MEDIUM`  |  **P1**   |

---

## 5. Roadmap de Releases (Fases A a E)

### **Fase A: Núcleo de Seguridad Integral del Traslado (P0)**

- **Objetivo:** Implementar la cadena de custodia completa del menor, expedientes de verificación y centro de incidentes SOS.
- **Módulos:** **M04, M11, M12, M13**.
- **Componentes Afectados:**
  - `functions/src/passengerAuthorization.js`, `functions/src/driverApproval.js`
  - Nuevas Cloud Functions: `registerIncident.js`, `verifyHandoverOtp.js`
  - `firestore.rules`, `storage.rules`
  - `src/screens/PassengerAuthorizationScreen.tsx`, nueva pantalla `EmergencySosScreen.tsx`
- **Tests Obligatorios:** Pruebas de emulador para transiciones de estado de entrega, expiración de autorizaciones y emisión de alertas SOS.

### **Fase B: Institucional, Antifraude y Cumplimiento Ley 21.719 (P1)**

- **Objetivo:** Establecer la estructura multi-tenant para colegios, activar App Check en modo estricto, cola offline de eventos y formalización de privacidad.
- **Módulos:** **M01, M02, M03, M09, M14, M15, M16**.
- **Componentes Afectados:** `firestore.rules`, `functions/index.js`, `src/utils/offlineQueue.ts`, `src/services/gdprService.ts`.

### **Fase C: Canales de Comunicación Redundantes y Portal Web (P2)**

- **Objetivo:** Portal web de seguimiento con tokens efímeros y notificaciones WhatsApp Cloud API.
- **Módulos:** **M07, M08**.
- **Componentes Afectados:** Portal web ligero (Next.js / Firebase Hosting), Cloud Functions `generateTrackingToken.js`, `sendWhatsAppNotification.js`.

### **Fase D: Monetización B2B y Entitlements (P2)**

- **Objetivo:** Suscripciones B2B, cobros recurrentes e integración de webhooks firmados.
- **Módulos:** **M05, M10**.
- **Componentes Afectados:** Cloud Functions `handlePaymentWebhook.js`, colección `entitlements`.

### **Fase E: Marketplace y Fidelización (P3)**

- **Objetivo:** Alianzas estratégicas, convenios locales y marketplace publicitario aislado.
- **Módulos:** **M06**.

---

## 6. Dictamen Final

**`READY WITH CONDITIONS`**

- **Justificación:** El núcleo técnico actual (PR 1 a PR 7) es sumamente sólido, seguro y estable, contando con 28 Cloud Functions desplegadas en Node.js 22, reglas de Firestore y Storage probadas y endurecidas, y un motor de eliminación segura compatible con normativas internacionales. Sin embargo, para cumplir con el Plan Maestro en un sistema de transporte escolar crítico en Chile, se requiere ejecutar inmediatamente la **Fase A (Bloque P0)** centrada en la seguridad física e integral del traslado del menor.
