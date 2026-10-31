# Mascota conversacional — contrato para Angular

> **Estado:** backend v1 implementado.
> **Base:** `context-path` `/api`.
> **Autenticación:** `Authorization: Bearer <JWT>`.
> **Regla de oro:** ninguna escritura se aplica sin `pending_action` confirmada.

---

## 1. Resumen

La mascota es un asistente administrativo:

- Ayuda a completar el perfil y la anamnesis.
- Propone registrar mediciones.
- Permite navegar a pantallas conocidas.
- Responde en el idioma del usuario.
- **No** diagnostica, no prescribe y no interpreta analíticas.

Toda escritura sigue este ciclo:

```text
mensaje → Gemini propone una acción → pendingAction
        → el usuario confirma → se escribe
        → o el usuario rechaza → no se escribe
```

---

## 2. Configuración

### 2.1 Obtener configuración

```http
GET /api/tenant/{tenantId}/assistant/config
```

```json
{
  "enabled": true,
  "apiKeyConfigured": true,
  "name": "Nuti",
  "tone": "CERCANO",
  "avatarUrl": "https://minio.../firmada",
  "avatarExpiresAt": "2026-10-29T10:25:00Z",
  "animations": {
    "idle": "https://minio.../idle.json",
    "thinking": "https://minio.../thinking.json"
  },
  "greeting": "¡Hola! Soy Nuti. ¿Te ayudo a completar tu perfil?",
  "suggestedPrompts": ["Completar mis datos", "¿Qué me falta?", "Registrar mi peso"],
  "consentRequired": false
}
```

### 2.2 Configurar la clave Gemini

La clave se guarda siempre cifrada y nunca se devuelve en las respuestas.
Usa `apiKeyConfigured` de `GET /assistant/config` para decidir si el botón
debe decir “Configurar clave” o “Rotar clave”. También puedes leer
`api_key_configured` en las respuestas de preferencias y `hasApiKey` en
`GET /tenant/{tenantId}/branding`.

Usa el endpoint dedicado para evitar enviar el resto de preferencias:

```http
PUT /api/tenant/{tenantId}/preferences/ai-key
Content-Type: application/json

{ "apiKey": "AIza..." }
```

También se aceptan los alias `geminiApiKey`, `gemini_api_key`, `apiKey` y `key`.

Para borrarla:

```http
DELETE /api/tenant/{tenantId}/preferences/ai-key
```

> **Compatibilidad:** `PATCH /api/tenant/{tenantId}/preferences` acepta tanto
> `gemini_api_key` como `geminiApiKey`. Si el campo se omite o llega vacío, se
> conserva la clave actual. Para borrarla desde el PATCH, envía
> `"gemini_api_key": "__REMOVE__"`.

### 2.3 Actualizar configuración

Requiere `MANAGE_TENANT`.

```http
PUT /api/tenant/{tenantId}/assistant/config
Content-Type: application/json

{
  "name": "Nuti",
  "persona": "Cercana y breve",
  "tone": "CERCANO",
  "avatarStoredFileId": "uuid",
  "animations": { "idle": "...", "thinking": "..." },
  "enabled": true,
  "consentText": "Voy a usar un asistente de IA..."
}
```

### 2.4 Subir el avatar (SVG)

Requiere `MANAGE_TENANT`. El SVG se valida y se sanea en el backend
(se eliminan scripts, manejadores de eventos y referencias externas) antes de
guardarse en MinIO. Tamaño máximo por defecto: 512 KB.

```http
PUT /api/tenant/{tenantId}/assistant/avatar
Content-Type: multipart/form-data

file: avatar.svg
```

Respuesta: el mismo `AssistantConfigDto` de `GET /assistant/config`, con
`avatarUrl` actualizado.

### 2.5 Mascotas predefinidas

Todas las mascotas SVG empaquetadas en `src/main/resources/pets/` están
disponibles para cualquier tenant.

#### Listar mascotas

```http
GET /api/tenant/{tenantId}/assistant/pets
```

Respuesta:

```json
[
  { "id": "brocoli", "name": "Brocoli", "svgContent": "<svg ..." },
  { "id": "manzana", "name": "Manzana", "svgContent": "<svg ..." },
  { "id": "semilla", "name": "Semilla", "svgContent": "<svg ..." },
  { "id": "zanahoria", "name": "Zanahoria", "svgContent": "<svg ..." }
]
```

El frontend usa `svgContent` para pintar el selector.

#### Elegir una mascota

Requiere `MANAGE_TENANT`.

```http
PUT /api/tenant/{tenantId}/assistant/avatar/preset/{petId}
```

El backend copia el SVG elegido a MinIO y lo fija como avatar del centro.
Los SVG predefinidos se consideran de confianza y conservan sus animaciones
CSS. Devuelve el `AssistantConfigDto` con la nueva `avatarUrl` firmada.

### 2.6 Subir o reemplazar una animación Lottie

Requiere `MANAGE_TENANT`. Nombres admitidos: `idle`, `listening`, `thinking`,
`happy`, `confused`, `sleeping`. Tamaño máximo por defecto: 2 MB.

```http
PUT /api/tenant/{tenantId}/assistant/animations/{animationName}
Content-Type: multipart/form-data

file: idle.json
```

La animación debe ser un JSON Lottie válido (con `v` y `fr`).

Respuesta: el mismo `AssistantConfigDto`, con `animations` actualizado a URLs
firmadas.

### 2.7 Borrar una animación

```http
DELETE /api/tenant/{tenantId}/assistant/animations/{animationName}
```

Respuesta: el mismo `AssistantConfigDto`, sin la animación eliminada.

---

## 3. Sesión

### 3.1 Crear o reutilizar sesión

```http
POST /api/tenant/{tenantId}/assistant/sessions
Content-Type: application/json

{ "mode": "SELF", "subjectUserId": null, "screen": "PROFILE" }
```

- `SELF`: el usuario habla por sí mismo.
- `STAFF`: el profesional actúa sobre un paciente. Exige `subjectUserId` y `MANAGE_PATIENT_PROFILE`.
- Si hay una sesión activa del mismo usuario y subject, se reutiliza.

Respuesta:

```json
{
  "sessionId": "uuid",
  "consentRequired": true,
  "greeting": "¡Hola! Soy Nuti. ¿Te ayudo a completar tu perfil?",
  "expiresAt": "2026-10-30T10:00:00Z",
  "mode": "SELF",
  "subjectUserId": "uuid"
}
```

### 3.2 Consentimiento

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/consent
Content-Type: application/json

{ "accepted": true }
```

- Sin consentimiento no se llama a Gemini.
- `accepted: false` cierra la sesión.
- Respuesta `204`.

### 3.3 Cerrar sesión

```http
DELETE /api/tenant/{tenantId}/assistant/sessions/{sessionId}
```

- Respuesta `204`.
- No borra el historial.

---

## 4. Conversación

### 4.1 Enviar mensaje

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages
Content-Type: application/json

{ "content": "Me peso 72,5 kg" }
```

Respuesta con texto y, opcionalmente, una acción pendiente:

```json
{
  "assistantMessage": {
    "id": "uuid",
    "sessionId": "uuid",
    "role": "ASSISTANT",
    "content": "He entendido 72,5 kg. ¿Quieres que lo guarde con la fecha de hoy?",
    "createdAt": "2026-10-29T10:01:00Z"
  },
  "pendingAction": {
    "id": "uuid",
    "toolName": "create_measurement",
    "summary": "Registrar medición corporal",
    "preview": [
      { "field": "weightKg", "label": "Peso (kg)", "value": "72.5" },
      { "field": "measuredAt", "label": "Fecha de medición", "value": "2026-10-29" }
    ],
    "idempotencyKey": "uuid",
    "expiresAt": "2026-10-29T10:16:00Z"
  },
  "uiActions": []
}
```

**Importante:** guarda `idempotencyKey` junto a la tarjeta. Se reenvía al confirmar.

Si no hay escritura, `pendingAction` es `null` y `uiActions` puede traer una navegación:

```json
{ "type": "NAVIGATE", "screen": "MEASUREMENTS", "params": {} }
```

### 4.2 Historial

```http
GET /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages?before=<cursor>&limit=30
```

Mismo formato de cursor que el chat.

---

## 5. Confirmar o rechazar una acción

### 5.1 Confirmar

```http
POST /api/tenant/{tenantId}/assistant/pending-actions/{actionId}/confirm
Content-Type: application/json

{ "idempotencyKey": "el-mismo-que-llegó-en-pendingAction" }
```

Respuesta:

```json
{
  "status": "APPLIED",
  "entityType": "BODY_MEASUREMENT",
  "entityId": "uuid",
  "message": "Medición registrada."
}
```

- Confirmar dos veces con la misma clave devuelve `APPLIED` sin duplicar.
- Con otra clave devuelve `409`.
- Una acción expirada devuelve `409`.

### 5.2 Rechazar

```http
POST /api/tenant/{tenantId}/assistant/pending-actions/{actionId}/reject
```

- Respuesta `204`.
- No escribe nada.

---

## 6. Tools disponibles

| Tool | Tipo | Efecto |
|---|---|---|
| `get_profile` | Lectura | Campos permitidos del perfil. |
| `get_missing_fields` | Lectura | Campos relevantes que faltan. |
| `get_latest_measurement` | Lectura | Última medición. |
| `get_upcoming_appointments` | Lectura | Próximas citas. |
| `get_active_menu_summary` | Lectura | Menú activo. |
| `get_tenant_info` | Lectura | Centro, idioma, zona horaria. |
| `update_profile` | Escritura | Propone datos básicos. |
| `update_anamnesis` | Escritura | Propone anamnesis. |
| `create_measurement` | Escritura | Propone medición. |
| `update_locale` | Escritura | Propone idioma/zona horaria. |
| `navigate_to` | Navegación | Devuelve `uiActions`. |

Pantallas permitidas: `PROFILE`, `ANAMNESIS`, `MEASUREMENTS`, `MENU`, `APPOINTMENTS`, `DIARY`.

---

## 7. UI recomendada

- `MascotAvatarComponent` con estados: `idle`, `listening`, `thinking`, `happy`, `confused`, `sleeping`.
- `MascotChatComponent` con burbujas y `aria-live="polite"`.
- `MascotActionCardComponent`:
  - Muestra `summary` y la lista `preview`.
  - Botones “Guardar” y “Cancelar”.
  - Envía el `idempotencyKey` al confirmar.
- `MascotQuickRepliesComponent` con `suggestedPrompts`.
- Panel lateral en escritorio; bottom sheet en móvil.
- Respetar `prefers-reduced-motion`: desactivar animaciones no esenciales.
- Disclaimer visible: “Asistente virtual. No sustituye a tu nutricionista.”

---

## 8. Errores

| Código | HTTP | Cuándo |
|---|---|---|
| `error.assistant_disabled` | 403 | Kill switch de plataforma, tenant o mascota. |
| `error.ai_not_enabled_for_tenant` | 403 | `aiEnabled` desactivado. |
| `error.ai_api_key_not_configured` | 403 | Sin clave Gemini. |
| `error.assistant_consent_required` | 403 | Falta consentimiento. |
| `error.assistant_session_not_found` | 404 | Sesión inexistente o de otro usuario. |
| `error.assistant_session_closed` | 409 | Sesión cerrada o expirada. |
| `error.assistant_quota_exceeded` | 429 | Cuota diaria agotada. |
| `error.assistant_unavailable` | 503 | Gemini no responde. |
| `error.assistant_action_not_found` | 404 | Acción inexistente o de otro usuario. |
| `error.assistant_action_expired` | 409 | Acción caducada. |
| `error.assistant_action_already_resolved` | 409 | Acción ya resuelta con otra clave. |
| `error.assistant_action_invalid` | 409/422 | Payload inválido o clave incorrecta. |
| `error.assistant_invalid_tool_arguments` | 422 | Argumentos de tool inválidos. |
| `error.permission_denied` | 403 | Modo `STAFF` sin `MANAGE_PATIENT_PROFILE`. |

---

## 9. Checklist de integración Angular

- [ ] Cargar `/assistant/config` antes de mostrar la mascota.
- [ ] Crear sesión y pedir consentimiento si `consentRequired`.
- [ ] Mostrar `greeting` y `suggestedPrompts`.
- [ ] Enviar mensajes a `/sessions/{id}/messages`.
- [ ] Pintar `pendingAction` como tarjeta de confirmación.
- [ ] Guardar y reenviar `idempotencyKey` al confirmar.
- [ ] Tratar `uiActions` como navegación, nunca como rutas libres.
- [ ] Mostrar errores 403/409/429/503 con mensajes claros.
- [ ] Respetar `prefers-reduced-motion`.
- [ ] No mostrar datos clínicos en notificaciones push.
