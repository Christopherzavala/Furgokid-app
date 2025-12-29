# Play Console / AdMob — Go-Live Checklist (FurgoKid)

Este checklist está pensado para **activar monetización real** cuando tu cuenta de Play Console esté lista, minimizando riesgo de políticas (invalid traffic, App content incompleto, consent).

## 1) Play Console (antes de subir build)

- Crear la app (Android) en Play Console.
- Completar **App content**:
  - Privacy Policy URL (ya existe `PRIVACY_POLICY.md` → publícala en una URL).
  - Data Safety (qué datos recolectas/compartes; ubicación, analytics, etc.).
  - Ads: marcar que la app **muestra anuncios**.
  - Target audience / contenido para niños: confirmar y configurar correctamente.
- Crear **Internal testing** (mínimo) y agregar testers.

## 2) AdMob (antes de activar PROD)

- Registrar la app en AdMob.
- Crear Ad Units (banner/interstitial) y validar que coinciden con lo usado en código.
- Vincular AdMob ↔ Play Store cuando la ficha exista.
- Verificar que el “safety switch” sigue activo en builds previas (solo test ads).

## 3) Consent / compliance (recomendación)

- Mantener `requestNonPersonalizedAdsOnly` (NPA) mientras no implementes UMP.
- Si apuntas a EEA/UK/usuarios europeos: implementar UMP antes de escalar.

## 4) Release build + smoke test (mínimo)

En un dispositivo Android real (release o internal testing):

- Login / registro.
- Buscar → ver resultados.
- Contacto (WhatsApp/llamada) → volver a la app.
- TrackingMap: abrir y ver actualización en vivo.
- Revisar que no haya crashes y que `app_error` / `perf` lleguen a Analytics.

## 5) Activar anuncios reales (cuando todo esté listo)

- Cambiar flags runtime en `app.config.js` (o via EAS env):
  - `adsMode=prod`
  - `adsForceTest=0`
- Rebuild nativo (EAS) y validar en internal testing.

## 6) Monitoreo primeros 3 días

- En Firebase Analytics:
  - `ad_loaded`, `ad_impression`, `ad_revenue`, `ad_show_failed`.
  - `search_attempt` → `search_results` → `contact_initiated` (si existe) / retorno.
  - `app_error` y `perf` (picos).
- Si cae conversión a contacto, subir cooldown/cap de interstitial o mover placements.
