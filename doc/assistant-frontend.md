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

Todas las acciones de paciente incluyen `params.patientId`.

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

El frontend solo necesita renderizar `pendingAction.preview` y llamar a `confirm` o `reject`.

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
