---
id: assistant-frontend-contract
type: submodule-design
title: Asistente para nutricionistas — contrato para Angular
status: draft
parent: ai
---

# Asistente para nutricionistas — contrato para Angular

> **Estado:** implementadas las peticiones de [`assistant-tools-backend.md`](assistant-tools-backend.md)
> y [`assistant-backend-peticion.md`](assistant-backend-peticion.md).
> **Permisos de los endpoints:** abrir sesión, `sessions/latest`, enviar mensaje (normal y
> streaming) y subir adjuntos exigen `MANAGE_PATIENT_PROFILE`. Historial, consentimiento, cerrar
> sesión y confirmar/rechazar acciones solo exigen ser miembro del tenant (la propiedad de la
> sesión/acción se comprueba en el servicio).
> **Base:** `context-path` `/api`.
> **Autenticación:** `Authorization: Bearer <JWT>`.

---

## 1. Qué ha cambiado en esta entrega

- El catálogo pasa de **28 a 57 tools**: horarios del centro, huecos de agenda, tipos
  de cita, datos del centro, ficha del paciente, seguimiento, menús e ingresos.
- **`create_measurement` admite los 23 campos** del formulario, y existe
  `update_measurement`. **`update_anamnesis` admite los 18 antecedentes** con sus
  notas.
- El `preview` de las citas usa los nombres del diálogo: `patientId`,
  `nutritionistId`, `typeId`, **`date` y `time` separados**, `notes`.
- `uiActions` admite **`OPEN_DIALOG`, `HIGHLIGHT` y `TOAST`** además de `NAVIGATE`,
  y el DTO tiene un campo **`target`** nuevo.
- **10 pantallas nuevas** en `ALLOWED_SCREENS`.
- La respuesta de **`confirm` puede traer `uiActions`**.
- Envío de mensaje **en streaming (SSE)**.
- **`GET /sessions/latest`** para retomar la conversación.

### Lo que se pidió y no entra, y por qué

| Pedido | Qué se hizo |
|---|---|
| `VIEW_TENANT` para las tools de lectura de horarios | **Ese permiso no existe.** Se usan `VIEW_SCHEDULE` y `VIEW_HOLIDAY`, que es lo que ya guarda `ScheduleController` y `HolidayController`, y que `ADMIN`, `NUTRITIONIST` y `USER` ya tienen. |
| `cancel_appointment` | Se solapa con `update_appointment_status`. En vez de duplicarla, su descripción ahora dice explícitamente que sirve para cancelar; era por ahí por donde el modelo no la encontraba. |
| `assign_menu_template` | Se solapa con `create_menu_from_template`, que ya existía. Lo que faltaba no era una tool sino el `preview` con los nombres del diálogo, y ya los emite. |
| `send_message_to_patient` | No se implementa, por la razón del propio documento. |
| `"status": "CONFIRMED"` en `confirm` | **Sigue siendo `"APPLIED"`**, que es lo que el frontend ya consume. No se cambia para no romper nada. |

**No ha hecho falta ninguna migración Flyway**: todos los permisos existían.

---

## 2. Abrir sesión

```http
POST /api/tenant/{tenantId}/assistant/sessions
Content-Type: application/json

{ "subjectUserId": "uuid-del-paciente", "screen": "PATIENT_PROFILE" }
```

```json
{
  "sessionId": "uuid",
  "consentRequired": true,
  "greeting": "¡Hola! Soy Nuti. ¿Buscamos un paciente...?",
  "expiresAt": "2026-11-01T10:00:00Z",
  "subjectUserId": "uuid-del-paciente"
}
```

`subjectUserId` tiene que ser un paciente visible para el nutricionista. Si se omite,
el asistente arranca sin paciente activo y resuelve tareas generales; el paciente se
fija después con `set_active_patient`.

### 2.1 Retomar la conversación

`POST /sessions` **ya reutiliza** la sesión activa no caducada del mismo usuario y
paciente, así que no crea una nueva cada vez. Para repintar el hilo sin abrir sesión:

```http
GET /api/tenant/{tenantId}/assistant/sessions/latest?subjectUserId=…
```

Devuelve el mismo `AssistantSessionDto`, o **`404`** si no hay ninguna viva. Con
`GET /sessions/{id}/messages` se recompone la conversación.

---

## 3. Enviar mensaje

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages
Content-Type: application/json

{ "content": "Vamos a la ficha del paciente Ana García" }
```

```json
{
  "assistantMessage": { "...": "..." },
  "pendingAction": null,
  "uiActions": [
    { "type": "NAVIGATE", "screen": "PATIENT_PROFILE", "params": { "patientId": "uuid" } }
  ]
}
```

### 3.1 En streaming (SSE)

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages/stream
Accept: text/event-stream
Content-Type: application/json

{ "content": "Cambia la cita de Ana al jueves a las 10" }
```

El cuerpo es **el mismo** que el del endpoint bloqueante, adjunto incluido:

```json
{ "content": "¿Me pasas estos valores a la ficha?", "attachmentId": "uuid" }
```

`attachmentId` es opcional y se omite cuando no hay adjunto. Los dos endpoints
entran en el mismo método de servicio, así que **el turno con adjunto se manda
por streaming como cualquier otro**: no hay que invertir la regla ni caer al
bloqueante, que es justo el turno en el que más se notaría perder los `delta`.
El adjunto se sube antes (ver `mascota-frontend.md` §4.3).

| `event` | `data` | Cuándo |
|---|---|---|
| `delta` | `{ "text": "trozo de texto" }` | N veces, según va generando |
| `tool` | `{ "name": "search_patients" }` | Al invocar una tool |
| `done` | `AssistantTurnResponse` completo | Una vez, al final |
| `error` | `{ "error": "...", "code": "error.…" }` | Si falla a mitad |

- El evento `done` trae **el mismo objeto** que el endpoint no-streaming, así que la
  lógica de `uiActions` y de relleno de formularios se reutiliza tal cual.
- Los `delta` solo llevan el texto que la mascota debe decir. Una vuelta que acaba
  llamando a una tool corta sus deltas ahí: lo que se pinta es el preámbulo ("voy a
  buscar a Ana…") y después llega el evento `tool`. **Lo pintado coincide siempre con
  el texto que trae `done`.**
- `code` usa los mismos valores que el endpoint bloqueante
  (`error.assistant_session_closed`, `error.assistant_consent_required`,
  `error.assistant_unavailable`…).
- **Los errores del stream no son códigos HTTP.** La respuesta HTTP ya se envió
  con `200` cuando el stream se abrió, así que lo que en el bloqueante sería un
  `404` llega aquí como evento `error` con ese mismo `code`. Un `attachmentId`
  inexistente, de otra sesión o de otro tenant da los tres el mismo
  `error.assistant_attachment_not_found` —a propósito: no se distingue "no
  existe" de "no es tuyo"—, igual que el bloqueante responde `404` en los tres
  casos. Un único camino de error, con el `code` como discriminante.
- **El endpoint bloqueante se queda** como camino de respaldo si el stream se corta.

---

## 3.2 Herramientas que ejecuta el navegador

> **Estado:** fases B0 a B3 implementadas. El transporte, el contexto, las
> confirmaciones y el historial están cerrados; el catálogo concreto de `fill_`,
> `save_`, `ask_user` y compañía lo define el frontend (ver el plan en
> `doc/roadmap/plan-mascota-copiloto/`).

Hasta ahora el modelo mandaba `uiActions` y no se enteraba de nada: si el campo existía,
si el formulario aceptó el valor o si alguien guardó. Con las herramientas de cliente, el
navegador **declara lo que sabe hacer en la pantalla actual**, el modelo las llama y
recibe su resultado dentro del mismo turno.

```text
Angular                       Backend                          Gemini
POST .../messages/stream  ──►  prompt + tools de servidor
  { content, clientTools }     + clientTools del navegador  ──►  function_call
                          ◄──  event: client_tool                fill_patient_profile
                               (el turno queda SUSPENDIDO)
ejecuta en el DOM
POST .../runs/{runId}/tool-results ►  reanuda  ────────────────►  sigue
                          ◄──  delta… / client_tool… / done
```

### Declarar el catálogo

Solo lo acepta el endpoint **de streaming**: es el único con un canal abierto por el que
mandar una llamada y esperar la respuesta. El bloqueante ignora `clientTools`.

```json
{
  "content": "Apunta 70 kg en la ficha de Ana",
  "clientTools": [
    {
      "name": "fill_patient_profile",
      "description": "Rellena la ficha del paciente abierta en pantalla",
      "parameters": {
        "type": "object",
        "properties": {
          "peso": { "type": "number", "description": "Peso en kg" },
          "sexo": { "type": "string", "enum": ["M", "F"] }
        },
        "required": ["peso"]
      }
    }
  ]
}
```

El catálogo se manda **en cada turno**, porque depende de la pantalla. Lo que no cumpla
el contrato se descarta en silencio: la herramienta simplemente no se le ofrece al
modelo, sin error ni aviso.

| Regla | Valor |
|---|---|
| Nombres permitidos | prefijos `fill_`, `edit_`, `open_`, `save_`, `action_`; y `point_at`, `show_around`, `press`, `ask_user`, `navigate` |
| Forma del nombre | `^[a-z][a-z0-9_]{2,48}$` |
| Herramientas por turno | 40 |
| Esquema (JSON serializado) | 2 KB |
| `description` | 300 caracteres, en una sola línea |
| Anidamiento del esquema | 3 niveles |
| Propiedades por objeto | 60 |
| Tipos del esquema | `object`, `string`, `number`, `integer`, `boolean`, `array`, más `enum`, `items`, `required` y `description` |

También se descarta una herramienta que **se llame igual que una de servidor**: si
coinciden, manda la de servidor.

> `echo` está en la lista blanca como sonda del contrato: devuelve lo que se le pasa y
> sirve para comprobar el viaje de ida y vuelta sin montar media pantalla.

### El evento `client_tool`

```text
event: client_tool
data: {"runId":"uuid","callId":"uuid","name":"fill_patient_profile","args":{"peso":70}}
```

Al recibirlo, el turno **queda suspendido**: no llegará ningún `delta` más hasta que se
conteste. Mientras tanto el backend manda `ping` cada 20 s para que ningún proxy dé la
conexión por muerta.

### Devolver el resultado

```http
POST /api/tenant/{tenantId}/assistant/runs/{runId}/tool-results
Content-Type: application/json

{ "callId": "uuid", "result": { "ok": true, "written": ["peso"], "rejected": [] } }
```

- Responde `202` y **no devuelve nada**: la continuación viaja por el SSE ya abierto.
- Responde `204` si el turno ya no espera esa llamada (respuesta duplicada, o la de un
  paso anterior que llegó tarde). No es un error, pero ese resultado no se usa.
- Responde `404` si el `runId` no existe, expiró o **es de otra persona**. Es a
  propósito: un `403` confirmaría que ese identificador es real.
- El contenido de `result` lo decide el frontend. Por convenio lleva `ok` y, si algo
  falló, `reason`. Se recorta a partir de 16 KB.
- El `POST` puede entrar por **cualquier nodo** del backend, no hace falta afinidad de
  sesión con el que tiene el SSE abierto.

### Plazos

| Herramienta | Plazo |
|---|---|
| Mecánicas (`fill_`, `edit_`, `open_`, `navigate`, `point_at`, `show_around`) | 60 s |
| Las que esperan a una persona (`ask_user`, `press`, `save_`) | 15 min |
| Turno completo, esperas incluidas | 20 min |

El plazo lo decide el backend por el nombre de la herramienta; el cliente no puede
pedirlo. Si vence, el modelo recibe `{"ok": false, "reason": "tool_timeout"}` y **el
turno sigue**: lo explica o intenta otra cosa. No es un error del stream.

### Detener el turno

```http
DELETE /api/tenant/{tenantId}/assistant/runs/{runId}
```

Responde `204`. El turno se corta en la siguiente frontera —no hace falta que esté
suspendido— y llega un evento `stopped` con `{ "runId": "uuid" }` en lugar de `done`.
Lo ya escrito se queda escrito, y los tokens gastados cuentan para la cuota.

Cerrar el SSE por las bravas tiene el mismo efecto: el backend lo detecta por el latido
y suelta el turno.

### Qué hay en pantalla (`pageContext`)

Sin esto el modelo puede llamar a `edit_appointment_notes`, pero no sabe qué pone ahora
mismo en esas notas: tendría que reescribir el campo entero a ciegas en vez de cambiar
una frase.

```json
{
  "content": "Cambia la frase de la analítica por 'trae la de abril'",
  "pageContext": {
    "route": "/pacientes/123/citas/9",
    "title": "Cita de Ana García",
    "forms": [
      {
        "id": "appointment",
        "title": "Datos de la cita",
        "values": { "notas": "Trae analítica de marzo.", "tipo": null }
      }
    ],
    "extras": { "diaSeleccionado": "2026-11-10" }
  }
}
```

- `forms[].id` es **el mismo identificador** que usa `fill_<id>` / `save_<id>`.
- Un valor ausente o `null` se le presenta al modelo como `(vacío)`.
- Llega como **mensaje de usuario delimitado**, nunca dentro del prompt del sistema: ahí
  dentro hay notas y observaciones que escribió una persona.

**Presupuesto: 22 000 caracteres.** Cuando no cabe, se recorta en este orden:

1. Primero los `extras`.
2. Después, si aún no cabe, los `forms` — con tope duro, aunque son lo último que se
   toca porque `edit_` necesita copiar fragmentos literales.

Un valor suelto de más de 4 000 caracteres se corta con `…(cortado)`. Si algo se
recortó, el bloque lo dice y el modelo tiene instrucciones de preguntar en vez de
suponer.

### Cambiar de pantalla a mitad de turno

Cuando una herramienta cambia de pantalla (`navigate`), el catálogo declarado al empezar
el turno deja de valer: esos formularios ya no están. El navegador devuelve los de la
pantalla nueva **en el propio resultado**:

```json
{
  "ok": true,
  "route": "/pacientes/123/mediciones",
  "clientTools": [
    { "name": "fill_measurement", "description": "...", "parameters": { "type": "object" } }
  ]
}
```

Se revalidan con las mismas reglas: venir dentro de un resultado no los hace de fiar.

### Presupuesto y bucles

- **30 pasos de cliente** por petición, aparte de las vueltas de tools de servidor. Al
  agotarse, el modelo recibe `step_budget_exhausted` y debe cerrar hablando.
- **La misma herramienta con los mismos argumentos tres veces seguidas corta el turno**
  (`repeated_call`). Un modelo pequeño en una cadena larga se atasca repitiendo, y
  esperar a que se agote el contador sale caro y deja a la persona mirando cómo no pasa
  nada. Cambiar un solo argumento basta para que no cuente como bucle.

### Cuota

El límite diario pasó a medirse en **tokens**, no solo en turnos, porque un turno de
treinta pasos puede costar dos órdenes de magnitud más que uno de los de antes. Los dos
límites siguen vigentes y cualquiera de ellos devuelve `429` con
`error.assistant_quota_exceeded`.

### `confirm_action`: la tarjeta, sin cortar el turno

Esta herramienta **no se declara**: la emite el backend cuando el modelo propone una
escritura de servidor. El navegador solo tiene que saber pintarla y contestar.

```text
event: client_tool
data: {
  "runId": "uuid", "callId": "uuid", "name": "confirm_action",
  "args": {
    "actionId": "uuid",
    "toolName": "create_measurement",
    "summary": "Registrar 70 kg",
    "question": "¿Quieres que lo registre?",
    "idempotencyKey": "key-1",
    "expiresAt": "2026-11-07T12:15:00Z",
    "preview": [ { "label": "Peso", "value": "70 kg" } ]
  }
}
```

Se contesta como cualquier otra herramienta de cliente:

```json
{ "callId": "uuid", "result": { "confirmed": true } }
```

Qué pasa después, y qué lee el modelo:

| Respuesta | Qué hace el backend | Qué lee el modelo |
|---|---|---|
| `{"confirmed": true}` | Aplica la acción | `{ok: true, status, entityType, entityId, message}` |
| `{"confirmed": false}` | La marca rechazada | `{ok: false, reason: "declined"}` |
| Nadie contesta en 15 min | **Nada**: ni aplica ni descarta | `{ok: false, reason: "no_answer"}` |
| La acción ya caducó | Nada | `{ok: false, reason: "ASSISTANT_ACTION_EXPIRED"}` |

**El turno no se corta en ninguno de esos casos.** El modelo lee el desenlace y sigue, que
es lo que permite encadenar «crea la cita y anota que trae analítica» sin volver a empezar.

Si nadie contesta, la propuesta **sigue viva** con su propio plazo: se puede confirmar
después aunque el turno haya terminado.

> `POST /actions/{id}/confirm` y `/reject` siguen existiendo sin cambios, y además
> **despiertan al turno** que estuviera esperando. Confirmar desde otra pestaña, desde la
> app móvil o desde la tarjeta de siempre funciona igual; la respuesta llega con
> `"answeredBy": "card"`. El endpoint bloqueante (`/messages`, sin SSE) conserva el
> comportamiento de antes: devuelve `pendingAction` y termina el turno.

### Qué queda en el historial

No todos los pasos se guardan, y los que se guardan no llevan valores.

| Herramienta | ¿Deja fila en el historial? |
|---|---|
| `fill_`, `edit_`, `save_`, `action_`, `press` | Sí |
| `point_at`, `show_around`, `navigate`, `open_`, `ask_user` | No |

De cada fila se conservan el desenlace (`ok`, `reason`, `saved`) y los **nombres** de los
campos (`written`, `rejected`, `missing_required`), nunca lo que se escribió en ellos: el
peso o la anamnesis ya están guardados donde les toca, y repetirlos aquí sería una
segunda copia de datos clínicos.

A partir de **10 filas por turno**, el resto se agrega en una sola con el nombre
`client_steps_summary` y la forma `{steps, tools, outcomes}`.

### Un turno que quedó colgado

Si alguien recarga la página con la mascota trabajando, el SSE se corta y ese turno se
queda esperando una respuesta que ya no va a llegar — ocupando un hilo hasta que venza su
plazo. Al retomar la conversación:

```http
GET /api/tenant/{tenantId}/assistant/sessions/latest
```

```json
{ "sessionId": "uuid", "consentRequired": false, "pendingRunId": "uuid" }
```

`pendingRunId` solo aparece cuando hay uno vivo. **Hay que detenerlo** con
`DELETE /assistant/runs/{runId}` antes de mandar un mensaje nuevo. Reconectar el SSE a un
turno en curso no está soportado.

### Marcar las escrituras de la mascota

Cuando una herramienta de cliente provoque una petición de escritura (`POST`, `PUT`,
`PATCH`, `DELETE`), hay que añadirle:

```http
X-Assistant-Write: <sessionId>
```

No es un control de seguridad: el backend no cambia nada en función de ella y una
cabecera mal formada se ignora sin romper la petición. Es lo que deja rastro de que ese
cambio lo originó la mascota, porque por lo demás la petición es idéntica a la que haría
una persona a mano.

---

## 4. Acciones de UI (`uiActions`)

```json
{ "type": "NAVIGATE",    "screen": "PATIENT_MENU", "params": { "patientId": "uuid" } }
{ "type": "OPEN_DIALOG", "target": "measurement",  "params": { "patientId": "uuid" } }
{ "type": "HIGHLIGHT",   "target": "waistCm" }
{ "type": "TOAST",       "params": { "severity": "success", "message": "Menú creado" } }
```

El DTO es `{ type, screen?, target?, params }`; los campos nulos no se serializan.
**Cualquier `type`, `screen` o `target` desconocido debe ignorarse en silencio**, para
poder seguir añadiendo sin romper versiones viejas.

### Pantallas (`screen`)

| `screen` | Destino | `params` |
|---|---|---|
| `PATIENTS` | Listado de pacientes | `query` (opcional) |
| `AGENDA` | Agenda del nutricionista | — |
| `DASHBOARD` | Panel principal | — |
| `PATIENT_PROFILE` | Ficha del paciente | `patientId` |
| `PATIENT_MENU` | Menú del paciente | `patientId` |
| `PATIENT_MEASUREMENTS` | Mediciones del paciente | `patientId` |
| `PATIENT_APPOINTMENTS` | Citas del paciente | `patientId` |
| `MENUS` | Listado de menús | `query` (opcional) |
| `SHOPPING_LIST` | Lista de la compra | `patientId` |
| `EVOLUTION` | Evolución del paciente | `patientId` |
| `REVENUE` | Ingresos | — |
| `STAFF` | Personal del centro | — |
| `SETTINGS` | Ajustes del centro | — |
| `SETTINGS_SCHEDULES` | Ajustes → Horarios → Jornadas | — |
| `SETTINGS_ASSIGNMENTS` | Ajustes → Horarios → Asignaciones | — |
| `SETTINGS_HOLIDAYS` | Ajustes → Horarios → Festivos | — |
| `SETTINGS_BRANDING` | Ajustes → Marca | — |
| `PROFILE`, `ANAMNESIS`, `MEASUREMENTS`, `MENU`, `APPOINTMENTS`, `DIARY` | Pantallas heredadas | — |

### Formularios (`target` de `OPEN_DIALOG`)

`measurement`, `appointment`, `schedule`, `schedule-assignment`, `holiday`.
Los dos primeros llevan `params.patientId`; los otros tres son del centro y no llevan
paciente.

---

## 5. Acciones pendientes (escrituras)

```http
POST /api/tenant/{tenantId}/assistant/pending-actions/{actionId}/confirm
Content-Type: application/json

{ "idempotencyKey": "..." }
```

La respuesta puede traer ahora `uiActions`, con la misma forma que la de un mensaje:

```json
{
  "status": "APPLIED",
  "entityType": "SCHEDULE",
  "entityId": "uuid",
  "message": "Jornada \"Horario de invierno\" creada.",
  "uiActions": [
    { "type": "NAVIGATE", "screen": "SETTINGS_SCHEDULES" },
    { "type": "TOAST", "params": { "severity": "success", "message": "Jornada creada" } }
  ]
}
```

Campo opcional: si no viene, todo sigue como antes. **`status` es `"APPLIED"`**, no
`"CONFIRMED"`.

### 5.1 Tools de escritura

**Paciente** (se comprueba que el paciente siga siendo visible al confirmar):
`update_profile`, `update_anamnesis`, `create_measurement`, `update_measurement`,
`reschedule_appointment`, `create_appointment`, `update_appointment_status`,
`create_menu_from_template`, `create_menu_from_description`, `update_clinical_status`,
`create_patient_event`, `assign_nutritionist`, `rename_menu`, `update_meal`,
`generate_shopping_list`.

**Centro** (no tienen paciente; se validan con el permiso de tenant):
`create_schedule`, `update_schedule`, `assign_schedule`, `create_holiday`,
`import_holidays`, `create_calendar_note`, `create_appointment_type`,
`update_appointment_type`, `update_tenant_profile`.

`set_active_patient` es inmediata y no requiere confirmación.

---

## 6. Campos del `preview`

Si el formulario está en pantalla —o la mascota sabe abrirlo— no se enseña la tarjeta
de confirmar: la mascota navega, abre el diálogo y lo rellena. Para eso el `preview`
nombra los campos así. **Todos los valores van como texto.**

### Horarios del centro

| Tool | `preview[].field` |
|---|---|
| `create_schedule` / `update_schedule` | `name`, `color`, `details[i].dayOfWeek`, `details[i].startTime`, `details[i].endTime` |
| `assign_schedule` | `scheduleId`, `validFrom`, `validTo` |
| `create_holiday` | **`holidayDate`**, `description`, `type` |
| `import_holidays` | *(sin formulario: se queda en la tarjeta)* |

- Los índices se **renumeran desde 0** en el orden en que llegan. **Tope de 14 tramos.**
- `dayOfWeek` llega como **nombre del día** (`"Lunes"`); también se acepta el número ISO.
- `scheduleId` llega como **nombre de la jornada**; `type` como `NATIONAL`/`LOCAL`.
- `assign_schedule` **no lleva `year`**: se deduce de `validFrom`. Sin `validTo`, la
  asignación queda indefinida.

### Citas

| `field` | Formato |
|---|---|
| `patientId` | **nombre** del paciente |
| `nutritionistId` | **nombre** del profesional |
| `typeId` | **etiqueta** del tipo de cita |
| `date` | `YYYY-MM-DD` |
| `time` | `HH:mm` |
| `notes` | texto libre |

Fecha y hora van **separadas**. El payload interno sigue llevando `startTime` en
ISO-8601, pero eso no sale en el `preview`.

### Mediciones — `create_measurement` y `update_measurement`

Mismos nombres en las dos, porque es el mismo formulario. Todos numéricos salvo `notes`.

| Grupo | `field` |
|---|---|
| Composición | `weightKg`, `heightCm`, `bodyFatPct`, `muscleMassPct`, `bodyWaterPct`, `visceralFatLevel`, `boneMassKg` |
| Perímetros | `waistCm`, `chestCm`, `hipsCm`, `contourCm`, `armCm`, `wristCircumferenceCm` |
| Segmentos | `trunkFatPct`, `trunkMassKg`, `rightArmFatPct`, `rightArmMassKg`, `leftArmFatPct`, `leftArmMassKg`, `rightLegFatPct`, `rightLegMassKg`, `leftLegFatPct`, `leftLegMassKg` |
| Libre | `notes` |

`update_measurement` lleva además `measurementId` en el payload (no en el `preview`).

### Anamnesis — `update_anamnesis`

Texto libre: `consultationReason`, `allergiesIntolerances`, `foodPreferences`,
`habits`, `lifestyle`, `exercise`, `observations`.

Dieciocho antecedentes, cada uno con su interruptor y sus notas:

| Interruptor | Notas |
|---|---|
| `hasDiabetes` | `diabetesNotes` |
| `hasHypertension` | `hypertensionNotes` |
| `hasHeartDisease` | `heartDiseaseNotes` |
| `hasCholesterol` | `cholesterolNotes` |
| `hasAllergiesAsthma` | `allergiesAsthmaNotes` |
| `hasLiverDisease` | `liverDiseaseNotes` |
| `hasGallbladderDisease` | `gallbladderDiseaseNotes` |
| `hasKidneyDisease` | `kidneyDiseaseNotes` |
| `hasStomachDisease` | `stomachDiseaseNotes` |
| `hasUricAcidGout` | `uricAcidGoutNotes` |
| `hasCirculationIssues` | `circulationIssuesNotes` |
| `hasThyroidIssues` | `thyroidIssuesNotes` |
| `hasAnemia` | `anemiaNotes` |
| `hasConstipation` | `constipationNotes` |
| `hasMusculoskeletalIssues` | `musculoskeletalIssuesNotes` |
| `hasSurgeries` | `surgeriesNotes` |
| `hasMenstrualCycleIssues` | `menstrualCycleIssuesNotes` |
| `hasSleepIssues` | `sleepIssuesNotes` |

El modelo puede mandar los booleanos como texto (`"sí"`, `"true"`, `"1"`, `"yes"`…);
el backend los normaliza y el `preview` los emite ya como **`"Sí"` / `"No"`**.

### Resto

| Tool | `preview[].field` |
|---|---|
| `update_profile` | `firstName`, `lastName`, `phone`, `birthDate`, `heightCm`, `gender` |
| `update_tenant_profile` | `name`, `cif`, `address`, `phone`, `countryCode`, `stateCode`, `city` |
| `create_appointment_type` / `update_appointment_type` | `name`, `durationMinutes`, `price`, `isDefault`, `isActive` |
| `create_calendar_note` | `title`, `date`, `startTime`, `endTime`, `type`, `description` |
| `update_clinical_status` | `clinicalStatus`, `reason` |
| `create_patient_event` | `title`, `description`, `startTime` |
| `assign_nutritionist` | `nutritionistId` |
| `create_menu_from_template` | `patientId`, `templateId`, `name`, `isActive` |
| `rename_menu` | `name` |
| `update_meal` | `description`, `dayOfWeek`, `mealType`, `items[i].foodId`, `items[i].quantityG`, `items[i].notes` |
| `generate_shopping_list` | `menuId`, `supermarket` |

---

## 7. Catálogo de tools

### Pacientes y ficha

`search_patients`, `set_active_patient`, `get_patient_summary`, `get_profile`,
`get_missing_fields`, `get_patient_measurements`, `get_latest_measurement`,
`update_profile`, `update_anamnesis`, `create_measurement`, **`update_measurement`**,
**`update_clinical_status`**, **`create_patient_event`**, **`assign_nutritionist`**,
**`get_patients_needing_followup`**.

### Agenda

`get_nutritionist_agenda`, `get_today_overview`, `get_next_patient`,
`get_next_appointment`, `get_upcoming_appointments`, `create_appointment`,
`reschedule_appointment`, `update_appointment_status` (también **cancela**),
**`get_appointment_types`**, **`find_available_slots`**, **`get_agenda_day`**,
**`create_calendar_note`**, **`create_appointment_type`**,
**`update_appointment_type`**.

### Horarios del centro

**`get_schedules`**, **`get_schedule_assignments`**, **`get_holidays`**,
**`get_opening_hours`**, **`create_schedule`**, **`update_schedule`**,
**`assign_schedule`**, **`create_holiday`**, **`import_holidays`**.

`get_opening_hours` devuelve:

```json
{ "date": "2026-12-08", "open": false, "reason": "HOLIDAY",
  "holiday": "Inmaculada Concepción", "blocks": [] }
```

con `reason` en `OPEN | HOLIDAY | CLOSED_DAY | NO_SCHEDULE` y `blocks` como lista de
`{ "startTime": "09:00", "endTime": "14:00" }`.

`find_available_slots` cruza eso con las citas ya puestas y con los bloqueos de
calendario, y devuelve `{ date, startTime, endTime }`. **Solo lee: no reserva nada.**

### Menús y alimentos

`search_foods`, `suggest_food_alternatives`, `get_menu_templates`, `get_patient_menu`,
`get_active_menu_summary`, `create_menu_from_template`, `create_menu_from_description`,
**`rename_menu`**, **`update_meal`**, **`generate_shopping_list`**.

`update_meal` referencia los alimentos **por `foodId`** del catálogo, no por nombre:
el modelo los busca antes con `search_foods`.

### Centro y transversales

`get_tenant_info`, **`get_tenant_profile`**, **`update_tenant_profile`**,
**`get_revenue_summary`**, `navigate_to`, `navigate_to_patient`, **`open_dialog`**,
**`highlight_field`**, **`explain_ui`**.

Temas de `explain_ui` (lista cerrada): `crear-jornada`, `asignar-jornada`,
`importar-festivos`, `crear-cita`, `registrar-medida`, `crear-menu`, `lista-compra`,
`invitar-paciente`. Un tema desconocido devuelve la lista válida en vez de inventarse
una pantalla.

### Permisos

| Permiso | Tools |
|---|---|
| `VIEW_SCHEDULE` o `MANAGE_TENANT` | `get_schedules`, `get_schedule_assignments`, `get_opening_hours` |
| `VIEW_HOLIDAY` o `MANAGE_TENANT` | `get_holidays` |
| `MANAGE_TENANT` | jornadas, festivos, tipos de cita, datos del centro |
| `VIEW_APPOINTMENTS` | `get_appointment_types`, `find_available_slots`, `get_agenda_day` |
| `MANAGE_APPOINTMENTS` | `create_appointment`, `reschedule_appointment`, `update_appointment_status` |
| `MANAGE_CALENDAR_NOTES` | `create_calendar_note` |
| `MANAGE_PATIENT_PROFILE` | perfil, anamnesis, mediciones, estado clínico |
| `MANAGE_PATIENT_EVENTS` | `create_patient_event` |
| `MANAGE_USER` | `assign_nutritionist` |
| `VIEW_USER` | `get_patients_needing_followup` |
| `VIEW_TENANT_BRANDING` o `MANAGE_TENANT` | `get_tenant_profile` |
| `VIEW_REVENUE` | `get_revenue_summary` |
| `VIEW_MENU` / `MANAGE_MENU` / `MANAGE_MEAL` | menús y comidas |

Las tools **validan en servidor** aunque el frontend ya oculte lo que la persona no
puede hacer.

---

## 8. Flujos esperados

| Frase | Comportamiento |
|---|---|
| "Vamos a la ficha de Ana García" | `search_patients` → `set_active_patient` → `NAVIGATE` a `PATIENT_PROFILE` |
| "¿Cuál es el próximo paciente?" | `get_next_patient` o `get_today_overview` |
| "Cambia la cita de Ana al jueves a las 10" | `search_patients` → `get_next_appointment` → `reschedule_appointment` |
| "Cancela la cita de Ana" | `search_patients` → `get_next_appointment` → `update_appointment_status(CANCELLED)` |
| "¿Abrimos el 6 de diciembre?" | `get_opening_hours` |
| "Crea la jornada de invierno: L-V de 9 a 14" | `create_schedule` |
| "Esa jornada rige desde enero" | `get_schedules` → `assign_schedule` |
| "Mete los festivos del año que viene" | `import_holidays` |
| "Búscame un hueco el jueves por la tarde" | `get_appointment_types` → `find_available_slots` |
| "¿A quién tengo descolgado?" | `get_patients_needing_followup` |
| "Pásame los pacientes de Ana a Luis" | `search_patients` → `assign_nutritionist` |
| "¿Cuánto he facturado este mes?" | `get_revenue_summary` |
| "¿Cómo asigno una jornada?" | `explain_ui` (+ `highlight_field`) |

### Una escritura que no se puede preparar no rompe el turno

Si la tool no puede proponer la escritura —argumentos que no cuadran, o configuración
que falta—, el motivo vuelve al modelo y éste lo cuenta o lo arregla, en lugar de que
la petición falle. El caso típico: `import_holidays` sin país configurado responde
*"el centro no tiene país ni región; ¿quiero que los configure?"* y ofrece
`update_tenant_profile`.

---

## 9. Consideraciones para Angular

- Mantener el `subjectUserId` de la sesión sincronizado con la ficha abierta.
- Tras `set_active_patient`, el backend actualiza la sesión; no hay que recrearla.
- Al confirmar una acción, no reutilizar la `idempotencyKey` anterior.
- Ignorar en silencio los `type`, `screen` y `target` desconocidos de `uiActions`.
- Con el stream cortado, reintentar por el endpoint bloqueante.

### Lo que falta en `sif-web`

Estas tools funcionan ya, pero caen en la tarjeta de confirmar hasta que exista su
superficie de relleno: `update_tenant_profile`, `create_appointment_type` /
`update_appointment_type` (las tres con `FieldAccess` a mano, porque van con
`ngModel`), `update_clinical_status`, `create_patient_event`, `assign_nutritionist`
(reactivos, baratos), `create_calendar_note` y `update_meal` (este con filas
repetibles).
