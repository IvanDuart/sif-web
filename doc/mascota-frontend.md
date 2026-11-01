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
  "persona": "Cercana y breve",
  "tone": "CERCANO",
  "defaultSkinId": "manzana",
  "greeting": "¡Hola! Soy Nuti. ¿Te ayudo a completar tu perfil?",
  "suggestedPrompts": ["Completar mis datos", "¿Qué me falta?", "Registrar mi peso"],
  "consentRequired": false,
  "consentText": null,
  "lookPolicy": {
    "allowUserLook": true,
    "allowedSkinIds": [],
    "allowedAccessories": []
  }
}
```

- `defaultSkinId`: skin por defecto del centro. Siempre existe en el catálogo.
- `lookPolicy.allowUserLook`: si es `false`, el frontend oculta el wardrobe y
  pinta `defaultSkinId` para todos los usuarios.
- `lookPolicy.allowedSkinIds`: skins permitidas. Vacío significa cualquiera del
  catálogo.
- `lookPolicy.allowedAccessories`: accesorios permitidos. Vacío significa
  cualquiera soportado por la skin elegida.
- `consentRequired` se calcula a partir de `consentText`.

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
  "defaultSkinId": "melon",
  "enabled": true,
  "consentText": "Voy a usar un asistente de IA...",
  "lookPolicy": {
    "allowUserLook": true,
    "allowedSkinIds": ["manzana", "naranja", "pina", "melon"],
    "allowedAccessories": ["orejas"]
  }
}
```

- `defaultSkinId` debe existir en el catálogo; si no, `422`.
- Todos los `allowedSkinIds` deben existir en el catálogo.
- Todos los `allowedAccessories` deben existir en el catálogo de accesorios.

### 2.4 Catálogo de mascotas

```http
GET /api/tenant/{tenantId}/assistant/pets
```

Respuesta:

```json
[
  {
    "id": "manzana",
    "name": "Manzana",
    "category": "FRUIT",
    "order": 1,
    "supports": {
      "accessories": ["orejas"],
      "expressions": ["idle", "listening", "thinking", "happy", "confused", "sleeping"]
    }
  },
  {
    "id": "naranja",
    "name": "Naranja",
    "category": "FRUIT",
    "order": 2,
    "supports": {
      "accessories": ["orejas"],
      "expressions": ["idle", "listening", "thinking", "happy", "confused", "sleeping"]
    }
  },
  {
    "id": "pina",
    "name": "Piña",
    "category": "FRUIT",
    "order": 3,
    "supports": {
      "accessories": ["orejas"],
      "expressions": ["idle", "listening", "thinking", "happy", "confused", "sleeping"]
    }
  },
  {
    "id": "melon",
    "name": "Melón",
    "category": "FRUIT",
    "order": 4,
    "supports": {
      "accessories": ["orejas"],
      "expressions": ["idle", "listening", "thinking", "happy", "confused", "sleeping"]
    }
  },
  {
    "id": "brocoli",
    "name": "Brócoli",
    "category": "VEGETABLE",
    "order": 5,
    "supports": {
      "accessories": ["orejas"],
      "expressions": ["idle", "listening", "thinking", "happy", "confused", "sleeping"]
    }
  },
  {
    "id": "zanahoria",
    "name": "Zanahoria",
    "category": "VEGETABLE",
    "order": 6,
    "supports": {
      "accessories": ["orejas"],
      "expressions": ["idle", "listening", "thinking", "happy", "confused", "sleeping"]
    }
  },
  {
    "id": "semilla",
    "name": "Semilla",
    "category": "SEED",
    "order": 7,
    "supports": {
      "accessories": ["orejas"],
      "expressions": ["idle", "listening", "thinking", "happy", "confused", "sleeping"]
    }
  }
]
```

El backend **no envía SVG**. El frontend dibuja cada skin de forma procedural y
usa `supports` para filtrar accesorios y saber qué expresiones puede mostrar.
El `id` coincide con el identificador de la skin en el frontend y es **ASCII**
y en minúscula: `pina` va sin eñe y `brocoli` sin tilde, aunque los nombres
visibles sean `Piña` y `Brócoli`.

#### Quién manda en el catálogo

`GET /assistant/pets` **es** la lista de todo lo que conoce el backend: el
catálogo vive en una sola clase (`PetPresetCatalog`) y es la misma fuente que
valida `PUT /assistant/look`. Un id que no esté ahí da `422
error.assistant_pet_not_found`, y no hay ids aceptados que no aparezcan.

Con **una excepción**, que no es un descuido: el centro puede restringir el
armario con `lookPolicy.allowedSkinIds` (ver §2.1 y §2.3). Si esa lista no está
vacía, `PUT /look` rechaza con `422 error.assistant_look_not_allowed` una
mascota que sí viene en `/pets`. O sea:

- `/pets` = catálogo completo del producto.
- `lookPolicy.allowedSkinIds` = lo que este centro permite (vacío = todo).
- Lo que el usuario puede elegir = la intersección de las dos, y es lo que el
  armario debería pintar.

> **Nota de la V58/V59.** `brocoli`, `zanahoria` y `semilla` estuvieron fuera
> del catálogo unos días. La migración que las retiró repuntó a `manzana` los
> looks que las usaban y las podó de los `allowedSkinIds`, y eso **no se
> deshace**: vuelven a poder elegirse, pero quien tenía brócoli no lo recupera
> solo. Un centro con política restringida tiene que volver a añadirlas a
> `allowedSkinIds` si las quiere ofrecer.

### 2.5 Elegir la mascota por defecto del centro

Requiere `MANAGE_TENANT`.

```http
PUT /api/tenant/{tenantId}/assistant/pets/default/{petId}
```

Equivale a actualizar `defaultSkinId`. Devuelve el `AssistantConfigDto`
actualizado.

### 2.6 Look del usuario

#### Obtener el look

```http
GET /api/tenant/{tenantId}/assistant/look
```

Respuesta (`200`):

```json
{
  "skinId": "melon",
  "accessories": ["orejas"],
  "updatedAt": "2026-10-31T09:15:00Z"
}
```

Si el usuario nunca configuró nada:

```json
{
  "skinId": null,
  "accessories": [],
  "updatedAt": null
}
```

En ese caso el frontend usa `config.defaultSkinId`.

#### Guardar el look

```http
PUT /api/tenant/{tenantId}/assistant/look
Content-Type: application/json

{
  "skinId": "pina",
  "accessories": ["orejas"]
}
```

Reglas:

- `skinId` debe existir en el catálogo y estar permitido por
  `lookPolicy.allowedSkinIds` (si la lista no está vacía).
- Cada accesorio debe estar permitido por `lookPolicy.allowedAccessories` (si
  la lista no está vacía) y ser soportado por la skin.
- No requiere permiso especial: cada usuario cambia su propio look.
- Devuelve el `AssistantUserLookDto` actualizado.

#### Borrar el look

```http
DELETE /api/tenant/{tenantId}/assistant/look
```

Vuelve al `defaultSkinId` del tenant. Respuesta `204`.

### 2.7 Notas de migración desde v1

Se eliminan:

- `PUT /assistant/avatar` (subida de SVG).
- `PUT /assistant/animations/{animationName}`.
- `DELETE /assistant/animations/{animationName}`.
- Los campos `avatarUrl`, `avatarExpiresAt` y `animations` de
  `AssistantConfigDto`.

Se añaden:

- `defaultSkinId` y `lookPolicy` en `AssistantConfigDto`.
- `GET/PUT/DELETE /assistant/look`.
- `PUT /assistant/pets/default/{petId}` (sustituye a
  `PUT /assistant/avatar/preset/{petId}`).

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

Con un adjunto subido antes (ver §4.3) se añade su id, y nada más:

```json
{ "content": "¿Me pasas estos valores a la ficha?", "attachmentId": "uuid" }
```

Vale igual para `POST .../messages/stream` (`assistant-frontend.md` §3.1): los
dos endpoints leen el mismo cuerpo y acaban en el mismo sitio, así que el turno
con adjunto va por streaming como cualquier otro. La diferencia está en el
error: en el stream la respuesta ya salió con `200`, así que lo que en el
bloqueante es un `404` llega como evento `error` con el mismo `code`
(`error.assistant_attachment_not_found`). Y ese código es el mismo para un
adjunto inexistente, de otra sesión o de otro tenant: a propósito, no se
distingue "no existe" de "no es tuyo".

Respuesta con texto y, opcionalmente, una acción pendiente:

```json
{
  "assistantMessage": {
    "id": "uuid",
    "sessionId": "uuid",
    "role": "ASSISTANT",
    "content": "He entendido 72,5 kg. ¿Quieres que lo guarde con la fecha de hoy?",
    "attachment": null,
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

Mismo formato de cursor que el chat. Los adjuntos vuelven con la URL firmada
regenerada en cada lectura, así que el historial nunca trae un enlace caducado.

### 4.3 Adjuntos

Subir el archivo es un paso aparte, **antes** de enviar el mensaje. Así el
endpoint de streaming sigue siendo JSON y el archivo se sube una sola vez
aunque el turno falle.

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/attachments
Content-Type: multipart/form-data

file: <binario>
```

```json
{
  "id": "uuid",
  "fileName": "analitica-marzo.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 241533,
  "url": "https://minio.../firmada"
}
```

Después se envía el mensaje de siempre con `attachmentId` (§4.1), y el
`assistantMessage` del turno lo devuelve en `attachment` con esa misma forma.
En los mensajes que no tienen adjunto —incluidos todos los del asistente—
`attachment` es `null`.

Para refrescar la URL cuando caduca:

```http
GET /api/tenant/{tenantId}/assistant/attachments/{attachmentId}/url
```

**Límites y validación**

| | Valor |
|---|---|
| Tipos | JPEG, PNG, WebP y **PDF** |
| Tamaño | 10 MB (`ASSISTANT_ATTACHMENT_MAX_BYTES`) |
| Por mensaje | 1 |
| Validación | magic bytes — el `Content-Type` que declare el cliente se ignora |
| TTL de la URL | 10 minutos |

**El modelo lo lee de verdad.** El adjunto entra en el contexto del turno junto
con el texto, no solo se almacena. La lista de tipos de arriba es exactamente la
lista de tipos que el modelo sabe leer, y se valida **antes** de aceptar la
subida: un tipo que no pueda leer se rechaza con `422
error.assistant_attachment_unsupported` en lugar de almacenarse para que luego
la mascota conteste "no puedo ver la imagen".

Dentro de la conversación, el backend reenvía al modelo **solo el adjunto más
reciente** de la ventana de historial. Es lo que hace que "¿me pasas estos
valores a la ficha?" funcione en el turno siguiente al de la subida sin reenviar
cada PDF de la conversación en cada turno.

La mascota puede **transcribir** lo que pone el documento (valores, unidades,
fechas) para rellenar la ficha, pero sigue sin **interpretarlo**: no dirá si un
valor es bueno, malo o preocupante.

**Aislamiento y retención**

- El adjunto vive bajo su tenant y su sesión, y solo lo lee el dueño de esa
  sesión. Otro usuario del mismo centro recibe `404`, no `403`.
- Hereda el `subjectUserId` de la sesión, para que una auditoría posterior sepa
  de qué paciente era el PDF.
- **Muere con la conversación.** Cerrar la sesión (§3.3) y la expiración
  automática borran también los objetos de MinIO. No hay un `DELETE` de
  adjuntos aparte: el cierre de la sesión **es** ese borrado. El
  `DELETE /sessions/{id}` del §3.3 sigue existiendo tal cual.
  <!-- Corregido el 2026-11-01: la frase original decía "No hay
  `DELETE /sessions/{id}`", que contradecía al §3.3. Confirmado por backend al
  responder `mascota-adjuntos-preguntas-backend.md` §2. -->
- Por eso **cambiar de ficha de paciente no cierra la sesión**: las sesiones van
  por `(tenant, usuario, paciente)` y no hay límite de abiertas, así que pedir
  la de otro paciente no toca la anterior. El `DELETE` es solo para cuando la
  persona cierra la conversación a propósito.

---

## 5. Preferencias e hitos del usuario

Las dos cosas que la mascota necesita recordar de cada persona para hablar sin
que le pregunten. Son del usuario autenticado y del tenant de la URL, como el
look: nadie lee ni edita las de otro, y cambiar de centro cambia de preferencias
y de hitos.

### 5.1 Preferencias

```http
GET /api/tenant/{tenantId}/assistant/preferences
```

```json
{
  "proactiveEnabled": true,
  "silencedTips": ["appointment.create", "menu.generate"],
  "stuckFormOfferEnabled": true,
  "celebrationsEnabled": true,
  "updatedAt": "2026-11-01T10:10:00Z"
}
```

```http
PUT /api/tenant/{tenantId}/assistant/preferences
Content-Type: application/json

{ "proactiveEnabled": true, "silencedTips": ["appointment.create"], "stuckFormOfferEnabled": false, "celebrationsEnabled": true }
```

- El `PUT` **reemplaza el objeto entero** y devuelve lo guardado con
  `updatedAt` nuevo. Lo que no venga vuelve a su valor por defecto (activado,
  lista vacía).
- Si el usuario nunca ha guardado, el `GET` devuelve los valores por defecto con
  `updatedAt: null`. Nunca un `404`.
- `silencedTips` son ids opacos que inventa el frontend (`<dominio>.<acción>`).
  El backend no los valida ni los conoce: solo limita la lista a **50 ids de
  hasta 64 caracteres**, recorta lo que pase de ahí y quita duplicados y
  vacíos. Añadir un tip nuevo no necesita tocar backend.
- `proactiveEnabled: false` apaga las tres cosas de golpe.

### 5.2 Hitos

```http
GET /api/tenant/{tenantId}/assistant/milestones
```

```json
[
  { "code": "first_patient",      "reachedAt": "2026-09-02T09:00:00Z", "celebratedAt": "2026-09-02T09:00:05Z" },
  { "code": "first_appointment",  "reachedAt": "2026-11-01T10:10:00Z", "celebratedAt": null },
  { "code": "first_measurement",  "reachedAt": null,                   "celebratedAt": null },
  { "code": "first_menu",         "reachedAt": null,                   "celebratedAt": null },
  { "code": "first_menu_template","reachedAt": null,                   "celebratedAt": null },
  { "code": "first_shopping_list","reachedAt": null,                   "celebratedAt": null }
]
```

```http
POST /api/tenant/{tenantId}/assistant/milestones/{code}/celebrated
```

→ `204`. Idempotente: marcarlo dos veces no es un error y la primera fecha
manda. Un `code` desconocido da `404`.

- Siempre vuelven **los seis códigos**. `reachedAt: null` = no ha ocurrido.
- `reachedAt` lo calcula el backend desde sus propios datos. El frontend no
  avisa de nada.
- Son **por usuario dentro del centro**, no por centro: el nutricionista que se
  incorpora hoy a una clínica de dos años tiene derecho a su primera vez.
- No es tiempo real: se calcula al leer, así que un hito recién alcanzado puede
  tardar en aparecer. Leer al abrir la aplicación y después de guardar algo
  relevante es suficiente.

> **Lo que no se puede celebrar hacia atrás.** Hasta la migración V59 el backend
> no guardaba quién creaba un menú, una medición, una plantilla o una lista: la
> columna de usuario de esas tablas es la del **paciente**. Ahora sí se guarda,
> pero las filas anteriores no tienen autor. Para que a nadie le salte "¡Tu
> primer menú!" delante de un paciente después de dos años usando la
> aplicación, **todo el personal que ya existía queda marcado como celebrado**
> (`celebratedAt` puesto, `reachedAt` nulo hasta que el cálculo encuentre el
> dato). La contrapartida: quien se dio de alta hace poco y aún no había creado
> nada pierde esas celebraciones. Es el lado seguro del error.
>
> `first_appointment` y `first_patient` sí tienen fecha real hacia atrás, porque
> la cita guarda su nutricionista y el alta del paciente guarda quién la hizo.

---

## 6. Confirmar o rechazar una acción

### 6.1 Confirmar

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

### 6.2 Rechazar

```http
POST /api/tenant/{tenantId}/assistant/pending-actions/{actionId}/reject
```

- Respuesta `204`.
- No escribe nada.

---

## 7. Tools disponibles

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

## 8. UI recomendada

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

## 9. Errores

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
| `error.assistant_pet_not_found` | 422 | `skinId` no existe en el catálogo. |
| `error.assistant_invalid_accessory` | 422 | Accesorio no soportado o no permitido. |
| `error.assistant_look_disabled` | 422 | `lookPolicy.allowUserLook` es `false`. |
| `error.assistant_look_not_allowed` | 422 | `skinId` no está en `allowedSkinIds`. |
| `error.assistant_attachment_not_found` | 404 | Adjunto inexistente, de otra sesión o de otro usuario. |
| `error.assistant_attachment_too_large` | 413 | Supera el límite de 10 MB. |
| `error.assistant_attachment_unsupported` | 422 | Tipo que el modelo no lee. Admitidos: JPEG, PNG, WebP y PDF. |
| `error.assistant_milestone_not_found` | 404 | `code` de hito desconocido. |
| `error.permission_denied` | 403 | Modo `STAFF` sin `MANAGE_PATIENT_PROFILE`. |

---

## 10. Checklist de integración Angular

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
