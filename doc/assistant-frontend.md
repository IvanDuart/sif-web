---
id: assistant-contract
type: submodule-design
title: Nutritionist assistant tools contract (Angular)
status: draft
parent: assistant-module
---

# Asistente para nutricionistas — contrato para Angular

> **Estado:** implementadas las peticiones de [`assistant-tools-backend.md`](assistant-tools-backend.md)
> y [`assistant-backend-peticion.md`](assistant-backend-peticion.md).
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
- **El endpoint bloqueante se queda** como camino de respaldo si el stream se corta.

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

### Estado de las superficies en `sif-web`

Ya **rellenan formulario**: `create_measurement` / `update_measurement`,
`create_appointment` / `reschedule_appointment`, `update_profile` / `update_anamnesis`,
`create_schedule` / `update_schedule`, `assign_schedule`, `create_holiday`,
`update_tenant_profile`, `create_appointment_type` / `update_appointment_type`,
`update_clinical_status`, `create_patient_event`, `assign_nutritionist`,
`create_menu_from_template`, `rename_menu`, `create_calendar_note` y `update_meal`.

Siguen cayendo en la tarjeta de confirmar, a propósito:

- `import_holidays` — no tiene formulario.
- `generate_shopping_list` — no tiene formulario propio.
- **`update_meal`, solo sus `items[i].*`.** El resto del formulario (día, tipo,
  descripción) sí se rellena. Los alimentos no se editan en campos sino en
  `menus/components/meal-items-editor`, donde hay que buscar contra el backend y
  elegir de una lista de resultados: es otra mecánica, no la de escribir en un campo.
- **`create_calendar_note`, solo su `type`.** No es un campo del formulario sino la
  elección previa (nota o bloqueo) del diálogo que lo incrusta.
- `update_appointment_type`, solo su `isActive`: desde el diálogo no se desactiva, eso
  se hace desde el listado.
- `rename_menu` y `update_meal` se rellenan **si el diálogo ya está abierto**, pero la
  mascota no sabe abrirlos: el botón es por fila (qué menú, qué comida), así que no hay
  "el" botón que pulsar.

### La propuesta no trae navegación, y la mascota ya no la necesita

El `NAVIGATE` de cada tool se emite en el `apply`, o sea **después** de confirmar
(`AssistantPreparedAction` no tiene campo para `uiActions`). Así que cuando llega la
propuesta, si la persona está en el panel principal, en pantalla no hay ni el
formulario ni el botón que lo abre, y la acción caía siempre en la tarjeta.

Angular ya no depende de eso: sabe en qué pantalla vive el formulario de cada tool
(`mascot/fill/surfaces/routes.ts`) y navega él antes de buscarlo. Si el backend manda
igualmente un `NAVIGATE` con la propuesta, mejor —se ahorra el salto—, pero no hace
falta.

Las tools cuyo formulario está en la ficha de un paciente necesitan saber de quién.
Se mira, por este orden:

1. **`subjectUserId` (o `patientId`) de la propia propuesta**, si viene. Es lo único
   que no se puede quedar viejo. Hoy el backend **no lo serializa** aunque lo tiene:
   `AssistantPreparedAction.getSubjectUserId()` es justo lo que comprueba al
   confirmar. Ver la petición de abajo.
2. El paciente activo que ya conociéramos: el de abrir la sesión, o el
   `params.patientId` de cualquier `uiAction` anterior del turno.
3. **Releyendo la sesión** con `GET /sessions/latest`, y sólo si responde la nuestra
   (`sessionId` igual). `latest` es del usuario, no de la conversación.
4. La ficha que esté abierta.

Sin ninguno no se navega, porque abrir la ficha de quien no es sería peor que no
hacer nada. Y si el paciente de la propuesta **no es** el de la ficha abierta, se
navega a la suya antes de tocar nada: rellenar el formulario que hay delante
guardaría las medidas de uno en la ficha de otro.

> **Por qué hacen falta los pasos 2 y 3.** La sesión se crea sin paciente cuando la
> mascota se abre fuera de una ficha, y es el backend quien lo fija después con
> `set_active_patient` al oír "las medidas de Frink". Esa copia que tiene el frontend
> se queda vieja, y sin releerla la propuesta no se puede llevar a ninguna parte.

#### Petición: que la propuesta diga de quién es

`AssistantPendingActionDto` debería incluir el paciente de la escritura:

```json
{ "id": "…", "toolName": "create_measurement", "subjectUserId": "uuid-del-paciente", "preview": [ … ] }
```

El dato ya existe en `AssistantPreparedAction`; es serializarlo. Con él sobran los
pasos 2 y 3 y la ida a la ficha es inmediata y siempre correcta, también cuando la
conversación salta de un paciente a otro. El frontend ya lo acepta (`subjectUserId` o
`patientId`, lo que llegue) e ignora su ausencia.

`OPEN_DIALOG` ya está implementado, y acepta más `target` de los cinco del contrato:
también `clinical-status`, `patient-event`, `assign-nutritionist`, `menu-template`,
`appointment-type` y `tenant-profile`.
