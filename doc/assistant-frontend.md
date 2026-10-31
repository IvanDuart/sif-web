# Asistente para nutricionistas — contrato para Angular

> **Estado:** backend v1 de la Fase 1 y 2 implementado.
> **Base:** `context-path` `/api`.
> **Autenticación:** `Authorization: Bearer <JWT>`.

---

## 1. Cambios respecto a la versión anterior

- El asistente es **exclusivo para nutricionistas**. Ya no existe el modo paciente.
- `POST /assistant/sessions` acepta `subjectUserId` (paciente activo) u omitirlo para
  abrir una sesión general desde el panel del día.
- La respuesta de sesión ya no incluye `mode`.
- El asistente puede buscar pacientes, abrir fichas, consultar la agenda, reagendar citas,
  registrar mediciones, buscar alimentos, crear menús desde plantilla y generar menús con IA.

---

## 2. Abrir sesión

```http
POST /api/tenant/{tenantId}/assistant/sessions
Content-Type: application/json

{
  "subjectUserId": "uuid-del-paciente",
  "screen": "PATIENT_PROFILE"
}
```

Respuesta:

```json
{
  "sessionId": "uuid",
  "consentRequired": true,
  "greeting": "¡Hola! Soy Nuti. ¿Buscamos un paciente...?",
  "expiresAt": "2026-11-01T10:00:00Z",
  "subjectUserId": "uuid-del-paciente"
}
```

> Si se envía `subjectUserId`, debe ser un paciente visible para el nutricionista. Un
> nutricionista solo puede usar sus pacientes asignados; un administrador puede usar
> cualquiera del tenant. Si se omite, el asistente arranca sin paciente activo y puede
> resolver tareas generales (`get_next_patient`, `get_today_overview`). El paciente se
> fija después con `set_active_patient`.

---

## 3. Enviar mensaje

Sin cambios:

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages
Content-Type: application/json

{ "content": "Vamos a la ficha del paciente Ana García" }
```

Respuesta:

```json
{
  "assistantMessage": { "...": "..." },
  "pendingAction": null,
  "uiActions": [
    {
      "type": "NAVIGATE",
      "screen": "PATIENT_PROFILE",
      "params": { "patientId": "uuid" }
    }
  ]
}
```

---

## 4. Acciones de UI (`uiActions`)

El backend puede devolver estas pantallas en `uiActions[].screen`:

| `screen` | Destino sugerido |
|---|---|
| `PATIENTS` | Listado de pacientes |
| `AGENDA` | Agenda del nutricionista |
| `DASHBOARD` | Panel principal |
| `PATIENT_PROFILE` | Ficha del paciente (`params.patientId`) |
| `PATIENT_MENU` | Menú del paciente (`params.patientId`) |
| `PATIENT_MEASUREMENTS` | Mediciones del paciente (`params.patientId`) |
| `PATIENT_APPOINTMENTS` | Citas del paciente (`params.patientId`) |
| `PROFILE`, `ANAMNESIS`, `MEASUREMENTS`, `MENU`, `APPOINTMENTS`, `DIARY` | Pantallas heredadas |
| `SETTINGS` | Ajustes del centro |
| `SETTINGS_SCHEDULES` | Ajustes → Horarios → Jornadas |
| `SETTINGS_ASSIGNMENTS` | Ajustes → Horarios → Asignaciones |
| `SETTINGS_HOLIDAYS` | Ajustes → Horarios → Festivos |

Todas las acciones de paciente incluyen `params.patientId`.

`PATIENTS` acepta además `params.query`: el listado se abre ya filtrado por ese
texto, que es como se espera que `find_patient` enseñe lo que ha encontrado
cuando hay más de un candidato.

---

## 5. Acciones pendientes (escrituras)

Las escrituras siguen requiriendo confirmación:

```http
POST /api/tenant/{tenantId}/assistant/pending-actions/{actionId}/confirm
Content-Type: application/json

{ "idempotencyKey": "..." }
```

Herramientas de escritura disponibles:

- `update_profile`
- `update_anamnesis`
- `create_measurement`
- `reschedule_appointment`
- `create_appointment`
- `update_appointment_status`
- `create_menu_from_template`
- `create_menu_from_description`
- `set_active_patient` (inmediata, no requiere confirmación)

Configuración del centro (todas con `MANAGE_TENANT`):

- `create_schedule`, `update_schedule`
- `assign_schedule`, `update_schedule_assignment`
- `create_holiday`
- `import_holidays` (sin formulario: se queda en la tarjeta de confirmar)

El frontend solo necesita renderizar `pendingAction.preview` y llamar a `confirm` o `reject`.

### 5.1 Campos del `preview` que la mascota sabe rellenar

Si el formulario correspondiente está en pantalla —o la mascota sabe abrirlo—
no se enseña la tarjeta de confirmar: la mascota navega, abre el diálogo y lo
rellena, y guarda la persona. Para eso el `preview` tiene que nombrar los
campos así:

| Tool | `preview[].field` |
|---|---|
| `create_schedule` / `update_schedule` | `name`, `color`, `details[i].dayOfWeek`, `details[i].startTime`, `details[i].endTime` |
| `assign_schedule` / `update_schedule_assignment` | `scheduleId`, `validFrom`, `validTo` |
| `create_holiday` | `holidayDate`, `description`, `type` |

Notas del contrato:

- **Las filas van indexadas**: `details[0].startTime`. Los índices se renumeran
  desde 0 en el orden en que llegan, así que no hace falta que sean
  consecutivos. Tope de 14 tramos por jornada.
- **Los valores son texto**, como en el resto del contrato. Las horas en
  `HH:mm`, las fechas en `YYYY-MM-DD` (también se acepta `DD/MM/YYYY`), el
  color en hexadecimal y el día de la semana como número ISO (`1` = lunes) o
  como nombre.
- **Los desplegables se nombran por lo que se ve**: `scheduleId` acepta el id o
  el nombre de la jornada, y `type` acepta `NATIONAL`/`LOCAL` o su etiqueta. Si
  el nombre es ambiguo el campo se deja en blanco en vez de adivinar.
- `assign_schedule` **no lleva `year`**: el diálogo lo deduce de `validFrom`.
  Si no se manda `validTo`, la asignación queda indefinida.

---

## 6. Flujos esperados

| Frase | Comportamiento |
|---|---|
| "Vamos a la ficha del paciente Ana García" | `search_patients` → `set_active_patient` → `NAVIGATE` a `PATIENT_PROFILE` |
| "¿Cuál es el próximo paciente?" | `get_next_patient` o `get_today_overview` |
| "¿Cuál es la próxima cita de Ana?" | `search_patients` → `get_next_appointment` |
| "Cambia la cita de Ana al jueves a las 10" | `search_patients` → `get_next_appointment` → `reschedule_appointment` → confirmación |
| "Crea un menú para Ana" | `create_menu_from_description` → confirmación |
| "¿Qué alternativa hay al pollo?" | `suggest_food_alternatives` |

---

## 7. Consideraciones para Angular

- Mantener el `subjectUserId` de la sesión sincronizado con la ficha abierta.
- Tras `set_active_patient`, el backend actualiza la sesión; no es necesario recrearla.
- Si el usuario abre el asistente desde una pantalla sin paciente, enviar `subjectUserId`
  a `null` u omitirlo. El asistente podrá resolver tareas generales y pedirá un paciente
  cuando la operación lo requiera.
- Al confirmar una acción, no reutilizar la `idempotencyKey` anterior.
