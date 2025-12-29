# Analytics Dashboard (MVP)

Objetivo: medir captación, conversión y monetización sin cambiar UX.

## Eventos clave

### Sesión / Pantallas

- `session_start`
  - Se dispara al iniciar la app.
- `screen_view`
  - Param: `screen_name`
  - Se dispara cuando cambia de pantalla (React Navigation).
- `screen_time`
  - Params: `screen_name`, `screen_duration_seconds`
  - Uso futuro si decides medir tiempo real por pantalla.

### Funnel (captación / conversión)

- `search_attempt`
  - Params: `role`, `zone`, `schedule`
- `search_results`
  - Params: `role`, `zone`, `schedule`, `result_count`, `empty`
- `contact_initiated`
  - Params: `role`, `target_user_id`
- `return_after_contact`
  - Params: `role`, `elapsed_ms`
- `post_contact_ad`
  - Params: `placement`, `ads_disabled`, `loaded`, `shown`

### Ads (monetización)

- `ad_load_attempt`
- `ad_loaded`
- `ad_load_failed`
- `ad_show_attempt`
- `ad_shown`
- `ad_show_failed`
- `ad_impression`
- `ad_click`
- `ad_revenue`
  - Para revenue real: `value_micros`, `currency`, `precision`

### Health (estabilidad/rendimiento)

- `perf`
  - Params: `name`, `duration_ms`, `screen`, `role`, `ok`, `result_count`
  - Ejemplos: `search_fetch`, `auth_load_profile`
- `app_error`
  - Params: `message`, `tag`, `action`, `fatal`

## Qué mirar primero (prioridad)

1. Oferta/Demanda

- % de `search_results` con `empty=true` por `zone` y `role`

2. Conversión a contacto

- Ratio aproximado: `contact_initiated / search_attempt` por `zone`

3. Monetización sin dañar conversión

- `post_contact_ad(shown=true)` vs cambios en `contact_initiated` en siguientes sesiones

4. Fricción técnica

- `perf{name=search_fetch}` p95 por zona
- `app_error{tag=auth}` (bloqueos de login/registro)
