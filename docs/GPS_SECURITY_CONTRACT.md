# Furgokid v1 — Contrato de GPS por emparejamiento

## Decisión de modelo

Furgokid v1 conserva **únicamente la ubicación actual del conductor por emparejamiento**. La
ruta canónica es:

```text
matches/{matchId}/tracking/current
```

El modelo real de `matches` ya contiene `parentId`, `driverId` y `status`; por tanto no se
introduce una colección global de tracking ni se reutiliza el `routeId` legado como si
identificara un emparejamiento. `locations`, `trackingPoints` y `tracking/current` dejan de
generarse y no constituyen rutas de escritura del cliente.

## Identidad y autorización

La identidad autoritativa del conductor es `Firebase Auth request.auth.uid`. Las reglas
comprueban, en la misma operación:

1. que el usuario exista en `users/{uid}`;
2. que su perfil sea `role == 'driver'` y `approved == true`;
3. que `matches/{matchId}` exista y tenga `status == 'active'`;
4. que `matches/{matchId}.driverId == request.auth.uid`.

`driverId` y `matchId` no se almacenan como autoridad en el documento de ubicación. El
`matchId` está implícito en la ruta y el `driverId` se deriva de Auth y del match. Un
conductor no puede publicar en otro match, suplantar otro conductor ni publicar para un
match pendiente, cerrado o cancelado.

## Permisos por operación

| Operación                        | Actor permitido                                 | Condiciones adicionales                                      |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Publicar ubicación actual        | Conductor autenticado, aprobado y asignado      | Match `active`; documento y coordenadas válidos              |
| Leer ubicación actual            | Padre o conductor asignado, y admin break-glass | Match `active`; ubicación fresca                             |
| Detener GPS                      | Conductor autenticado y asignado al match       | Limpieza backend idempotente; no cambia el match             |
| Limpiar al cerrar/cancelar match | Backend                                         | Borra sólo `tracking/current`; no cambia el estado del match |
| Limpiar al revocar aprobación    | Backend                                         | Borra los puntos actuales de todos los matches asignados     |
| Limpiar al cerrar sesión         | Callable backend autenticada                    | Escanea todos los matches asignados al UID autenticado       |
| Eliminar match                   | Backend                                         | Borra el punto actual huérfano mediante trigger de borrado   |

Un padre, un conductor no aprobado, un conductor ajeno, un usuario no autenticado y un
usuario sin perfil o sin campos requeridos reciben denegación.

## Forma del documento actual

`matches/{matchId}/tracking/current` contiene exclusivamente:

```text
latitude: number (-90..90)
longitude: number (-180..180)
speed: number (>= 0)
active: true
updatedAt: timestamp
```

No se permite añadir `driverId`, `matchId`, `userId`, roles, estados de aprobación ni otros
campos. No existe historial GPS en el modelo v1.

## Estados y comportamiento fail-closed

- `pending`: no se puede publicar ni se considera seguimiento operativo.
- `active`: sólo el conductor asignado/aprobado publica; participantes autorizados leen.
- `completed` o `cancelled`: no se puede publicar; la ubicación se elimina y deja de leerse.

La ausencia de match, perfil, campos requeridos o timestamp se trata como denegación.

## Detención, cierre de sesión y fallos

- Detener el GPS primero detiene el sensor y después solicita al backend que elimine el
  punto actual. La operación es idempotente y nunca modifica el estado del match.
- Firebase Auth no ofrece un trigger de `signOut`. El cliente, por tanto, invoca una
  callable de limpieza autenticada y **no completa el logout si el backend no confirma la
  limpieza**. Un cierre de sesión exitoso en el flujo normal implica limpieza confirmada.
  Un cierre por crash, terminación del proceso o red no puede tener esa garantía inmediata.
- Un scheduler elimina periódicamente puntos `current` obsoletos. Esto limita la ventana de
  un fallo abrupto y evita depender exclusivamente de que el móvil ejecute una llamada.
- Si se pierde la aprobación durante el seguimiento, las siguientes escrituras son
  denegadas y un trigger de perfil limpia los puntos actuales de todos los matches
  asignados a ese UID.
- Un fallo de red en una actualización no se interpreta como publicación correcta; la
  siguiente actualización útil reintenta. El inicio exige que una primera publicación
  autorizada tenga éxito antes de reportarse como activo.

## Privacidad

La ubicación se reduce a un único documento por match. No se almacenan trazas, no se
conservan coordenadas antiguas y no se transfiere una ruta global que pueda eludir la
autorización por match.
