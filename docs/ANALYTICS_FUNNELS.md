# Analytics Funnels (P1)

## Objetivo

Medir conversión real y detectar drop-offs.

## Eventos recomendados

- `sign_up` (ya existe)
- `login` (ya existe)
- `screen_view` (ya existe)
- `create_request_start`
- `create_request_complete`
- `driver_matched`
- `email_verified`

## Funnel 1: Signup

1. `screen_view` Register
2. `sign_up`
3. `email_verified`
4. `login`

## Funnel 2: Primera solicitud (Parent)

1. `screen_view` ParentHome
2. `create_request_start`
3. `create_request_complete`
4. `driver_matched`

## Importante

- Respetar consentimiento: si analytics está deshabilitado, no emitir eventos.
- Mantener nombres de eventos estables para comparar versiones.
