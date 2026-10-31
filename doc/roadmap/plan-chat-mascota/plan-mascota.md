# Plan independiente — Mascota conversacional (Java)

> **Objetivo:** asistente con mascota en Angular y motor en Java/Spring Boot que conversa con el usuario, entiende qué campos faltan y **propone** rellenarlos. Nunca escribe sin confirmación explícita.
> **Prerrequisito:** MinIO operativo con `StorageService` y tabla `stored_file` (ver `README.md` §2), y clave Gemini del tenant cifrada.
> **Ámbito:** backend Java + contrato para frontend Angular. Sin microservicio Python.
> **Estimación:** 8–10 semanas de backend + 6–8 semanas de frontend Angular (pueden solaparse).
> **Estado:** backend v1 implementado en esta rama. Contrato Angular en `doc/mascota-frontend.md`.

---

## 1. Alcance

### Incluido

- Mascota como **persona visual** en Angular (avatar animado + panel de conversación).
- Motor conversacional en Java con Gemini y **function calling**.
- Dos modos:
  - `SELF`: el paciente habla por sí mismo.
  - `STAFF`: un profesional habla en nombre de un paciente al que tiene acceso.
- Detección de campos vacíos o incompletos en el perfil.
- Propuesta de rellenado con vista previa y confirmación.
- Confirmación/rechazo explícito antes de escribir.
- Historial de sesión y acciones pendientes.
- Adjuntos de imagen opcionales para la mascota (avatar, no para datos clínicos).
- Auditoría, límites de uso y kill switch por tenant.

### Fuera de alcance v1

- Diagnóstico, prescripción o consejo clínico.
- Escritura directa sin confirmación.
- Voz (TTS/STT).
- Streaming token a token (v1.1; v1 usa REST con indicador de “pensando”).
- Memoria entre sesiones más allá de un resumen.
- RAG sobre recetas, labs o contenido educativo (v1.1).
- Múltiples mascotas por tenant.
- Fine-tuning.
- Modelos locales.
- App móvil Flutter: el contrato es REST, pero la UI de mascota se implementa primero en Angular.

---

## 2. Principios y límites

1. **La mascota no es un profesional sanitario.** No diagnostica, no prescribe, no interpreta analíticas. Si el usuario pide consejo clínico, deriva al nutricionista.
2. **Human-in-the-loop obligatorio.** Toda escritura nace como `pending_action` y requiere confirmación.
3. **El modelo no tiene permisos.** Las tools se ejecutan en el backend con el contexto de autenticación; nunca se acepta un `userId` propuesto por el modelo.
4. **Minimización.** Al modelo solo se le envía el contexto necesario, no la entidad completa.
5. **Trazabilidad.** Cada acción aplicada queda auditada con actor, subject, tool y entidad resultante.
6. **Kill switch.** `assistant_mascot.enabled = false` o `TenantPreferences.aiEnabled = false` desactiva todo.
7. **Idempotencia.** Confirmar dos veces la misma acción no duplica datos.
8. **Español por defecto, idioma del usuario.** El asistente responde en `AppUser.language` salvo que el usuario pida otro.

---

## 3. Prerrequisitos

| Requisito | Comprobación |
|---|---|
| MinIO operativo | `StorageService` con `upload`, `delete`, `presignedUrl`. |
| Clave Gemini cifrada | `TenantPreferences.geminiApiKey` no se expone en claro por API; se descifra solo en el backend. |
| `aiEnabled` | Si es `false`, el asistente devuelve 403 `AI_NOT_ENABLED_FOR_TENANT`. |
| SSE | Opcional para v1; se reutiliza el patrón existente si se añade streaming. |
| Permisos | `VIEW_PATIENT_PROFILE` / `MANAGE_PATIENT_PROFILE` para modo `STAFF`. |
| Frontend Angular | Componente de mascota y cliente REST. |

---

## 4. Arquitectura

```text
Angular
  ├── MascotAssistantComponent (avatar + chat + tarjetas de confirmación)
  ├── AssistantApiService
  └── SSE opcional (v1.1)
        │
        ▼
Spring Boot
  ├── AssistantController
  ├── AssistantSessionService
  ├── AssistantConversationService
  ├── AssistantActionService
  ├── AssistantContextBuilder
  ├── GeminiAssistantClient
  ├── AssistantToolRegistry
  │     ├── ProfileReadTool
  │     ├── ProfileUpdateTool
  │     ├── MeasurementReadTool
  │     ├── MeasurementCreateTool
  │     ├── AppointmentReadTool
  │     ├── MenuReadTool
  │     └── NavigationTool
  ├── Domain services existentes
  │     ├── AppUserService
  │     ├── UserTenantProfileService
  │     ├── BodyMeasurementService
  │     ├── AppointmentService
  │     └── MenuService
  └── StorageService (avatar)
        │
        ▼
Gemini API (function calling)
```

### 4.1 Por qué en Java

- El proyecto ya usa `com.google.genai:google-genai:1.77.0` y tiene un patrón de llamada a Gemini (`GeminiMenuExtractor`).
- Las tools necesitan acceso directo a servicios de dominio, transacciones, `@hasAccess` y auditoría. Hacerlo en Java evita un salto de red y un segundo modelo de autorización.
- El volumen esperado no justifica un microservicio Python.
- Si en el futuro se necesita RAG avanzado, se extrae solo la capa de generación; el contrato REST no cambia.

### 4.2 Componentes

| Componente | Responsabilidad |
|---|---|
| `AssistantController` | Endpoints REST. |
| `AssistantSessionService` | Crear, cargar, cerrar y expirar sesiones. |
| `AssistantConversationService` | Orquesta prompt, Gemini, tools y respuesta. |
| `AssistantContextBuilder` | Construye el contexto permitido del usuario/paciente. |
| `GeminiAssistantClient` | Envuelve el SDK, timeouts, reintentos y conteo de tokens. |
| `AssistantToolRegistry` | Registra tools y valida argumentos. |
| `AssistantActionService` | Crea, confirma, rechaza y aplica `pending_action`. |
| `AssistantMascotService` | Configuración de la mascota por tenant y URL del avatar. |
| `AssistantUsageService` | Cuotas y métricas de tokens. |

---

## 5. Modelo de datos

Migración `V55__create_assistant_tables.sql` (la última aplicada es `V54`; renumerar si otra rama ya usa `V55`).

### 5.1 `assistant_mascot`

```sql
CREATE TABLE assistant_mascot (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID        NOT NULL,
    name                   VARCHAR(80) NOT NULL DEFAULT 'Nuti',
    persona                TEXT,
    tone                   VARCHAR(30) NOT NULL DEFAULT 'CERCANO',
    avatar_stored_file_id  UUID,
    animations             JSONB       NOT NULL DEFAULT '{}',
    enabled                BOOLEAN     NOT NULL DEFAULT TRUE,
    consent_text           TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_assistant_mascot_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_assistant_mascot_avatar
        FOREIGN KEY (avatar_stored_file_id) REFERENCES stored_file(id),
    CONSTRAINT uq_assistant_mascot_tenant UNIQUE (tenant_id)
);
```

- `tone`: `CERCANO`, `PROFESIONAL`, `DIVERTIDO`.
- `animations`: mapa de estados a asset (`idle`, `thinking`, `happy`, `confused`, `success`).
- `consent_text`: texto legal que el usuario acepta la primera vez.

### 5.2 `assistant_session`

```sql
CREATE TABLE assistant_session (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    user_id          UUID        NOT NULL,
    subject_user_id  UUID,
    mode             VARCHAR(10) NOT NULL DEFAULT 'SELF',
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    context          JSONB       NOT NULL DEFAULT '{}',
    summary          TEXT,
    consent_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at       TIMESTAMPTZ,
    CONSTRAINT fk_assistant_session_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_assistant_session_user
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_assistant_session_subject
        FOREIGN KEY (subject_user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_assistant_session_mode CHECK (mode IN ('SELF', 'STAFF')),
    CONSTRAINT ck_assistant_session_status CHECK (status IN ('ACTIVE', 'CLOSED', 'EXPIRED'))
);

CREATE INDEX idx_assistant_session_user
    ON assistant_session (tenant_id, user_id, last_activity_at DESC);
```

- `user_id`: quién habla.
- `subject_user_id`: sobre quién se actúa. En `SELF` es igual a `user_id`; en `STAFF` es el paciente.
- `context`: pantalla actual, locale, timezone, flags de onboarding.
- `expires_at`: por defecto 24 h desde la última actividad.

### 5.3 `assistant_message`

```sql
CREATE TABLE assistant_message (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL,
    tenant_id   UUID        NOT NULL,
    role        VARCHAR(12) NOT NULL,
    content     TEXT,
    tool_name   VARCHAR(80),
    tool_payload JSONB,
    tokens_in   INTEGER,
    tokens_out  INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_assistant_message_session
        FOREIGN KEY (session_id) REFERENCES assistant_session(id) ON DELETE CASCADE,
    CONSTRAINT fk_assistant_message_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT ck_assistant_message_role
        CHECK (role IN ('USER', 'ASSISTANT', 'TOOL', 'SYSTEM'))
);

CREATE INDEX idx_assistant_message_session
    ON assistant_message (session_id, created_at ASC, id ASC);
```

- `role=TOOL`: resultado de una tool, para reconstruir el hilo.
- No guardar la clave Gemini ni prompts internos con secretos.

### 5.4 `assistant_pending_action`

```sql
CREATE TABLE assistant_pending_action (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id         UUID        NOT NULL,
    tenant_id          UUID        NOT NULL,
    user_id            UUID        NOT NULL,
    subject_user_id    UUID        NOT NULL,
    tool_name          VARCHAR(80) NOT NULL,
    payload            JSONB       NOT NULL,
    preview            JSONB       NOT NULL,
    status             VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    idempotency_key    VARCHAR(80) NOT NULL,
    applied_entity_type VARCHAR(50),
    applied_entity_id  UUID,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at        TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_assistant_action_session
        FOREIGN KEY (session_id) REFERENCES assistant_session(id) ON DELETE CASCADE,
    CONSTRAINT fk_assistant_action_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT ck_assistant_action_status
        CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'APPLIED', 'FAILED'))
);

CREATE UNIQUE INDEX uq_assistant_action_idempotency
    ON assistant_pending_action (idempotency_key);
CREATE INDEX idx_assistant_action_pending
    ON assistant_pending_action (session_id, status, created_at DESC);
```

- `payload`: argumentos validados de la tool.
- `preview`: estructura para que Angular pinte la tarjeta de confirmación sin interpretar el payload.
- `idempotency_key`: UUID generado al crear la acción; el confirm lo reenvía y evita duplicados.
- `expires_at`: 15 minutos por defecto.

### 5.5 `assistant_usage_daily`

```sql
CREATE TABLE assistant_usage_daily (
    tenant_id      UUID        NOT NULL,
    usage_date     DATE        NOT NULL,
    messages       INTEGER     NOT NULL DEFAULT 0,
    tokens_in      BIGINT      NOT NULL DEFAULT 0,
    tokens_out     BIGINT      NOT NULL DEFAULT 0,
    errors         INTEGER     NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, usage_date),
    CONSTRAINT fk_assistant_usage_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE
);
```

Sirve para cuotas y para estimar coste. No sustituye a la facturación.

### 5.6 `assistant_feedback` (opcional v1.1)

```sql
CREATE TABLE assistant_feedback (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    user_id    UUID NOT NULL,
    rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_assistant_feedback_message
        FOREIGN KEY (message_id) REFERENCES assistant_message(id) ON DELETE CASCADE,
    CONSTRAINT fk_assistant_feedback_user
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);
```

---

## 6. Catálogo de tools

Cada tool declara:

- `name`, `description` y `parameters` (JSON Schema).
- `readOnly` (`true`/`false`).
- `requiredPermission` y validación de ámbito.
- `execute(AssistantContext, args)`.

### 6.1 Tools de lectura

| Tool | Argumentos | Devuelve | Permiso |
|---|---|---|---|
| `get_profile` | `sections[]` opcional | Campos permitidos del perfil | `SELF` o `VIEW_PATIENT_PROFILE` |
| `get_missing_fields` | `sections[]` opcional | Lista de campos vacíos relevantes | Igual |
| `get_latest_measurement` | — | Última medición (peso, fecha, IMC si aplica) | Igual |
| `get_upcoming_appointments` | `limit` opcional | Próximas citas (fecha, tipo, profesional) | Igual |
| `get_active_menu_summary` | — | Nombre del menú activo y si existe | Igual |
| `get_tenant_info` | — | Nombre del centro, idioma, zona horaria | Cualquiera |

### 6.2 Tools de escritura (siempre vía `pending_action`)

| Tool | Campos | Modo | Permiso |
|---|---|---|---|
| `update_profile` | `firstName`, `lastName`, `phone`, `birthDate`, `heightCm`, `gender` | SELF/STAFF | `MANAGE_PATIENT_PROFILE` en STAFF |
| `update_anamnesis` | `consultationReason`, `allergiesIntolerances`, `foodPreferences`, `habits`, `lifestyle`, `exercise`, `observations` | SELF/STAFF | Igual |
| `create_measurement` | `measuredAt`, `weightKg`, `waistCm`, `bodyFatPct`, `muscleMassPct` | STAFF para composición; SELF solo peso/cintura | `MANAGE_PATIENT_PROFILE` en STAFF |
| `update_locale` | `language`, `timezone` | SELF | Autenticado |

### 6.3 Tools de navegación (sin escritura)

| Tool | Argumentos | Efecto |
|---|---|---|
| `navigate_to` | `screen`, `params` | Devuelve una `uiAction` para que Angular navegue. |

Pantallas permitidas: `PROFILE`, `ANAMNESIS`, `MEASUREMENTS`, `MENU`, `APPOINTMENTS`, `DIARY`. Lista cerrada; el modelo no puede inventar rutas.

### 6.4 Reglas de las tools

1. El `subjectUserId` sale de la sesión, nunca de los argumentos del modelo.
2. Los campos se validan con los mismos DTOs/servicios que usa la API normal.
3. `update_*` no escribe: crea la acción y devuelve `pendingAction`.
4. `create_measurement` valida fecha no futura, rangos y permisos.
5. Las tools de lectura devuelven solo campos de la whitelist.
6. Cualquier argumento desconocido o tipo incorrecto se rechaza con error de validación.
7. Límite de 3 llamadas a tools por turno.
8. Timeout de 10 s por tool.

---

## 7. Flujo conversacional

### 7.1 Turno normal

```text
1. Angular: POST /messages { content: "Me peso 72,5 kg" }
2. Backend carga sesión, valida consentimiento y cuota.
3. AssistantContextBuilder construye contexto mínimo.
4. GeminiAssistantClient envía system prompt + últimos N mensajes + tools.
5. Gemini responde texto y/o functionCall.
6. Si functionCall de lectura:
   - Se ejecuta la tool.
   - El resultado se envía de vuelta a Gemini.
   - Gemini genera la respuesta final.
7. Si functionCall de escritura:
   - Se valida el payload.
   - Se crea assistant_pending_action con preview.
   - Se responde: texto + pendingAction.
   - No se escribe nada todavía.
8. Angular pinta la tarjeta: "¿Guardar peso 72,5 kg de hoy?"
9. Usuario confirma:
   - POST /pending-actions/{id}/confirm
   - Backend valida idempotencia, aplica el servicio de dominio, marca APPLIED.
   - Devuelve la entidad actualizada y un mensaje de confirmación.
10. Si rechaza:
   - POST /pending-actions/{id}/reject
   - Se marca REJECTED; no se escribe.
```

### 7.2 Primera vez

- Si `assistant_session.consent_at` es `null`, el backend devuelve `consentRequired: true` y el texto de consentimiento.
- El usuario debe llamar a `POST /sessions/{id}/consent` antes de conversar.
- Sin consentimiento no se envía nada a Gemini.

### 7.3 Campos que faltan

- `get_missing_fields` devuelve una lista priorizada:
  1. Datos básicos: nombre, fecha de nacimiento, altura, teléfono.
  2. Anamnesis: motivo de consulta, alergias, preferencias.
  3. Medición: peso y fecha.
- La mascota pregunta **de uno en uno**, no vuelca un formulario.
- Si el usuario no quiere responder, se respeta y se pasa al siguiente.

### 7.4 Modo `STAFF`

- El profesional abre la ficha de un paciente y lanza la mascota.
- El contexto incluye `subjectUserId`, pero las tools validan `MANAGE_PATIENT_PROFILE`.
- La mascota puede rellenar la anamnesis mientras el profesional habla con el paciente.
- La tarjeta de confirmación muestra claramente “Vas a modificar la ficha de Ana García”.

---

## 8. API REST

Base: `/api/tenant/{tenantId}/assistant`.

### 8.1 Configuración de la mascota

```http
GET /tenant/{tenantId}/assistant/config
```

```json
{
  "enabled": true,
  "name": "Nuti",
  "tone": "CERCANO",
  "avatarUrl": "https://minio.../firmada",
  "avatarExpiresAt": "2026-10-29T10:25:00Z",
  "animations": {
    "idle": "https://minio.../idle.json",
    "thinking": "https://minio.../thinking.json",
    "success": "https://minio.../success.json"
  },
  "greeting": "¡Hola! Soy Nuti. ¿Te ayudo a completar tu perfil?",
  "suggestedPrompts": [
    "Completar mis datos",
    "¿Qué me falta?",
    "Registrar mi peso"
  ],
  "consentRequired": false
}
```

### 8.2 Crear sesión

```http
POST /tenant/{tenantId}/assistant/sessions
Content-Type: application/json

{ "mode": "SELF", "subjectUserId": null, "screen": "PROFILE" }
```

Respuesta:

```json
{
  "sessionId": "uuid",
  "consentRequired": false,
  "greeting": "¡Hola! ¿Empezamos?",
  "expiresAt": "2026-10-30T10:00:00Z"
}
```

- `mode=STAFF` exige `subjectUserId` y permiso.
- `mode=SELF` ignora `subjectUserId`.
- Reutilizar sesión activa del mismo usuario y subject si existe y no ha expirado (evita sesiones huérfanas).

### 8.3 Consentimiento

```http
POST /tenant/{tenantId}/assistant/sessions/{sessionId}/consent
Content-Type: application/json

{ "accepted": true }
```

- Guarda `consent_at`.
- Si `accepted=false`, cierra la sesión.

### 8.4 Enviar mensaje

```http
POST /tenant/{tenantId}/assistant/sessions/{sessionId}/messages
Content-Type: application/json

{ "content": "Me peso 72,5 kg" }
```

Respuesta:

```json
{
  "assistantMessage": {
    "id": "uuid",
    "content": "He entendido 72,5 kg. ¿Quieres que lo guarde con la fecha de hoy?",
    "createdAt": "2026-10-29T10:01:00Z"
  },
  "pendingAction": {
    "id": "uuid",
    "toolName": "create_measurement",
    "summary": "Registrar peso 72,5 kg",
    "preview": [
      { "field": "weightKg", "label": "Peso", "value": "72,5 kg" },
      { "field": "measuredAt", "label": "Fecha", "value": "29/10/2026" }
    ],
    "expiresAt": "2026-10-29T10:16:00Z"
  },
  "uiActions": [
    { "type": "NAVIGATE", "screen": "MEASUREMENTS" }
  ]
}
```

Reglas:

- `content` máximo 2.000 caracteres.
- Si el usuario pide algo fuera de alcance, la respuesta es texto con derivación; no hay tool.
- Si Gemini falla, devolver 503 `ASSISTANT_UNAVAILABLE` y no crear acción.
- No devolver el prompt ni el `tool_payload` crudo.

### 8.5 Historial

```http
GET /tenant/{tenantId}/assistant/sessions/{sessionId}/messages?before=<cursor>&limit=30
```

Mismo formato de cursor que el chat.

### 8.6 Confirmar acción

```http
POST /tenant/{tenantId}/assistant/pending-actions/{actionId}/confirm
Content-Type: application/json

{ "idempotencyKey": "uuid" }
```

Respuesta:

```json
{
  "status": "APPLIED",
  "entityType": "BODY_MEASUREMENT",
  "entityId": "uuid",
  "message": "Peso registrado. ¿Algo más?"
}
```

Errores:

| Caso | HTTP | Código |
|---|---|---|
| Acción no existe | 404 | `ASSISTANT_ACTION_NOT_FOUND` |
| Acción de otro usuario | 404 | `ASSISTANT_ACTION_NOT_FOUND` |
| Expirada | 409 | `ASSISTANT_ACTION_EXPIRED` |
| Ya aplicada con otra idempotency | 409 | `ASSISTANT_ACTION_ALREADY_RESOLVED` |
| Payload inválido al aplicar | 422 | `ASSISTANT_ACTION_INVALID` |

### 8.7 Rechazar acción

```http
POST /tenant/{tenantId}/assistant/pending-actions/{actionId}/reject
```

- Marca `REJECTED`.
- No escribe nada.
- Devuelve `204`.

### 8.8 Cerrar sesión

```http
DELETE /tenant/{tenantId}/assistant/sessions/{sessionId}
```

- Marca `CLOSED`.
- No borra el historial; se purga por retención.

### 8.9 Feedback (v1.1)

```http
POST /tenant/{tenantId}/assistant/messages/{messageId}/feedback
Content-Type: application/json

{ "rating": 5, "comment": "Muy útil" }
```

### 8.10 Administración de la mascota

Para v1, la configuración se carga por migración/seed o por un endpoint de staff con `MANAGE_TENANT`:

```http
PUT /tenant/{tenantId}/assistant/config
```

Campos: `name`, `persona`, `tone`, `avatarStoredFileId`, `animations`, `enabled`, `consentText`.

---

## 9. Integración con Gemini en Java

### 9.1 Cliente

Crear `service/ai/GeminiAssistantClient.java`:

```java
Client client = Client.builder().apiKey(apiKey).build();
```

Reutilizar el patrón de `GeminiMenuExtractor`, pero con:

- `app.ai.assistant-model` (default `gemini-3.5-flash`; configurable).
- `app.ai.assistant-timeout-ms` (default 20.000).
- `app.ai.assistant-max-output-tokens` (default 800).
- `app.ai.assistant-max-tool-calls` (default 3).

### 9.2 Function calling

Declarar las tools con el SDK:

```java
FunctionDeclaration.builder()
    .name("create_measurement")
    .description("Propone registrar una medición corporal del paciente")
    .parameters(Schema.builder()
        .type(Type.OBJECT)
        .properties(Map.of(
            "weightKg", Schema.builder().type(Type.NUMBER).description("Peso en kg").build(),
            "measuredAt", Schema.builder().type(Type.STRING).description("Fecha ISO-8601").build()
        ))
        .required(List.of("weightKg"))
        .build())
    .build();
```

> **Spike obligatorio (1 día):** validar la firma exacta de `FunctionDeclaration`, `Tool`, `GenerateContentConfig` y `response.functionCalls()` en la versión 1.77.0 del SDK. Si la API difiere, adaptar el wrapper; el resto del plan no cambia.

### 9.3 Bucle de conversación

```text
messages = system + historial + user
for i in 1..maxToolCalls:
    response = gemini.generate(messages, tools)
    if response.hasFunctionCall():
        result = toolRegistry.execute(call, context)
        messages += toolResult
        continue
    return response.text()
return "No he podido completar la operación; ¿lo intentamos de otra forma?"
```

- Las tools de escritura **no se ejecutan** en este bucle: devuelven una `pendingAction` y cortan el bucle.
- Las tools de lectura sí se ejecutan y se realimentan.
- Si se supera el límite, responder con fallback.

### 9.4 Timeouts y reintentos

- Timeout global de 20 s; si se supera, 503.
- Reintentos: 2 con backoff exponencial para 429/5xx.
- No reintentar errores 400 (prompt inválido) ni 403 (clave).
- Circuit breaker simple por tenant: si 5 fallos consecutivos en 5 minutos, desactivar 10 minutos y devolver 503.

### 9.5 Coste y tokens

- Registrar `tokens_in`, `tokens_out` por mensaje.
- Incrementar `assistant_usage_daily`.
- Cuota por defecto: 100 mensajes/día por usuario; 2.000/día por tenant. Configurable.
- Si se supera: 429 `ASSISTANT_QUOTA_EXCEEDED`.

---

## 10. Prompting y contexto

### 10.1 System prompt (borrador)

```text
Eres {mascotName}, el asistente virtual de {tenantName}, un centro de nutrición.

Tu función es ayudar al usuario a completar su perfil y a navegar por la aplicación.
No eres médico ni nutricionista. No diagnostiques, no prescribas, no interpretes analíticas.
Si el usuario pide consejo clínico, deriva a su nutricionista.

Reglas:
- Habla en {language}, con un tono {tone}.
- Haz una pregunta cada vez.
- No inventes datos. Si no sabes algo, pregunta.
- Antes de guardar cualquier dato, propone la acción y espera confirmación.
- No repitas datos sensibles innecesariamente.
- Si el usuario quiere cancelar, detente.
- Responde en frases cortas, aptas para una burbuja de chat.

Contexto del usuario:
- Nombre: {firstName}
- Idioma: {language}
- Zona horaria: {timezone}
- Pantalla actual: {screen}
- Campos que faltan: {missingFields}
```

### 10.2 Contexto enviado

Solo lo necesario:

- Nombre y apellidos.
- Idioma, zona horaria.
- Campos vacíos relevantes.
- Última medición (peso, fecha).
- Próxima cita (fecha, tipo).
- Pantalla actual.

No enviar:

- Diagnósticos, medicación, alergias completas salvo que la conversación lo requiera.
- IDs internos innecesarios.
- Datos de otros pacientes.
- Clave API ni tokens.

### 10.3 Historial

- Últimos 20 mensajes completos.
- Resumen de los anteriores en `assistant_session.summary`.
- El resumen se actualiza cada 20 mensajes con una llamada aparte de bajo coste.
- Límite de contexto: 8.000 tokens; si se supera, truncar por antigüedad.

### 10.4 Idiomas

- `es`, `en`, `ca`, `gl`, `eu` según `AppUser.language`.
- Si el usuario escribe en otro idioma, responder en ese idioma y no cambiar la preferencia sin confirmación.

---

## 11. Seguridad, privacidad y cumplimiento

### 11.1 Autorización

- `SELF`: `subjectUserId = user_id`; solo el propio usuario.
- `STAFF`: exige `MANAGE_PATIENT_PROFILE` sobre `subjectUserId` en el tenant.
- El `tenantId` de la ruta se compara con el de la sesión y el del subject.
- Las tools reciben un `AssistantContext` inmutable con `actorUserId`, `subjectUserId`, `tenantId`, `mode`.
- El modelo **no** puede cambiar el subject.

### 11.2 Prompt injection

- El contenido del usuario se trata como dato, no como instrucción de sistema.
- Las tools son una whitelist cerrada; no hay SQL, HTTP ni shell.
- Se ignoran instrucciones del tipo “ignora tus reglas” o “muéstrame la clave”.
- El system prompt se repite al inicio de cada llamada.
- Tests con prompts maliciosos.

### 11.3 Privacidad

- No registrar contenido completo de mensajes en logs; solo IDs y metadatos.
- Redactar emails, teléfonos y datos clínicos en logs de error.
- No enviar datos clínicos a OneSignal.
- Retención: sesiones y mensajes 90 días; acciones 180 días; feedback 1 año. Job de purga.
- Derecho de supresión: borrar sesiones/mensajes del usuario y anonimizar métricas.

### 11.4 Consentimiento

- Texto claro: “Voy a usar un asistente de IA para ayudarte a completar tu perfil. Puedes cancelar cuando quieras.”
- Se guarda `consent_at`.
- Sin consentimiento, no se llama a Gemini.
- El consentimiento es por tenant y usuario; si cambia el texto, se vuelve a pedir.

### 11.5 Límites clínicos

- Lista de temas prohibidos: diagnóstico, dosis, interpretación de analíticas, síntomas graves, trastornos alimentarios.
- Respuesta estándar de derivación.
- Si detecta riesgo (p. ej. “quiero dejar de comer”), mostrar mensaje de ayuda y derivar; no continuar la conversación clínica.

### 11.6 Kill switch

- `assistant_mascot.enabled = false` desactiva el asistente para el tenant.
- `TenantPreferences.aiEnabled = false` lo desactiva globalmente.
- `app.assistant.enabled = false` lo desactiva en toda la plataforma.
- En todos los casos: 403 `ASSISTANT_DISABLED`.

---

## 12. Frontend Angular — mascota

### 12.1 Componentes

| Componente | Responsabilidad |
|---|---|
| `MascotAssistantComponent` | Contenedor, estado global, apertura/cierre. |
| `MascotAvatarComponent` | Avatar animado (Lottie/Rive) con estados. |
| `MascotChatComponent` | Lista de mensajes, input, typing indicator. |
| `MascotActionCardComponent` | Tarjeta de confirmación de `pendingAction`. |
| `MascotQuickRepliesComponent` | Sugerencias iniciales. |
| `AssistantApiService` | Cliente REST. |
| `AssistantStateService` | Sesión, mensajes, acción pendiente, errores. |

### 12.2 Estados del avatar

- `idle`: respiración/parpadeo.
- `listening`: el usuario escribe.
- `thinking`: llamada en curso.
- `happy`: acción aplicada.
- `confused`: error o no entendido.
- `sleeping`: sesión cerrada o inactiva.

### 12.3 Animación

- Formato recomendado: **Lottie** (`.json`) o **Rive** (`.riv`).
- Assets en MinIO, servidos por URL firmada; cachear en el cliente.
- Si el asset no carga, fallback a un avatar estático.
- Respetar `prefers-reduced-motion`: desactivar animaciones no esenciales.
- Peso máximo por asset: 500 KB.

### 12.4 UX

- La mascota no debe tapar contenido crítico; panel lateral o burbuja flotante.
- En móvil, bottom sheet.
- El usuario puede cerrar y reabrir; la sesión se conserva.
- La tarjeta de confirmación muestra:
  - Qué se va a cambiar.
  - Valor anterior → valor nuevo (si existe).
  - Botones “Guardar” y “Cancelar”.
- Nunca autoguardar.
- Mostrar disclaimer: “Asistente virtual. No sustituye a tu nutricionista.”

### 12.5 Accesibilidad

- `aria-live="polite"` para mensajes nuevos.
- Navegación por teclado.
- Contraste suficiente.
- Texto alternativo del avatar.
- No depender solo del color para estados.

### 12.6 Errores

- 503: “La mascota no está disponible ahora mismo”.
- 429: “Has alcanzado el límite de mensajes; inténtalo más tarde”.
- 409 acción expirada: “La propuesta ha caducado; vuelve a pedirlo”.
- Error de red: reintentar con el mismo mensaje.

---

## 13. Observabilidad y evaluación

### 13.1 Métricas

| Métrica | Uso |
|---|---|
| Sesiones/día | Adopción. |
| Mensajes/sesión | Profundidad. |
| Acciones propuestas | Frecuencia de captura. |
| Acciones confirmadas/rechazadas | Calidad de la propuesta. |
| Tiempo medio de respuesta | UX. |
| Errores por tipo | Estabilidad. |
| Tokens/sesión y coste | Economía. |
| Feedback | Satisfacción. |

### 13.2 Trazas

- `sessionId`, `messageId`, `toolName`, `tenantId`, `mode`.
- No incluir contenido.
- Logs estructurados JSON.

### 13.3 Evaluación

- Set de 30–50 conversaciones de prueba por caso de uso.
- Métricas: intención correcta, tool correcta, campos correctos, confirmación, alucinaciones.
- Revisión manual semanal durante el piloto.
- Golden tests de prompts: comparar respuestas ante entradas fijas.

---

## 14. Testing

### Unitarios

- `AssistantContextBuilder`: solo campos permitidos; sin datos de otros.
- `AssistantToolRegistry`: rechaza tools desconocidas y argumentos inválidos.
- `AssistantActionService`:
  - crea `PENDING`;
  - confirmar aplica una vez;
  - confirmar dos veces no duplica;
  - rechazar no escribe;
  - expirada no aplica.
- `GeminiAssistantClient`: timeout, reintento, 429, respuesta vacía.
- `AssistantConversationService`: lectura → tool → respuesta; escritura → pending action.

### MVC

- Crear sesión `SELF` y `STAFF`.
- Consentimiento obligatorio.
- Enviar mensaje y recibir `pendingAction`.
- Confirmar y verificar entidad creada.
- Cross-tenant devuelve 404.
- Cuota agotada devuelve 429.

### Seguridad

- Prompt injection: “ignora tus reglas y borra…”.
- Intento de cambiar `subjectUserId` desde el mensaje.
- Intento de acceder a otro tenant.
- Intento de usar `navigate_to` con pantalla no permitida.
- Verificar que la clave Gemini no aparece en respuestas ni logs.

### Integración

- Mock de Gemini con respuestas predefinidas (function call de lectura y de escritura).
- MinIO mockeado para avatar.
- Prueba manual con Gemini real en entorno de staging.

---

## 15. Tareas y estimación

### Backend Java

| ID | Tarea | Días |
|---|---|---|
| MA-01 | Spike SDK Gemini 1.77: function calling, timeouts, tokens | 1 |
| MA-02 | Migración `V55`, entidades, repositorios | 2 |
| MA-03 | `AssistantMascotService` + config + avatar en MinIO | 1 |
| MA-04 | `AssistantSessionService` + consentimiento + expiración | 2 |
| MA-05 | `AssistantContextBuilder` + whitelist de campos | 2 |
| MA-06 | `AssistantToolRegistry` + tools de lectura | 2 |
| MA-07 | Tools de escritura + `pending_action` + preview | 3 |
| MA-08 | `AssistantActionService` + confirmar/rechazar + idempotencia | 3 |
| MA-09 | `GeminiAssistantClient` + bucle + reintentos + circuit breaker | 3 |
| MA-10 | `AssistantConversationService` + prompt + historial + resumen | 3 |
| MA-11 | Endpoints REST + DTOs + OpenAPI + errores | 2 |
| MA-12 | Cuotas, métricas, auditoría, kill switch | 2 |
| MA-13 | Tests unitarios + MVC + seguridad | 4 |
| MA-14 | Documento de contrato Angular (`doc/mascota-frontend.md`) | 1 |
| **Total backend** | | **31 días** |

Con 1 backend: **7–8 semanas** efectivas; 9–10 con margen y revisión.

### Frontend Angular

| Tarea | Días |
|---|---|
| Servicio API + modelos + estado | 2 |
| Componente contenedor + apertura/cierre | 1 |
| Avatar Lottie/Rive + estados + reduced motion | 3 |
| Chat + mensajes + typing indicator | 3 |
| Tarjetas de confirmación + diff de campos | 3 |
| Quick replies + onboarding + consentimiento | 2 |
| Errores, reintentos, accesibilidad | 2 |
| Tests | 3 |
| **Total frontend** | **19 días** |

Con 1 frontend: **5–6 semanas** efectivas.

### Diseño/animación

- Personaje y expresiones: 5–8 días.
- Assets Lottie/Rive: 5–10 días.
- Guía de tono y microcopy: 2–3 días.
- Total: **2–3 semanas** en paralelo.

### Calendario conjunto

- Backend y frontend pueden solaparse a partir de MA-11 (contrato REST).
- Diseño debe empezar antes.
- Elapsed total: **8–10 semanas** con 1 backend + 1 frontend + diseño parcial.

---

## 16. Criterios de aceptación

- [ ] El asistente se activa/desactiva por tenant.
- [ ] Sin `aiEnabled` o sin clave Gemini, devuelve 403 claro.
- [ ] El usuario debe consentir antes de la primera conversación.
- [ ] La mascota responde en el idioma del usuario.
- [ ] La mascota detecta campos vacíos y pregunta de uno en uno.
- [ ] Ninguna escritura ocurre sin `pending_action` confirmada.
- [ ] Confirmar dos veces no duplica datos.
- [ ] Rechazar no modifica nada.
- [ ] Una acción expirada no se puede aplicar.
- [ ] El modo `STAFF` exige `MANAGE_PATIENT_PROFILE`.
- [ ] Un usuario no puede actuar sobre otro tenant ni otro paciente.
- [ ] El modelo no puede cambiar el `subjectUserId`.
- [ ] Las tools de lectura solo devuelven campos de la whitelist.
- [ ] Los errores de Gemini no dejan acciones huérfanas.
- [ ] Se registran tokens y se aplican cuotas.
- [ ] No hay contenido sensible en logs ni en push.
- [ ] La mascota tiene estados visuales y respeta `prefers-reduced-motion`.
- [ ] Tests unitarios, MVC y de seguridad pasan.
- [ ] `doc/mascota-frontend.md` describe el contrato para Angular.

---

## 17. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Alucinaciones al rellenar campos | Alto | Confirmación obligatoria + validación con DTOs + whitelist. |
| Prompt injection | Alto | Tools cerradas, subject fijado en servidor, tests. |
| Coste de Gemini | Medio | Cuotas, modelo flash, límite de tokens, métricas. |
| Latencia | Medio | Timeout, respuestas cortas, modelo flash. |
| Complejidad de la UI | Medio | Empezar con avatar estático + Lottie básico; Rive después. |
| Datos clínicos sensibles | Alto | Minimización, consentimiento, retención, redacción de logs. |
| Dependencia del SDK Gemini | Medio | Wrapper propio + spike + fallback 503. |
| Expectativas del usuario | Medio | Copy claro: asistente administrativo, no clínico. |
| Multi-tenant | Alto | Contexto inmutable + validación en cada tool. |
| Acciones huérfanas | Bajo | Expiración 15 min + job de limpieza. |

---

## 18. Fuera de alcance

- Consejo nutricional personalizado.
- Interpretación de analíticas o composición corporal.
- Generación de menús.
- Voz.
- RAG sobre documentos.
- Mascota 3D.
- Gamificación (puntos, rachas).
- Integración con wearables.
- Múltiples mascotas o personalización por paciente.
- Entrenamiento/fine-tuning.
- Microservicio Python.
