# Plan independiente — Sistema de chat

> **Objetivo:** chat 1:1 entre paciente y nutricionista, con texto, imágenes en MinIO, actualización en tiempo real por SSE, push y contador de no leídos.
> **Prerrequisito:** MinIO operativo con `StorageService` y tabla `stored_file` (ver `README.md` §2).
> **Ámbito:** backend Spring Boot + contrato para frontend Angular.
> **Estimación:** 3–4 semanas de un backend dedicado, incluyendo pruebas y documentación.
> **Estado:** backend v1 implementado en esta rama. Contrato Angular en `doc/contrato-api/chat/chat-frontend.md`.

---

## 1. Alcance

### Incluido

- Hilo de chat por combinación `(tenant, paciente, nutricionista)`.
- Mensajes de texto.
- Un adjunto de imagen por mensaje (JPEG, PNG, WebP; máximo 5 MB).
- Listado paginado por cursor.
- Marcado de leído y contador de no leídos.
- SSE por hilo para mensajes, borrados y confirmaciones de lectura.
- Push al receptor con aviso genérico, sin contenido clínico.
- Borrado lógico de mensajes propios.
- Auditoría básica de creación/borrado.

### Fuera de alcance v1

- Chat grupal.
- Múltiples adjuntos por mensaje.
- Vídeos, audios o documentos.
- Edición de mensajes (se puede añadir en v1.1).
- Indicador de “escribiendo…” (v1.1).
- Buzón de notificaciones persistente; el chat tiene su propio contador de no leídos.
- Moderación automática de contenido.
- Antivirus de adjuntos.
- Multi-nodo con Redis pub/sub (v1.1; ver §7.4).

---

## 2. Decisiones de diseño

| Decisión | Elección | Motivo |
|---|---|---|
| Un hilo por paciente y nutricionista | `UNIQUE (tenant_id, patient_id, nutritionist_id)` | Evita duplicados y conversaciones dispersas. |
| Creación del hilo | Explícita por el nutricionista o el paciente | Control de permisos y de a quién se escribe. |
| Adjuntos | Un `stored_file` por mensaje | Simplicidad; la galería múltiple puede esperar. |
| Tipo de mensaje | `TEXT` o `IMAGE` | Permite validar y renderizar distinto en Angular. |
| Paginación | Cursor `(created_at, id)` | Estable con mensajes nuevos; no salta páginas. |
| Tiempo real | SSE por hilo | Ya hay patrón probado en el proyecto. |
| Multi-nodo | En memoria v1; interfaz preparada para Redis | No añadir dependencia hasta que haya más de una instancia. |
| Imágenes | MinIO + URL firmada | Bucket privado; nunca URL pública. |
| Push | Solo aviso genérico | Privacidad: el contenido no viaja por OneSignal. |
| Borrado | Lógico (`deleted_at`) | Trazabilidad y huecos visibles (“mensaje eliminado”). |

---

## 3. Modelo de datos

Migración `V54__create_chat_tables.sql` (la última aplicada es `V53`; renumerar si otra rama ya usa `V54`).

### 3.1 `chat_thread`

```sql
CREATE TABLE chat_thread (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL,
    patient_id          UUID        NOT NULL,
    nutritionist_id     UUID        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at     TIMESTAMPTZ,
    patient_archived_at TIMESTAMPTZ,
    nutritionist_archived_at TIMESTAMPTZ,
    CONSTRAINT fk_chat_thread_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_thread_patient
        FOREIGN KEY (patient_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_thread_nutritionist
        FOREIGN KEY (nutritionist_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT uq_chat_thread UNIQUE (tenant_id, patient_id, nutritionist_id),
    CONSTRAINT ck_chat_thread_distinct_users CHECK (patient_id <> nutritionist_id)
);

CREATE INDEX idx_chat_thread_nutritionist
    ON chat_thread (tenant_id, nutritionist_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_chat_thread_patient
    ON chat_thread (tenant_id, patient_id, last_message_at DESC NULLS LAST);
```

Notas:

- `patient_id` y `nutritionist_id` son `app_user.id`, no `user_tenant_role`. La pertenencia al tenant se valida en servicio.
- `last_message_at` se actualiza en la misma transacción que inserta el mensaje.
- Los campos `*_archived_at` permiten ocultar un hilo de la lista sin borrarlo.

### 3.2 `chat_message`

```sql
CREATE TABLE chat_message (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id   UUID        NOT NULL,
    tenant_id   UUID        NOT NULL,
    sender_id   UUID        NOT NULL,
    kind        VARCHAR(10) NOT NULL DEFAULT 'TEXT',
    content     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at   TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ,
    CONSTRAINT fk_chat_message_thread
        FOREIGN KEY (thread_id) REFERENCES chat_thread(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_message_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_message_sender
        FOREIGN KEY (sender_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_chat_message_kind CHECK (kind IN ('TEXT', 'IMAGE')),
    CONSTRAINT ck_chat_message_content CHECK (
        deleted_at IS NOT NULL
        OR (kind = 'TEXT' AND content IS NOT NULL AND length(btrim(content)) > 0)
        OR (kind = 'IMAGE' AND content IS NULL)
    )
);

CREATE INDEX idx_chat_message_thread
    ON chat_message (thread_id, created_at DESC, id DESC);
CREATE INDEX idx_chat_message_tenant
    ON chat_message (tenant_id, created_at DESC);
```

- `tenant_id` está denormalizado para filtros y para auditoría; se copia del hilo y se valida en servicio.
- El `CHECK` no puede verificar que un mensaje `IMAGE` tenga adjunto (tabla distinta). Lo garantiza el servicio dentro de la transacción.
- Un mensaje borrado conserva `kind` y `created_at`; `content` se pone a `NULL`.

### 3.3 `chat_attachment`

```sql
CREATE TABLE chat_attachment (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id     UUID         NOT NULL UNIQUE,
    tenant_id      UUID         NOT NULL,
    stored_file_id UUID         NOT NULL,
    file_name      VARCHAR(255) NOT NULL,
    content_type   VARCHAR(100) NOT NULL,
    size_bytes     BIGINT       NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_chat_attachment_message
        FOREIGN KEY (message_id) REFERENCES chat_message(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_attachment_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_attachment_file
        FOREIGN KEY (stored_file_id) REFERENCES stored_file(id)
);

CREATE INDEX idx_chat_attachment_tenant ON chat_attachment (tenant_id);
```

### 3.4 `chat_read_state`

```sql
CREATE TABLE chat_read_state (
    thread_id            UUID        NOT NULL,
    user_id              UUID        NOT NULL,
    last_read_message_id UUID,
    last_read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (thread_id, user_id),
    CONSTRAINT fk_chat_read_thread
        FOREIGN KEY (thread_id) REFERENCES chat_thread(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_read_user
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_read_message
        FOREIGN KEY (last_read_message_id) REFERENCES chat_message(id) ON DELETE SET NULL
);
```

El contador de no leídos se calcula con una consulta `COUNT` sobre `chat_message` con `created_at > last_read_at` y `sender_id <> user_id`, o con `id > last_read_message_id` usando el orden `(created_at, id)`. Preferir la segunda para evitar empates de timestamp.

### 3.5 Permisos

```sql
INSERT INTO permission (id, code, name, description) VALUES
    (gen_random_uuid(), 'VIEW_CHAT',   'Ver chat',      'Listar y leer hilos de chat'),
    (gen_random_uuid(), 'MANAGE_CHAT', 'Gestionar chat','Crear hilos y enviar mensajes como profesional')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r, permission p
WHERE r.code IN ('ADMIN', 'NUTRITIONIST')
  AND p.code IN ('VIEW_CHAT', 'MANAGE_CHAT')
ON CONFLICT DO NOTHING;
```

Los pacientes no reciben estos permisos: acceden por ser participantes del hilo (`patient_id = userId`).

---

## 4. Autorización

### 4.1 Reglas

| Actor | Puede | Validación |
|---|---|---|
| Nutricionista participante | Ver hilo, leer, escribir, marcar leído, borrar sus mensajes | `nutritionist_id = me` y `VIEW_CHAT`/`MANAGE_CHAT` |
| Administrador del tenant | Igual que nutricionista, solo si es participante | No se le da acceso a hilos ajenos en v1 |
| Paciente participante | Ver hilo, leer, escribir, marcar leído, borrar sus mensajes | `patient_id = me` y pertenencia al tenant |
| Otro usuario del tenant | Nada | 403/404 |

### 4.2 Implementación

Añadir a `security/HasAccess.java`:

```java
public boolean isChatParticipant(UUID tenantId, UUID threadId);
```

Debe:

1. Comprobar que el usuario autenticado existe y está habilitado.
2. Cargar el hilo por `id` y `tenantId`.
3. Devolver `true` solo si `patient_id == me` o `nutritionist_id == me`.

En controlador:

```java
@PreAuthorize("@hasAccess.isChatParticipant(#tenantId, #threadId)")
```

En servicio, repetir la comprobación y además verificar que `thread.tenantId == tenantId`. No confiar en el controlador.

### 4.3 Creación de hilo

- Nutricionista: debe tener `MANAGE_CHAT` y el paciente debe pertenecer al tenant.
- Paciente: solo puede crear un hilo consigo mismo como paciente y con su nutricionista titular (`UserTenantRole.assignedNutritionist`) o, si no existe, devolver `CHAT_NO_ASSIGNED_NUTRITIONIST`.
- Si el hilo ya existe, devolver el existente (idempotente) en lugar de 409.

---

## 5. API REST

Base: `/api/tenant/{tenantId}/chat`.

### 5.1 Listar hilos

```http
GET /tenant/{tenantId}/chat/threads?archived=false&unreadOnly=false&page=0&size=20
Authorization: Bearer <JWT>
```

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
  "page": { "size": 20, "number": 0, "totalElements": 12, "totalPages": 1 }
}
```

Reglas:

- Paciente: hilos donde `patient_id = me`.
- Profesional: hilos donde `nutritionist_id = me`.
- `preview` máximo 120 caracteres; si es imagen, `"[Imagen]"`.
- Orden: `last_message_at DESC NULLS LAST`.

### 5.2 Crear u obtener hilo

```http
POST /tenant/{tenantId}/chat/threads
Content-Type: application/json

{ "patientId": "uuid", "nutritionistId": "uuid-opcional" }
```

- Profesional: `patientId` obligatorio; `nutritionistId` se ignora y se usa el usuario autenticado.
- Paciente: `patientId` se ignora y se usa el autenticado; `nutritionistId` debe ser su nutricionista titular.
- Respuesta `200` con el hilo (creado o existente).
- Errores: `404 CHAT_PATIENT_NOT_IN_TENANT`, `409 CHAT_NO_ASSIGNED_NUTRITIONIST`.

### 5.3 Obtener hilo

```http
GET /tenant/{tenantId}/chat/threads/{threadId}
```

Incluye participantes, `unreadCount` y `lastMessage`.

### 5.4 Listar mensajes (cursor)

```http
GET /tenant/{tenantId}/chat/threads/{threadId}/messages?before=<cursor>&limit=30
```

`cursor` es un string opaco generado por el backend, por ejemplo Base64 de `createdAt|id`. Si no se envía, devuelve los últimos `limit`.

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

Reglas:

- `limit` entre 1 y 100; default 30.
- Los mensajes borrados se devuelven con `deleted: true`, `content: null` y sin adjunto.
- No se permite paginar hacia delante en v1; para nuevos mensajes se usa SSE o se recarga la primera página.

### 5.5 Enviar mensaje

Para simplificar el cliente Angular, un único endpoint `multipart/form-data`:

```http
POST /tenant/{tenantId}/chat/threads/{threadId}/messages
Content-Type: multipart/form-data

content: "Hola, adjunto la foto"
file: <binary opcional>
```

Reglas:

- Exactamente uno de `content` o `file` debe estar presente.
- `content` máximo 2.000 caracteres; se recorta y se rechazan solo-espacios.
- `file` máximo 5 MB; MIME permitido: `image/jpeg`, `image/png`, `image/webp`.
- Validar **magic bytes**, no solo `Content-Type`.
- Si hay archivo:
  1. Subir a MinIO con `StorageService.upload(tenantId, "CHAT_ATTACHMENT", messageId, ...)`.
  2. Crear `chat_message` con `kind=IMAGE` y `chat_attachment`.
  3. Todo en la misma transacción; si falla la subida, no se crea el mensaje.
- Actualizar `chat_thread.last_message_at` y `updated_at`.
- Publicar evento SSE y push **después del commit**.
- Respuesta `201` con el mensaje completo.

### 5.6 Marcar leído

```http
PATCH /tenant/{tenantId}/chat/threads/{threadId}/read
Content-Type: application/json

{ "lastReadMessageId": "uuid" }
```

- Valida que el mensaje pertenece al hilo.
- Hace `upsert` en `chat_read_state`.
- Emite evento SSE `read` a la otra parte.
- Devuelve `204`.

### 5.7 Borrar mensaje

```http
DELETE /tenant/{tenantId}/chat/threads/{threadId}/messages/{messageId}
```

- Solo el emisor puede borrar su propio mensaje.
- Soft delete: `deleted_at = now()`, `content = NULL`.
- Si tenía adjunto, se marca para purga; no se borra el objeto de MinIO en la misma transacción.
- Emite SSE `message-deleted`.
- Devuelve `204`.

### 5.8 Refrescar URL de adjunto

```http
GET /tenant/{tenantId}/chat/attachments/{attachmentId}/url
```

Respuesta:

```json
{ "url": "https://minio...", "expiresAt": "2026-10-29T10:25:00Z" }
```

- TTL por defecto: 10 minutos, configurable.
- Valida que el usuario es participante del hilo del adjunto.

### 5.9 Archivar hilo

```http
PATCH /tenant/{tenantId}/chat/threads/{threadId}/archive
Content-Type: application/json

{ "archived": true }
```

- Escribe `patient_archived_at` o `nutritionist_archived_at` según el actor.
- No borra mensajes.

---

## 6. DTOs y validación

Crear en `controller/dto/`:

- `CreateChatThreadRequest(patientId, nutritionistId)`.
- `SendChatMessageRequest` no se usa si es multipart; usar `@RequestPart(required = false) String content` y `@RequestPart(required = false) MultipartFile file`.
- `MarkChatReadRequest(lastReadMessageId)`.
- `ArchiveChatThreadRequest(boolean archived)`.

Crear en `models/dto/`:

- `ChatThreadDto`.
- `ChatThreadSummaryDto`.
- `ChatMessageDto`.
- `ChatAttachmentDto`.
- `ChatParticipantDto`.
- `ChatMessagePageDto(items, nextCursor, hasMore)`.

No devolver entidades JPA con relaciones. El chat es el primer sitio donde conviene cortar esa costumbre: los DTOs permiten controlar qué se expone y evitan `LazyInitializationException`.

Validaciones con Jakarta:

- `@NotNull` en IDs.
- `@Size(max = 2000)` en contenido.
- `@Size(max = 100)` en `limit`.

---

## 7. Tiempo real (SSE)

### 7.1 Servicio

Crear `service/ChatStreamService.java` siguiendo `MenuStreamService`:

- Mapa `threadId -> Set<SseEmitter>`.
- `subscribe(UUID threadId)`.
- `broadcast(UUID threadId, String event, Object payload)`.
- `@Scheduled(fixedRateString = "${app.chat.heartbeat-ms:20000}")` con comentario `keep-alive`.
- Timeout de 30 minutos.
- Limpieza en `onCompletion`, `onTimeout`, `onError`.

### 7.2 Controlador

```http
GET /tenant/{tenantId}/chat/threads/{threadId}/stream
Accept: text/event-stream
Authorization: Bearer <JWT>
```

- `@PreAuthorize("@hasAccess.isChatParticipant(#tenantId, #threadId)")`.
- Cabeceras `Cache-Control: no-cache` y `X-Accel-Buffering: no`.
- Evento inicial `connected`.

### 7.3 Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `connected` | `{ "type": "CONNECTED", "threadId": "..." }` | Al abrir |
| `message` | `ChatMessageDto` | Mensaje nuevo |
| `message-deleted` | `{ "messageId": "...", "threadId": "..." }` | Borrado |
| `read` | `{ "userId": "...", "lastReadMessageId": "...", "readAt": "..." }` | Lectura |

El evento `message` lleva el DTO completo, incluida la URL firmada del adjunto. Si la URL caduca, el cliente llama a §5.8.

### 7.4 Multi-nodo y Redis

Redis es obligatorio desde v1: `spring-boot-starter-data-redis` y un
`RedisMessageListenerContainer` suscrito a `chat:thread:*`.

- Canal `chat:thread:{threadId}`.
- Cada nodo mantiene sus emisores SSE locales y recibe por Redis los eventos de cualquier nodo.
- `app.chat.event-bus=redis|local`; `local` queda solo para tests o como degradación.
- Si Redis falla, el backend entrega en local y registra el fallo.
- No cambia el contrato SSE del cliente.

---

## 8. Push

En `ChatMessageService`, tras el commit:

```java
pushNotificationService.notifyUserAfterCommit(
    recipientId,
    "Nuevo mensaje",
    senderDisplayName + " te ha enviado un mensaje",
    PushNotificationService.pushData("CHAT_MESSAGE", tenantId, threadId, null)
);
```

Reglas:

- `recipientId` es la otra parte del hilo.
- El cuerpo **nunca** incluye el contenido del mensaje ni datos clínicos.
- Añadir `TYPE_CHAT_MESSAGE = "CHAT_MESSAGE"` a `PushNotificationService`.
- El `data` incluye `tenantId`, `threadId` y `messageId` para que la app abra el hilo correcto.
- Respetar la zona horaria del usuario si se implementan horas de silencio (v1.1).

---

## 9. Imágenes en MinIO

### 9.1 Flujo de subida

1. Angular envía `multipart/form-data`.
2. Backend valida tamaño y MIME declarado.
3. Backend lee los primeros bytes y valida magic bytes:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   - WebP: `52 49 46 46 ... 57 45 42 50`
4. Genera `messageId` antes de subir para usarlo como `entityId`.
5. `StorageService.upload(...)` con ruta `tenants/{tenantId}/chat/{threadId}/{messageId}/{uuid}.{ext}`.
6. Persiste `chat_message` + `chat_attachment`.
7. Si falla la persistencia, intenta borrar el objeto subido (compensación best-effort).

### 9.2 Flujo de descarga

- El DTO incluye `url` y `urlExpiresAt` generados con `StorageService.presignedUrl(storedFileId, Duration.ofMinutes(10))`.
- El cliente usa la URL directamente; no pasa por el backend.
- Si caduca, llama a §5.8.
- No se sirve nunca el binario desde el backend.

### 9.3 Privacidad

- No registrar la URL firmada en logs.
- No incluir la URL en push.
- Borrar EXIF GPS de las imágenes si es viable; si no, documentarlo como limitación.
- Purga de adjuntos borrados: job semanal que borra en MinIO los `stored_file` sin referencia y con `created_at` antiguo.

---

## 10. Clases y archivos a crear/modificar

### Nuevos

| Archivo | Propósito |
|---|---|
| `models/entity/ChatThread.java` | Hilo. |
| `models/entity/ChatMessage.java` | Mensaje. |
| `models/entity/ChatAttachment.java` | Adjunto. |
| `models/entity/ChatReadState.java` | Estado de lectura. |
| `repository/ChatThreadRepository.java` | Consultas de hilos y no leídos. |
| `repository/ChatMessageRepository.java` | Mensajes y cursor. |
| `repository/ChatAttachmentRepository.java` | Adjuntos. |
| `repository/ChatReadStateRepository.java` | Estados de lectura. |
| `service/ChatThreadService.java` | Creación, listado, archivo. |
| `service/ChatMessageService.java` | Envío, borrado, paginación. |
| `service/ChatAttachmentService.java` | Subida y URL firmada. |
| `service/ChatStreamService.java` | SSE. |
| `controller/ChatThreadController.java` | Endpoints de hilos. |
| `controller/ChatMessageController.java` | Endpoints de mensajes. |
| `controller/ChatStreamController.java` | SSE. |
| `controller/dto/*` | Requests. |
| `models/dto/*` | Responses. |
| `V54__create_chat_tables.sql` | Migración. |

### Modificados

| Archivo | Cambio |
|---|---|
| `security/HasAccess.java` | `isChatParticipant`. |
| `service/PushNotificationService.java` | `TYPE_CHAT_MESSAGE`. |
| `exception/ErrorResource.java` | Códigos de chat. |
| `application.yaml` | `app.chat.heartbeat-ms`, `app.chat.presigned-ttl-minutes`, `app.chat.max-image-bytes`. |
| `doc/contrato-api/breaking-changes.md` | Solo si se toca un DTO existente; el chat es aditivo. |

---

## 11. Errores

Añadir a `ErrorResource`:

```text
CHAT_THREAD_NOT_FOUND
CHAT_MESSAGE_NOT_FOUND
CHAT_ATTACHMENT_NOT_FOUND
CHAT_NOT_PARTICIPANT
CHAT_PATIENT_NOT_IN_TENANT
CHAT_NO_ASSIGNED_NUTRITIONIST
CHAT_EMPTY_MESSAGE
CHAT_MESSAGE_TOO_LONG
CHAT_ATTACHMENT_TOO_LARGE
CHAT_UNSUPPORTED_MEDIA_TYPE
CHAT_INVALID_CURSOR
```

Mapeo:

| Error | HTTP |
|---|---|
| No encontrado / no participante | 404 (no revelar existencia) |
| Sin permiso de staff | 403 |
| Mensaje vacío o demasiado largo | 400 |
| Adjunto demasiado grande | 413 |
| MIME no permitido | 415 |
| Cursor inválido | 400 |

---

## 12. Seguridad y privacidad

1. **Aislamiento:** toda consulta por `threadId` incluye `tenantId`; el servicio compara ambos.
2. **Participación:** nunca se autoriza solo por pertenecer al tenant.
3. **Contenido:** no se registra el texto de los mensajes en logs. Solo IDs y metadatos.
4. **Auditoría:** registrar `CHAT_MESSAGE_CREATED`, `CHAT_MESSAGE_DELETED`, `CHAT_THREAD_CREATED` con actor, tenant, thread y message id. Sin contenido.
5. **Rate limiting:** máximo 30 mensajes/minuto por usuario y 100/hora por hilo. Implementación simple en memoria o Redis; si no hay Redis, un `Bucket` por usuario.
6. **Adjuntos:** validar magic bytes; no confiar en la extensión. Límite de 5 MB.
7. **URLs firmadas:** TTL 10 min; no persistir en logs ni en push.
8. **Borrado:** soft delete; el contenido se pierde, pero el registro queda para auditoría.
9. **Bloqueo de usuario:** si `AppUser.enabled = false`, el hilo sigue visible para la otra parte, pero el usuario bloqueado no puede entrar (Keycloak ya lo impide).

---

## 13. Testing

### Unitarios

- `ChatThreadService`:
  - crea hilo nuevo;
  - devuelve existente sin duplicar;
  - rechaza paciente de otro tenant;
  - rechaza paciente sin nutricionista asignado.
- `ChatMessageService`:
  - envía texto;
  - rechaza vacío;
  - rechaza texto > 2.000;
  - paginación por cursor sin duplicados ni saltos;
  - borrado solo del propio mensaje;
  - actualiza `last_message_at`.
- `ChatAttachmentService`:
  - acepta JPEG/PNG/WebP válidos;
  - rechaza MIME falso (extensión `.jpg` con contenido PDF);
  - rechaza > 5 MB;
  - genera URL firmada.
- `HasAccess.isChatParticipant`: matriz paciente/profesional/ajeno.

### MVC

- `GET /threads` devuelve solo los hilos del actor.
- `POST /messages` multipart con texto y con imagen.
- `PATCH /read` actualiza estado.
- `DELETE /messages/{id}` devuelve 204 y el siguiente GET lo marca `deleted`.
- `GET /stream` devuelve `text/event-stream` y evento `connected`.

### SSE

- Suscribir dos emisores al mismo hilo y comprobar que ambos reciben el evento.
- Cerrar un emisor y comprobar que se elimina del mapa.
- Latido no rompe conexiones.

### Integración con MinIO

Opcional con Testcontainers. Si no, mock de `StorageService` y un test manual documentado con MinIO real.

---

## 14. Tareas y estimación

| ID | Tarea | Días |
|---|---|---|
| CH-01 | Migración `V49`, entidades, repositorios, permisos | 2 |
| CH-02 | `HasAccess.isChatParticipant` + reglas de autorización | 1 |
| CH-03 | `ChatThreadService` + endpoints de hilos | 2 |
| CH-04 | `ChatMessageService` + paginación cursor + no leídos | 3 |
| CH-05 | `ChatAttachmentService` + MinIO + validación de imágenes | 2 |
| CH-06 | SSE `ChatStreamService` + controlador + heartbeat | 2 |
| CH-07 | Push + eventos post-commit | 1 |
| CH-08 | DTOs, OpenAPI, errores, `application.yaml` | 1 |
| CH-09 | Tests unitarios + MVC + SSE | 3 |
| CH-10 | Documento de contrato Angular (`doc/contrato-api/chat/chat-frontend.md`) | 1 |
| **Total** | | **18 días** |

Con 1 backend: **3,5–4 semanas** incluyendo revisión y margen del 15 %.

### Frontend Angular (estimación aparte)

| Tarea | Días |
|---|---|
| Servicio `ChatApiService` + modelos | 2 |
| Lista de hilos + no leídos | 2 |
| Pantalla de conversación + paginación | 3 |
| Subida de imagen + preview | 2 |
| SSE con `@microsoft/fetch-event-source` | 2 |
| Marcar leído, archivar, borrar | 1 |
| Tests y accesibilidad | 2 |
| **Total** | **14 días** |

---

## 15. Criterios de aceptación

- [ ] Un nutricionista puede crear un hilo con un paciente del mismo tenant.
- [ ] Un paciente puede abrir un hilo con su nutricionista titular.
- [ ] No se puede crear un hilo duplicado para el mismo `(tenant, paciente, nutricionista)`.
- [ ] Paciente y nutricionista intercambian mensajes de texto.
- [ ] Se puede enviar una imagen JPEG/PNG/WebP de hasta 5 MB.
- [ ] La imagen se almacena en MinIO y se sirve por URL firmada.
- [ ] Un usuario ajeno al hilo recibe 404, aunque pertenezca al tenant.
- [ ] Los mensajes se paginan por cursor sin duplicados ni saltos.
- [ ] El contador de no leídos es correcto tras marcar leído.
- [ ] SSE entrega `message`, `message-deleted` y `read` en tiempo real.
- [ ] El push llega al receptor sin contenido del mensaje.
- [ ] El borrado es lógico y visible como “mensaje eliminado”.
- [ ] Los tests pasan y la aplicación compila.
- [ ] `doc/contrato-api/chat/chat-frontend.md` describe el contrato para Angular.

---

## 16. Contrato para Angular (resumen)

- REST con `Authorization: Bearer <JWT>`.
- SSE con `@microsoft/fetch-event-source`, no `EventSource` nativo.
- URLs de imagen ya vienen firmadas en el DTO; si caducan, llamar a `GET .../attachments/{id}/url`.
- Paginación: enviar `before` con el `nextCursor` anterior.
- Envío de mensaje: `FormData` con `content` y/o `file`.
- Reconexión SSE: volver a abrir el stream y recargar la primera página de mensajes; no hay buffer de eventos.
- Errores: mostrar toast y reintentar; 404 significa que el hilo ya no está disponible.

---

## 17. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| SSE en Angular con proxy/nginx | Alto | `X-Accel-Buffering: no`, heartbeat, `fetch-event-source`. |
| URLs firmadas caducadas | Medio | TTL 10 min + endpoint de refresco + renovación al enfocar la ventana. |
| Imágenes grandes o maliciosas | Medio | Límite 5 MB, magic bytes, sin ejecución, sin servir desde el backend. |
| Multi-nodo | Medio | v1 un nodo; interfaz `ChatEventBus` preparada. |
| Privacidad en push | Alto | Cuerpo genérico; solo IDs en `data`. |
| Cursor mal implementado | Medio | Tests con mensajes en el mismo milisegundo; orden `(created_at, id)`. |
| Borrado de adjuntos | Bajo | Soft delete + job de purga. |

---

## 18. Fuera de alcance

- Chat de voz/vídeo.
- Mensajes con múltiples adjuntos.
- Reacciones, respuestas citadas, hilos anidados.
- Traducción automática.
- Moderación con IA.
- Integración con WhatsApp/Telegram.
- Notificaciones por email.
- Búsqueda full-text de mensajes.
