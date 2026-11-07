---
id: chat-frontend-contract
type: submodule-design
title: Chat 1:1 — contrato para Angular
status: draft
parent: chat
---

# Chat 1:1 — contrato para Angular

> **Estado:** backend implementado en esta rama.
> **Base:** `context-path` `/api`.
> **Autenticación:** `Authorization: Bearer <JWT>` en todas las llamadas REST y en el stream SSE.
> **Tiempo real:** SSE con `@microsoft/fetch-event-source` (el `EventSource` nativo no permite enviar el Bearer).

---

## 1. Resumen

El chat es **1:1** entre un paciente y un nutricionista dentro de un tenant.

- Un hilo es único por `(tenant, paciente, nutricionista)`.
- Los mensajes pueden ser `TEXT` o `IMAGE`.
- Solo hay **un adjunto de imagen por mensaje** (JPEG, PNG o WebP; máximo 5 MB).
- La lista de mensajes se pagina hacia atrás con un cursor opaco.
- Los mensajes borrados se muestran como “mensaje eliminado”.
- Las imágenes se sirven con URL firmada de MinIO (TTL por defecto: 10 minutos).
- El push solo dice que hay un mensaje nuevo: **nunca incluye el contenido**.

---

## 2. Endpoints

### 2.1 Listar hilos

```http
GET /api/tenant/{tenantId}/chat/threads?archived=false&unreadOnly=false&page=0&size=20
```

- `archived` por defecto `false`.
- `unreadOnly` por defecto `false`.
- El backend devuelve solo los hilos en los que participa el usuario autenticado.

Respuesta:

```json
{
  "content": [
    {
      "id": "uuid",
      "patient": { "id": "uuid", "firstName": "Ana", "lastName": "García" },
      "nutritionist": { "id": "uuid", "firstName": "Luis", "lastName": "Pérez" },
      "lastMessage": {
        "id": "uuid",
        "kind": "TEXT",
        "preview": "Nos vemos el jueves",
        "senderId": "uuid",
        "createdAt": "2026-10-29T10:15:00Z"
      },
      "lastMessageAt": "2026-10-29T10:15:00Z",
      "unreadCount": 3,
      "archived": false
    }
  ],
  "page": { "size": 20, "number": 0, "totalElements": 1, "totalPages": 1 }
}
```

Orden: `lastMessageAt DESC NULLS LAST`.

### 2.2 Crear u obtener hilo

```http
POST /api/tenant/{tenantId}/chat/threads
Content-Type: application/json

{ "patientId": "uuid", "nutritionistId": "uuid-opcional" }
```

- **Profesional** (`MANAGE_CHAT`): `patientId` es obligatorio (si falta: `400
  error.chat_patient_not_in_tenant`). El nutricionista es el usuario autenticado.
- En el camino de paciente, el nutricionista resuelto debe ser `STAFF`; si no lo es o no hay
  titular: `409 error.chat_no_assigned_nutritionist`.
- **Paciente**: `patientId` se ignora. Se usa su nutricionista titular (`assignedNutritionist`) si no se envía `nutritionistId`.
- Si el hilo ya existe, se devuelve el existente (idempotente), no un 409.

### 2.3 Obtener un hilo

```http
GET /api/tenant/{tenantId}/chat/threads/{threadId}
```

Mismo objeto que un elemento de la lista.

### 2.4 Listar mensajes

```http
GET /api/tenant/{tenantId}/chat/threads/{threadId}/messages?before=<cursor>&limit=30
```

- `limit`: 1–100; por defecto 30.
- Sin `before`, devuelve los últimos mensajes.
- `items` viene ordenado del más reciente al más antiguo.

Respuesta:

```json
{
  "items": [
    {
      "id": "uuid",
      "threadId": "uuid",
      "senderId": "uuid",
      "kind": "TEXT",
      "content": "Hola",
      "createdAt": "2026-10-29T10:10:00Z",
      "editedAt": null,
      "deleted": false,
      "attachment": null
    }
  ],
  "nextCursor": "MjAyNi0xMC0yOVQxMDoxMDowMFp8dXVpZA==",
  "hasMore": true
}
```

Para cargar mensajes antiguos, envía `before=nextCursor` de la página anterior. No hay paginación hacia delante en v1: los mensajes nuevos llegan por SSE o se recarga la primera página.

Los mensajes borrados llegan con:

```json
{
  "deleted": true,
  "content": null,
  "attachment": null
}
```

### 2.5 Enviar mensaje

Un único endpoint `multipart/form-data`:

```http
POST /api/tenant/{tenantId}/chat/threads/{threadId}/messages
Content-Type: multipart/form-data

content: "Hola, adjunto la foto"
file: <binary opcional>
```

- Exactamente uno de `content` o `file` debe estar presente.
- `content` máximo 2.000 caracteres; se eliminan espacios en los extremos y si supera el
  máximo se rechaza con `400 error.chat_message_too_long` (no se trunca).
- `file` máximo 5 MB; MIME real validado por magic bytes.
- Respuesta `201` con el `ChatMessageDto`.

Ejemplo Angular:

```ts
const form = new FormData();
form.append('content', text);
// o, para imagen:
form.append('file', file);

return this.http.post<ChatMessage>(url, form);
```

### 2.6 Marcar leído

```http
PATCH /api/tenant/{tenantId}/chat/threads/{threadId}/read
Content-Type: application/json

{ "lastReadMessageId": "uuid" }
```

- Respuesta `204`.
- El backend emite un evento SSE `read` a la otra parte.

### 2.7 Borrar mensaje

```http
DELETE /api/tenant/{tenantId}/chat/threads/{threadId}/messages/{messageId}
```

- Solo el emisor puede borrar su propio mensaje.
- Borrado lógico: la conversación mantiene el hueco.
- Respuesta `204`.

### 2.8 Refrescar URL de adjunto

```http
GET /api/tenant/{tenantId}/chat/attachments/{attachmentId}/url
```

Respuesta:

```json
{
  "id": "uuid",
  "fileName": "foto.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 123456,
  "url": "https://minio.../firmada",
  "urlExpiresAt": "2026-10-29T10:25:00Z"
}
```

Úsalo cuando la URL del mensaje haya caducado (TTL 10 minutos por defecto). No guardes la URL en caché más allá de `urlExpiresAt`.

### 2.9 Archivar / desarchivar hilo

```http
PATCH /api/tenant/{tenantId}/chat/threads/{threadId}/archive
Content-Type: application/json

{ "archived": true }
```

- Respuesta `204`.
- Archivar no borra mensajes: solo oculta el hilo de la lista del actor.

---

## 3. SSE

### 3.1 Endpoint

```http
GET /api/tenant/{tenantId}/chat/threads/{threadId}/stream
Accept: text/event-stream
Authorization: Bearer <JWT>
```

Respuesta `200` con `Content-Type: text/event-stream`, `Cache-Control: no-cache` y
`X-Accel-Buffering: no`.

Usa `@microsoft/fetch-event-source`:

```ts
import { fetchEventSource } from '@microsoft/fetch-event-source';

fetchEventSource(`${api}/tenant/${tenantId}/chat/threads/${threadId}/stream`, {
  headers: { Authorization: `Bearer ${token}` },
  onmessage(event) {
    if (!event.event || !event.data) return;
    const payload = JSON.parse(event.data);
    switch (event.event) {
      case 'connected': /* canal listo */ break;
      case 'message': /* añadir mensaje */ break;
      case 'message-deleted': /* marcar como eliminado */ break;
      case 'read': /* actualizar ticks de leído */ break;
    }
  },
  onclose() { throw new Error('reconnect'); },
  onerror() { return 3000; },
});
```

### 3.2 Eventos

| Evento | `data` | Cuándo |
|---|---|---|
| `connected` | `{ "type": "CONNECTED", "threadId": "uuid" }` | Al abrir la conexión. |
| `message` | `ChatMessageDto` completo | Mensaje nuevo. Incluye la URL firmada si es imagen. |
| `message-deleted` | `{ "messageId": "uuid", "threadId": "uuid" }` | Borrado lógico. |
| `read` | `{ "userId": "uuid", "lastReadMessageId": "uuid", "readAt": "ISO-8601" }` | La otra parte ha leído. |

- El servidor cierra la conexión a los 30 minutos. No es un error: reconecta.
- Al reconectar, recarga la primera página de mensajes; no hay replay de eventos.
- Los comentarios `: keep-alive` se ignoran automáticamente.

### 3.3 Redis

El backend publica los eventos por Redis (`chat:thread:{threadId}`) y cada nodo entrega a sus
propias conexiones SSE. El frontend no cambia nada: sigue hablando con un único endpoint SSE.
Si Redis no está disponible, el backend degrada a entrega local en un solo nodo.

---

## 4. Imágenes

1. El backend valida tamaño y **magic bytes** (no confía en la extensión).
2. Sube el objeto a MinIO en un bucket privado.
3. Devuelve `url` y `urlExpiresAt` en el DTO.
4. El navegador carga la imagen directamente desde MinIO; no pasa por el backend.
5. Si la URL caduca, llama a `GET .../attachments/{id}/url`.

No se debe registrar la URL firmada en logs ni enviarla por push.

---

## 5. Push

El receptor recibe un push con:

```json
{
  "type": "CHAT_MESSAGE",
  "tenantId": "uuid",
  "entityId": "threadId",
  "threadId": "uuid",
  "messageId": "uuid"
}
```

El título/cuerpo son genéricos (`"Nuevo mensaje"`, `"<nombre> te ha enviado un mensaje"`).
Nunca contienen el texto del mensaje ni datos clínicos.

---

## 6. Errores

Formato: `application/problem+json` con `code`, `detail` y `traceId`.

| Código | HTTP | Cuándo |
|---|---|---|
| `error.chat_thread_not_found` | 404 | Hilo inexistente al crearlo/obtenerlo por servicio. En los endpoints de un hilo concreto (obtener, mensajes, enviar, leer, borrar, archivar, stream) un hilo inexistente o ajeno da `403 error.permission_denied`, porque los protege `isChatParticipant`. |
| `error.chat_message_not_found` | 404 | Mensaje inexistente en el hilo. |
| `error.chat_attachment_not_found` | 404 | Adjunto inexistente o mensaje borrado. |
| `error.chat_patient_not_in_tenant` | 404 | El paciente no pertenece al tenant. |
| `error.chat_no_assigned_nutritionist` | 409 | El paciente no tiene nutricionista titular. |
| `error.chat_empty_message` | 400 | Ni texto ni imagen. |
| `error.chat_message_too_long` | 400 | Texto > 2.000 caracteres. |
| `error.chat_invalid_cursor` | 400 | Cursor mal formado. |
| `error.chat_attachment_too_large` | 413 | Imagen > 5 MB. |
| `error.chat_unsupported_media_type` | 415 | No es JPEG/PNG/WebP real. |
| `error.chat_not_message_owner` | 403 | Intento de borrar un mensaje ajeno. |
| `error.permission_denied` | 403 | El usuario no participa en el hilo (o el hilo no existe). Ningún endpoint exige permiso de staff: sin `MANAGE_CHAT` se sigue el camino de paciente. |

---

## 7. Checklist de integración Angular

- [ ] Servicio `ChatApiService` con todos los endpoints.
- [ ] Lista de hilos con `unreadCount` y filtro de archivados.
- [ ] Pantalla de conversación con paginación por `before`.
- [ ] Envío de texto y de una imagen (`FormData`).
- [ ] SSE con `@microsoft/fetch-event-source`, no `EventSource`.
- [ ] Reconexión al cerrar el stream y recarga de la primera página.
- [ ] Marcar leído al entrar y al recibir un mensaje visible.
- [ ] Refresco de URL de imagen al caducar.
- [ ] Borrado propio con confirmación y render de “mensaje eliminado”.
- [ ] Push `CHAT_MESSAGE` abre el hilo correcto (`threadId`).
- [ ] No mostrar contenido clínico en notificaciones.
