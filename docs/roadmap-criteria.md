# Roadmap: Criterios de Aceptacion

## Fase 5: Production Release

- Firebase Analytics: habilitar solo cuando Expo SDK 55 sea estable; flag de activacion; eventos minimos (screen_view, session_start, error/perf); sin PII; gating por consentimiento.
- Sentry: DSN via env/EAS Secret; sample rate definido; releases etiquetadas; scrubbing de PII; breadcrumbs minimos; alertas para crash rate y errores de red.
- Builds de produccion: perfiles EAS prod/preview; smoke tests post-build (arranque, login, mapa, ads/premium visibles segun flags); checklist de store (iconos, screenshots, privacy labels).

## Fase 7: Integraciones y QA End-to-End

- Backend seguro: endpoints definidos (datos de usuario, rutas); auth con Firebase ID tokens; validacion de esquemas; rate limiting y logs sanitizados; SLA basico.
- Monetizacion premium (Stripe/IAP): flujo de compra y restauracion; validacion de recibos (server-side o RevenueCat-like); cache de entitlements; fallback/offline; manejo de reembolsos.
- E2E con Detox: casos criticos (onboarding, login, mapa, ads visibles, paywall/premium, errores de red); fixtures/seed de datos; ejecucion en CI con flake budget; capturas de pantalla en fallo.
- Activacion Firebase Analytics: checklist de compatibilidad Expo SDK 55; toggle remoto para activacion gradual; naming y params normalizados; verificacion de performance/consumo.

### Propietarios y fechas sugeridas

- Backend seguro: Owner Backend; ETA 2 sprints; dependencia de definicion de contratos de datos.
- Stripe/IAP: Owner Mobile/Payments; ETA 2-3 sprints; requiere llaves de prueba y flujo de recibos.
- Sentry: Owner Mobile; ETA 1 sprint; bloqueado solo por DSN en secrets.
- Detox E2E: Owner QA/Automation; ETA 2 sprints; depende de fixtures y CI runner.
- Firebase Analytics (SDK 55): Owner Mobile; ETA 1 sprint post-upgrade; habilitacion gradual via toggle remoto.

### Metricas de salida (KPIs)

- Crash-free sessions: >= 99.5% (Sentry).
- Tiempo de arranque frio: <= 2.5s en dispositivos target (Android 8+ mid-range, iOS 13+ iPhone 8+).
- Latencia p95 de endpoints backend: <= 400ms en rutas criticas (conexion 4G estable).
- Exito de compra/restauracion premium: >= 98% de flujos sin error.
- Flakiness E2E (Detox): < 2% en ejecuciones CI.
- Precision de eventos Analytics: < 1% de eventos mal formados o sin params requeridos.

**Dispositivos target para benchmarking:**

- Android: Samsung Galaxy A52 (Android 11), Xiaomi Redmi Note 10 (Android 11+), Google Pixel 5a (Android 12+).
- iOS: iPhone 8 (iOS 13+), iPhone 11 (iOS 14+), iPhone SE 3rd gen (iOS 15+).
- Conexion: WiFi estable + 4G LTE (download ~10 Mbps, upload ~5 Mbps, latencia ~50ms).

### Plan de accion inmediato (orden sugerido)

- Secrets y toggles: configurar DSN de Sentry y toggles remotos para Analytics (off por default) y sample rate; validar en CI que existan.
- EAS perf/prod: crear perfiles prod y preview; smoke tests post-build (arranque, login, mapa, ads/premium segun flags); guardar checklist de store.
- Backend seguro: definir contratos de datos y validacion de esquemas; habilitar verificacion de Firebase ID tokens; agregar rate limiting y logging sanitizado.
- Stripe/IAP: habilitar llaves de prueba; flujo de compra/restauracion y validacion de recibos; cache de entitlements con fallback offline; manejo de reembolsos.
- Sentry rollout: activacion con sample rate controlado, scrubbing de PII y tagging por version/dispositivo; alertas por crash rate y fallos de red.
- Detox E2E: seed/fixtures para onboarding/login/mapa/paywall; correr en CI con retry limitado y capturas en fallo; monitorear flakiness (<2%).
- Firebase Analytics (SDK 55+): checklist de compatibilidad, activacion gradual via toggle remoto; normalizar nombres/params y medir overhead de performance.

### Backlog accionable (issues sugeridos)

- Backend seguro: "Backend secure endpoints + token verification" (Owner Backend, ETA 2 sprints).
- Stripe/IAP: "Implementar compras + restauracion + validacion de recibos" (Owner Mobile/Payments, ETA 2-3 sprints).
- Sentry: "Rollout Sentry con scrubbing y alertas" (Owner Mobile, ETA 1 sprint; depende de DSN en secrets).
- Detox: "Suite E2E critica (onboarding/login/mapa/paywall) en CI" (Owner QA, ETA 2 sprints; fixtures listas).
- EAS: "Perfiles prod/preview + smoke tests post-build" (Owner Mobile, ETA 1 sprint).
- Analytics: "Activar Firebase Analytics post SDK55 con toggle remoto" (Owner Mobile, ETA 1 sprint post-upgrade).
