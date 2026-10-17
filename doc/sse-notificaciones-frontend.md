# Notificaciones en tiempo real (SSE) — Guía para el frontend

## 1. Resumen

Hasta ahora los avisos del backend (solicitud de cita, reprogramación, cancelación, recordatorios…) salían **solo por push de OneSignal**, que es un canal exclusivo de la app móvil. La web no se enteraba de nada: para ver que había entrado una solicitud había que recargar.

Se añade un segundo canal de transporte, **SSE**, que entrega **los mismos avisos con el mismo contenido** a las pestañas web abiertas. No es un contrato nuevo: el objeto `data` que viaja aquí es idéntico al `additionalData` que recibe la app (documentado en `doc/citas_pacientes_onesignal.md` §3bis).

> **No es el primer canal SSE del proyecto.** El de actualización de menú
> (`GET /tenant/{tenantId}/menu/{menuId}/stream`) ya existía y está documentado en
> `doc/sse-real-time-menu-frontend.md`. Comparten infraestructura, autenticación y modo de
> reconexión, así que el servicio de cliente que ya tengáis se reutiliza casi tal cual.

Dos límites del alcance, deliberados:

- **Es efímero.** Lo que se emite con la web cerrada **se pierde**. No hay buzón, ni historial, ni contador de no leídas. Si hace falta una campanita con pendientes, es otra funcionalidad (tabla `notification` + endpoints).
- **Solo avisos.** No se emiten eventos por cada cambio de agenda; solo llega lo que genera una notificación.

---

## 2. Endpoint

```
GET /api/notifications/stream
Authorization: Bearer <JWT>
Accept: text/event-stream
```

Respuesta `200` con `Content-Type: text/event-stream`, `Cache-Control: no-cache` y `X-Accel-Buffering: no`.

**No lleva `/tenant/{tenantId}`**, a diferencia de casi todos los endpoints del proyecto. Es intencionado: las notificaciones son de una *persona*, no de un centro, y un profesional que trabaja en varios tenants quiere un único canal. Cada evento trae su `data.tenantId` para que filtres por el tenant activo si te conviene.

No hay forma de suscribirse al canal de otro usuario: el destinatario sale del JWT, no de la ruta.

| Código | Cuándo |
|---|---|
| `401` | Sin JWT o caducado |
| `404` | El JWT es válido pero su email no corresponde a ningún usuario |

---

## 3. Autenticación: `EventSource` nativo NO sirve

El `EventSource` del navegador **no permite cabeceras personalizadas**, así que no puede mandar el `Authorization: Bearer`. Es exactamente el mismo problema que ya resolvisteis para el stream de menú.

Usad el mismo cliente que ya está en el proyecto, **`@microsoft/fetch-event-source`** (ver `doc/sse-real-time-menu-frontend.md` §5, el servicio Angular de ahí vale casi tal cual cambiando la URL y el nombre del evento).

> No pidáis un token por query param: hoy el backend no lo acepta (no hay `BearerTokenResolver` configurado para ello) y además deja el JWT escrito en logs de acceso y en el historial de proxies.

---

## 4. Formato de los eventos

### 4.1 Evento `connected`

Se emite una sola vez, al abrir la conexión. Sirve para confirmar que el canal está vivo.

```
event: connected
data: {"title":null,"body":null,"data":{"type":"CONNECTED"},"occurredAt":"2026-10-17T09:14:02.118Z"}
```

### 4.2 Evento `notification`

Uno por cada aviso dirigido al usuario.

```
event: notification
data: {"title":"Nueva solicitud de cita",
       "body":"El paciente Ana García ha solicitado una cita para el 2026-11-05T10:00:00Z",
       "data":{"type":"APPOINTMENT_REQUESTED",
               "tenantId":"9c2b1f4e-...",
               "entityId":"7e4d0a11-...",
               "startTime":"2026-11-05T10:00:00Z"},
       "occurredAt":"2026-10-17T09:15:31.004Z"}
```

| Campo | Tipo | Notas |
|---|---|---|
| `title` | `string` | Título ya traducido al idioma del usuario (`AppUser.language`) |
| `body` | `string` | Cuerpo ya traducido, con la hora en la zona del usuario (`AppUser.timezone`) |
| `data` | `object` | Idéntico al `additionalData` del push. Todos sus valores son **cadenas** |
| `occurredAt` | `ISO 8601 UTC` | Momento en que el backend emitió el aviso |

Claves de `data`: `type`, `tenantId`, `entityId`, `startTime` y, solo en notas de calendario, `noteType` (`REMINDER` o `TIME_BLOCK`). Los ocho valores de `type` están tabulados en `doc/citas_pacientes_onesignal.md` §3bis.

> **Diferencia con el stream de menú.** `menu-update` es una mera *señal*: no trae datos y obliga a repedir el menú por REST. Aquí el evento **ya trae el texto que se muestra**, así que puedes pintar el toast directamente. El `data` sigue sirviendo para refrescar la vista afectada (`entityId` te dice qué cita o nota ha cambiado).

### 4.3 Comentarios de latido

```
: keep-alive
```

Cada ~20 s. Es un comentario SSE, no un evento: `@microsoft/fetch-event-source` lo ignora solo. Existe porque muchos proxies cierran conexiones HTTP ociosas.

---

## 5. Qué hacer al recibir un `notification`

1. Mostrar el aviso (toast, campanita efímera, badge…) con `title` y `body`. Ya vienen traducidos: **no los construyas tú**.
2. Si `data.tenantId` no es el tenant activo en la sesión, decide si lo muestras o lo descartas. El backend no filtra por ti.
3. Refrescar la vista afectada según `data.type`:
   - `APPOINTMENT_REQUESTED` → bandeja de solicitudes
   - `APPOINTMENT_CREATED`, `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_CANCELLED` → agenda en la fecha de `data.startTime`
   - `CALENDAR_NOTE_REMINDER` → agenda en la fecha de `data.startTime`, que **puede no ser hoy**
4. No asumas orden ni entrega exactamente-una-vez. Si llega un aviso duplicado tras una reconexión, que repintar sea idempotente.

---

## 6. Reconexión y ciclo de vida

- El servidor **cierra la conexión a los 30 minutos** para forzar una reconexión limpia. No es un error: hay que reconectar.
- Con `@microsoft/fetch-event-source`, `onclose` debe lanzar para que la librería reintente, y `onerror` devolver un intervalo (p. ej. `3000`) para reintentar indefinidamente. Es el mismo patrón que el stream de menú.
- **Lo emitido mientras estabas desconectado se pierde.** No hay `Last-Event-ID` ni replay. Tras reconectar conviene refrescar las vistas abiertas por REST, porque puedes haberte perdido avisos durante la ventana.
- Abrir varias pestañas es correcto: cada una es una suscripción y **todas** reciben el evento.

---

## 7. Operación

- **El registro de conexiones es en memoria, por nodo.** Con varias instancias detrás de un balanceador, un usuario conectado al nodo A no recibiría lo que emite el nodo B. El despliegue actual es de un único backend; escalar horizontalmente exigiría un bus distribuido (Redis pub/sub, Kafka). Misma limitación que el stream de menú.
- Si hay nginx por delante: `proxy_buffering off` y un `proxy_read_timeout` mayor que el latido. El backend ya manda `X-Accel-Buffering: no`.
- Intervalo del latido configurable con `NOTIFICATION_STREAM_HEARTBEAT_MS` (por defecto 20000).

---

## 8. Probar el endpoint manualmente

```bash
# Deja la conexión abierta e imprime los eventos según llegan
curl -N -H "Authorization: Bearer $JWT" -H "Accept: text/event-stream" \
     localhost:8081/api/notifications/stream
```

Para provocar un aviso, basta con generar cualquiera de los ocho eventos (p. ej. que un paciente solicite cita con ese nutricionista). **El canal web funciona aunque OneSignal no esté configurado**, así que en local se puede probar sin credenciales de push.

---

## 9. Checklist de integración

- [ ] Usar `@microsoft/fetch-event-source`, no `EventSource` nativo (no puede mandar el Bearer).
- [ ] Reconectar al cerrarse la conexión (el servidor corta a los 30 min) y refrescar por REST tras reconectar.
- [ ] Ignorar los comentarios `: keep-alive`.
- [ ] Filtrar por `data.tenantId` contra el tenant activo, si la sesión es multicentro.
- [ ] Pintar `title`/`body` tal cual; ya vienen traducidos.
- [ ] Para `CALENDAR_NOTE_REMINDER`, abrir la agenda en `data.startTime`, que puede ser de dentro de varios días.
- [ ] Hacer idempotente el repintado: puede llegar un duplicado tras reconectar.
- [ ] No esperar historial: lo emitido con la web cerrada no se recupera.

---

## 10. Archivos backend implicados

| Archivo | Rol |
|---|---|
| `controller/NotificationStreamController.java` | `GET /notifications/stream` |
| `service/NotificationStreamService.java` | Registro de conexiones por usuario, entrega y latido |
| `models/dto/NotificationEvent.java` | Forma del evento |
| `service/PushNotificationService.java` | **Modificado**: reparte cada aviso por push y por SSE |
| `application.yaml` | `app.notification-stream.heartbeat-ms`, `spring.task.scheduling.pool.size` |
