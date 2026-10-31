---
layout: page
title: Tools del asistente — guía de implementación backend
---

# Tools del asistente — guía de implementación backend

Contrato que espera Angular para las tools que faltan en `tus-dietas`.

- **Primera parte (§0-§7): horarios del centro.** El frontend ya está hecho y
  verificado: la mascota navega a Ajustes → Horarios, abre los tres
  formularios y los rellena. Solo falta el backend.
- **Segunda parte (§8-§16): el resto del catálogo.** Lo que no existe y merece
  la pena, con lo que costaría cada bloque.

Referencias: [`assistant-frontend.md`](./assistant-frontend.md) §4 y §5.1 (el
contrato de respuesta) y [`appointments/horarios_centros.md`](./appointments/horarios_centros.md)
(los endpoints y permisos del dominio).

---

## 0. Por qué hoy no funciona

Al pedirle crear una jornada, el asistente responde que eso no es cosa suya.
Son dos causas independientes y hay que arreglar las dos:

1. **Las tools no existen** en `AssistantToolRegistry`.
2. **El system prompt le dice que no es su trabajo.** En
   `AssistantConversationService.buildSystemPrompt`:

   > Tu objetivo es ahorrar tiempo en el día a día: buscar pacientes, abrir
   > fichas, consultar tu agenda, revisar medidas, crear menús, buscar
   > alimentos y alternativas, y gestionar citas.

   Con esa frase, aunque se registren las tools el modelo seguirá dudando.

> **`find_patient` no hay que hacerlo.** Ya existe como `search_patients`
> (`query` + `limit`), y el prompt ya le dice que pregunte cuál si hay varios.
> Lo único nuevo en el frontend es que `navigate_to(PATIENTS)` ahora acepta
> `params.query` y abre el listado filtrado por ese texto: útil para enseñar el
> resultado cuando hay más de un candidato.

---

## 1. System prompt

Ampliar el objetivo y añadir una regla y un flujo. Propuesta:

```
Tu objetivo es ahorrar tiempo en el día a día: buscar pacientes, abrir fichas,
consultar tu agenda, revisar medidas, crear menús, buscar alimentos y
alternativas, gestionar citas y configurar los horarios del centro
(jornadas, asignaciones y festivos).
```

Reglas a añadir:

```
- Para saber si el centro abre un día concreto, usa get_opening_hours antes de
  proponer nada: tiene en cuenta la jornada vigente y los festivos.
- Las jornadas, asignaciones y festivos son configuración del centro, no de un
  paciente: no necesitas paciente activo para tocarlos.
```

Flujos a añadir:

```
- "¿Abrimos el 6 de diciembre?": get_opening_hours(date).
- "Crea la jornada de invierno: L-V de 9 a 14": create_schedule.
- "Esa jornada rige desde enero": get_schedules -> assign_schedule.
- "Mete los festivos del año que viene": import_holidays(year).
```

---

## 2. Tools de lectura

Firma como el resto del registro:
`function(nombre, descripción, object(Map.of(...), List.of(requeridos)))`.

| Tool | Argumentos | Devuelve | Permiso |
|---|---|---|---|
| `get_schedules` | — | Jornadas activas con sus tramos | `VIEW_TENANT` |
| `get_schedule_assignments` | `year` (opcional) | Qué jornada rige en cada periodo | `VIEW_TENANT` |
| `get_holidays` | `year`, `from`, `to` (opcionales) | Festivos del centro | `VIEW_TENANT` |
| `get_opening_hours` | `date` (requerido, `YYYY-MM-DD`) | Si abre ese día y en qué tramos | `VIEW_TENANT` |

`get_opening_hours` es la que más rinde: resuelve de una vez la asignación
vigente, la jornada y el festivo, y es la que debería consultar el modelo antes
de proponer un hueco de cita. Devolver algo como:

```json
{ "date": "2026-12-08", "open": false, "reason": "HOLIDAY",
  "holiday": "Inmaculada Concepción", "blocks": [] }
```

con `reason` en `OPEN | HOLIDAY | CLOSED_DAY | NO_SCHEDULE`, y `blocks` como
lista de `{ "startTime": "09:00", "endTime": "14:00" }`.

Como el resto de tools de lectura: se ejecutan en el bucle y se realimentan al
modelo, y devuelven solo campos de la whitelist.

---

## 3. Tools de escritura

Todas con **`MANAGE_TENANT`**, todas devuelven `AssistantPreparedAction` (no
escriben), todas hay que añadirlas al `Set<String> WRITE_TOOLS`.

| Tool | Argumentos |
|---|---|
| `create_schedule` | `name` (req), `color`, `details[]` (req) |
| `update_schedule` | `scheduleId` (req), `name`, `color`, `details[]` |
| `assign_schedule` | `scheduleId` (req), `validFrom` (req), `validTo` |
| `create_holiday` | `date` (req), `description` (req), `type` |
| `import_holidays` | `year` (req) |

`details[]` es una lista de objetos `{ dayOfWeek, startTime, endTime }`, con
`dayOfWeek` como número ISO (1 = lunes) y las horas en `HH:mm`.

El borrado se deja fuera a propósito: borrar una jornada asignada rompe la
validación de citas ya creadas y la tarjeta de confirmar no puede enseñar ese
impacto.

### 3.1 El `preview`: cómo se nombran los campos

Esto es lo que hace que la mascota **rellene el formulario** en vez de enseñar
la tarjeta de confirmar. Si los nombres no son exactamente estos, la acción
cae en la tarjeta (que sigue funcionando, pero es la experiencia vieja).

| Tool | `preview[].field` |
|---|---|
| `create_schedule` / `update_schedule` | `name`, `color`, `details[i].dayOfWeek`, `details[i].startTime`, `details[i].endTime` |
| `assign_schedule` | `scheduleId`, `validFrom`, `validTo` |
| `create_holiday` | `holidayDate`, `description`, `type` |
| `import_holidays` | *(sin formulario: se queda en la tarjeta)* |

Con el helper `item(field, label, value)` que ya usan las demás, una jornada
de dos tramos sale así:

```java
List<Map<String, Object>> items = new ArrayList<>();
items.add(item("name", "Nombre", name));
items.add(item("color", "Color", color));
for (int i = 0; i < details.size(); i++) {
    ScheduleDetail d = details.get(i);
    items.add(item("details[" + i + "].dayOfWeek", "Día", dayName(d.dayOfWeek())));
    items.add(item("details[" + i + "].startTime", "Inicio", d.startTime()));
    items.add(item("details[" + i + "].endTime", "Fin", d.endTime()));
}
```

Detalles del formato, todos ya probados contra el frontend:

- **Los valores van como texto**, como en el resto del contrato. Horas en
  `HH:mm`, fechas en `YYYY-MM-DD` (también se acepta `DD/MM/YYYY`), color en
  hexadecimal.
- **Los índices se renumeran desde 0** en el orden en que llegan, así que no
  hace falta que sean consecutivos. Tope de 14 tramos.
- **Los desplegables se nombran por lo que se ve.** `scheduleId` acepta el id
  *o* el nombre de la jornada; `type` acepta `NATIONAL`/`LOCAL` *o* su
  etiqueta; `dayOfWeek` acepta el número *o* el nombre del día. Si el nombre es
  ambiguo el campo se deja en blanco en vez de adivinar.
- **`assign_schedule` no lleva `year`**: el diálogo lo deduce de `validFrom`.
  Sin `validTo`, la asignación queda indefinida.

---

## 4. Navegación

Añadir al `Set<String> ALLOWED_SCREENS` y a la descripción de `navigate_to`:

```
SETTINGS, SETTINGS_SCHEDULES, SETTINGS_ASSIGNMENTS, SETTINGS_HOLIDAYS
```

Angular ya las traduce a `/settings?tab=schedules&section=...`. No hacen falta
`params`.

En la práctica no hay que llamar a `navigate_to` para las escrituras: la
mascota navega sola al atender el `pendingAction`. Sirve para cuando el usuario
solo quiere *ver* la configuración ("enséñame los festivos").

---

## 5. El aplicador, y una mina

En `AssistantActionService.confirm()`, antes de aplicar:

```java
patientScope.requireVisible(tenantId, actor.getId(), action.getSubjectUserId());
```

Y en `AssistantPatientScope.canView()`:

```java
if (patientId == null) {
    return false;
}
```

**Una acción de configuración del centro no tiene paciente**, así que
`subjectUserId` es `null` y ese guardia lanza `ForbiddenException`: todas estas
tools darían 403 al confirmar, con pinta de bug de permisos. Hay que saltarse
la comprobación cuando la acción no es de paciente — por ejemplo marcando las
tools de centro en un `Set<String> TENANT_SCOPED_TOOLS` y haciendo la llamada
condicional:

```java
if (!toolRegistry.isTenantScoped(action.getToolName())) {
    patientScope.requireVisible(tenantId, actor.getId(), action.getSubjectUserId());
}
```

El resto del aplicador es el patrón de siempre: leer el `payload`, llamar al
servicio de dominio (`ScheduleService`, `HolidayService`) y devolver
`entityType` / `entityId` para la auditoría.

---

## 6. Endpoints de dominio a los que llaman

De [`horarios_centros.md`](./appointments/horarios_centros.md), todos bajo
`/api/tenant/{tenantId}`:

| Tool | Endpoint |
|---|---|
| `get_schedules` | `GET /schedules` |
| `get_schedule_assignments` | `GET /schedules/assignments` |
| `get_holidays` | `GET /holidays` |
| `create_schedule` | `POST /schedules` |
| `update_schedule` | `PUT /schedules/{scheduleId}` |
| `assign_schedule` | `POST /schedules/assignments` |
| `create_holiday` | `POST /holidays` |
| `import_holidays` | `POST /holidays/load-from-nager/{year}` |

`import_holidays` necesita que el centro tenga `countryCode` y `stateCode` en
su perfil. Si faltan, la tool debería decirlo con un mensaje útil en vez de
fallar: es la pista para que el modelo ofrezca configurarlos.

---

## 7. Cómo probarlo sin tocar Angular

El frontend está verificado contra la app real fabricando el `pendingAction`.
Para comprobar que el backend manda el `preview` bien, basta con que la
respuesta de `POST /assistant/sessions/{id}/messages` tenga esta forma:

```json
{
  "assistantMessage": { "role": "ASSISTANT", "content": "Te creo la jornada." },
  "pendingAction": {
    "id": "…", "toolName": "create_schedule",
    "summary": "Crear la jornada \"Horario de invierno\"",
    "idempotencyKey": "…", "expiresAt": "…",
    "preview": [
      { "field": "name", "value": "Horario de invierno" },
      { "field": "color", "value": "#1A7F5A" },
      { "field": "details[0].dayOfWeek", "value": "Lunes" },
      { "field": "details[0].startTime", "value": "09:00" },
      { "field": "details[0].endTime", "value": "14:00" }
    ]
  },
  "uiActions": [{ "type": "NAVIGATE", "screen": "SETTINGS_SCHEDULES" }]
}
```

Si al mandar eso la mascota navega a Ajustes, abre "Nueva Jornada" y escribe
los campos, el contrato está bien.

---
---

# Segunda parte: el resto del catálogo

Lo de arriba es el bloque de horarios, que ya tiene el frontend hecho. Esto es
lo demás que falta y que merece la pena, para implementarlo de una vez en
lugar de a cuentagotas.

El catálogo actual tiene **28 tools**. Lo que sigue son las que no están,
agrupadas por lo que cuestan y por lo que dan. Cada bloque dice si el
formulario que rellenaría ya existe en Angular, porque eso decide la
experiencia: con formulario, la mascota navega y escribe; sin él, se queda en
la tarjeta de confirmar (que funciona, pero es la experiencia vieja).

> **Lo que ya existe, para no duplicarlo.** `search_patients`,
> `set_active_patient`, `get_patient_summary`, `get_nutritionist_agenda`,
> `get_today_overview`, `get_next_patient`, `get_next_appointment`,
> `get_patient_measurements`, `search_foods`, `suggest_food_alternatives`,
> `get_menu_templates`, `get_patient_menu`, `reschedule_appointment`,
> `create_appointment`, `update_appointment_status`,
> `create_menu_from_template`, `create_menu_from_description`, `get_profile`,
> `get_missing_fields`, `get_latest_measurement`, `get_upcoming_appointments`,
> `get_active_menu_summary`, `get_tenant_info`, `update_profile`,
> `update_anamnesis`, `create_measurement`, `navigate_to_patient`,
> `navigate_to`.

---

## 8. Un hueco que ya está abierto: `update_measurement`

El frontend **ya declara** esta tool: la superficie de medidas responde a
`['create_measurement', 'update_measurement']`. El backend solo tiene la
primera. Es decir, hoy la mascota sabe rellenar una corrección de medidas pero
nadie se la pide nunca.

| Tool | Argumentos | Permiso |
|---|---|---|
| `update_measurement` | `measurementId` (req) + los mismos campos que `create_measurement` | `MANAGE_PATIENT_PROFILE` |

El `preview` usa exactamente los mismos nombres de campo que
`create_measurement`, porque es el mismo formulario. Es la tool más barata de
todo este documento: el lado de Angular está hecho y probado.

---

## 9. Perfil del centro

Cierra el círculo con `import_holidays`: si el centro no tiene `countryCode` y
`stateCode`, no se pueden importar festivos. Con estas dos tools, la mascota
puede ofrecer arreglarlo en la misma conversación.

**Lectura**

| Tool | Argumentos | Devuelve | Permiso |
|---|---|---|---|
| `get_tenant_profile` | — | Nombre, CIF, dirección, teléfono, país/región/ciudad | `VIEW_TENANT_BRANDING` |

(Distinta de `get_tenant_info`, que ya existe y solo devuelve nombre, idioma y
zona horaria.)

**Escritura** — `MANAGE_TENANT`

| Tool | Campos |
|---|---|
| `update_tenant_profile` | `name`, `cif`, `address`, `phone`, `countryCode`, `stateCode`, `city` |

Endpoints: `GET`/`PUT /tenant/{tenantId}/profile`.

`preview[].field`: `name`, `cif`, `address`, `phone`, `countryCode`,
`stateCode`, `city`.

**Formulario**: existe (`settings/components/tenant-address-settings`), pero va
con `ngModel`, no con formulario reactivo. Eso significa que en Angular hay que
registrar la superficie con un `FieldAccess` a mano, como ya se hace con la
anamnesis en `patient-profile.surface`. Es trabajo de frontend, no tuyo: la
tool se implementa igual y, mientras no esté, cae en la tarjeta de confirmar.

---

## 10. Tipos de cita

Muy buen encaje conversacional ("añade un tipo 'Revisión rápida' de 20 minutos
a 25 €") y el formulario ya existe.

**Lectura**

| Tool | Argumentos | Devuelve | Permiso |
|---|---|---|---|
| `get_appointment_types` | — | Nombre, duración, precio, cuál es el de por defecto | `VIEW_APPOINTMENTS` |

Esta además mejora una tool que ya existe: `create_appointment` acepta `typeId`
pero el modelo no tiene forma de saber qué tipos hay.

**Escritura** — `MANAGE_TENANT`

| Tool | Campos |
|---|---|
| `create_appointment_type` | `name` (req), `durationMinutes` (req), `price` (req), `isDefault` |
| `update_appointment_type` | `appointmentTypeId` (req), `name`, `durationMinutes`, `price`, `isDefault`, `isActive` |

`preview[].field`: `name`, `durationMinutes`, `price`, `isDefault`.

Endpoints: `/tenant/{tenantId}/appointment-types`.

**Formulario**: existe (`appointment-type-form.dialog`), también con `ngModel`.

---

## 11. Agenda: de consultar a resolver

Hoy el asistente sabe *mirar* la agenda (`get_nutritionist_agenda`,
`get_today_overview`, `get_next_patient`) pero no sabe encontrar un hueco ni
cerrar el día. Estas son las que más tiempo ahorran de todo el documento.

| Tool | Argumentos | Devuelve | Permiso |
|---|---|---|---|
| `find_available_slots` | `date` o `from`+`to` (req), `appointmentTypeId`, `nutritionistId`, `limit` | Huecos libres | `VIEW_APPOINTMENTS` |
| `get_agenda_day` | `date` (req) | Citas, huecos y notas de ese día | `VIEW_APPOINTMENTS` |

`find_available_slots` tiene que cruzar **`get_opening_hours` + las citas ya
puestas + la duración del tipo de cita**. Es la pieza que convierte "búscame un
hueco el jueves por la tarde para una revisión" en una propuesta concreta, y la
que debería llamar el modelo antes de `create_appointment` en vez de inventar
una hora y chocar con la validación.

**Escritura**

| Tool | Campos | Permiso |
|---|---|---|
| `cancel_appointment` | `appointmentId` (req), `reason` | `MANAGE_APPOINTMENTS` |
| `create_calendar_note` | `date` (req), `text` (req) | `MANAGE_APPOINTMENTS` |

`cancel_appointment` quizá ya se cubre con `update_appointment_status`; si es
así, basta con que la descripción de esa tool mencione la cancelación, porque
el modelo no la está encontrando por ese camino.

**Formularios**: `appointment-form.dialog` ya tiene superficie. Para notas
existe `calendar-note-detail.dialog`, sin superficie todavía.

---

## 12. Ficha del paciente: lo que se rellena a mano cada día

Tres diálogos que existen, que se usan a diario y que no tienen tool.

| Tool | Campos | Permiso | Formulario |
|---|---|---|---|
| `update_clinical_status` | `patientId`, `clinicalStatus` (req), `reason` | `MANAGE_PATIENT_PROFILE` | `clinical-status.dialog` (reactivo) |
| `create_patient_event` | `patientId`, `title` (req), `description`, `startTime` (req) | `MANAGE_PATIENT_PROFILE` | `patient-event-form.dialog` (reactivo) |
| `assign_nutritionist` | `patientId` (req), `nutritionistId` (req) | `MANAGE_PATIENT_PROFILE` | `assign-nutritionist.dialog` (reactivo) |

`preview[].field`, en cada caso, los nombres del formulario:
`clinicalStatus`/`reason`, `title`/`description`/`startTime`,
`nutritionistId`.

Los tres son formularios reactivos, así que la superficie de Angular es de las
baratas: declarar los campos y registrar con `formAccess(this.form)`.

`assign_nutritionist` tiene una gracia extra: es la tool que permite "pásame
los pacientes de Ana a Luis" sin salir del chat.

---

## 13. Pacientes: lo proactivo

| Tool | Argumentos | Devuelve | Permiso |
|---|---|---|---|
| `get_patients_needing_followup` | `withoutAppointmentDays`, `withoutMeasurementDays`, `limit` | Pacientes descolgados | `VIEW_USER` |

Es la que cambia el carácter del asistente: deja de esperar órdenes y puede
abrir el día con "tienes 4 pacientes sin cita desde hace más de un mes". Es
solo lectura y se apoya en lo que ya hay (`lastVisitDate` del listado, la
última medición).

Merece una línea en los flujos del prompt:

```
- "¿A quién tengo descolgado?": get_patients_needing_followup.
```

---

## 14. Menús y dieta

El dominio más valioso y el más caro. Yo lo partiría en dos entregas.

**Barato y con formulario ya hecho**

| Tool | Campos | Permiso | Formulario |
|---|---|---|---|
| `assign_menu_template` | `patientId`, `templateId` (req), `name` (req), `isActive` | `MANAGE_MENU` | `assign-menu-template.dialog` (reactivo) |
| `rename_menu` | `menuId` (req), `name` (req) | `MANAGE_MENU` | `menu-rename.dialog` |

Ojo: `create_menu_from_template` ya existe. Conviene mirar si se solapa con
`assign_menu_template` antes de añadir la segunda; si hacen lo mismo, lo que
falta no es una tool sino una superficie de relleno para la que ya está.

**Caro, para después**

| Tool | Argumentos | Permiso |
|---|---|---|
| `generate_shopping_list` | `menuId` (req), `supermarket` | `VIEW_MENU` |
| `update_meal` | `mealId` (req), campos del plato | `MANAGE_MENU` |

`generate_shopping_list` se apoya en el flujo de IA que ya existe
(`shopping-list.api.ts`, `generateFromMenu`). `update_meal` necesita la lista
de alimentos y es el caso que más se parece a los tramos de una jornada: filas
repetibles. El motor de Angular ya las soporta desde este trabajo.

---

## 15. Transversales

Baratas, y algunas cambian mucho la sensación de uso.

| Tool | Argumentos | Devuelve | Permiso |
|---|---|---|---|
| `get_revenue_summary` | `from`, `to` o `period` | Facturado, cobrado, pendiente | `VIEW_REVENUE` |
| `explain_ui` | `topic` (lista cerrada) | Los pasos reales de la app | Autenticado |

`get_revenue_summary` necesita agregación en backend: la pantalla de ingresos
hoy la calcula en el cliente a partir de las citas con precio.

`explain_ui` no toca datos y responde "¿cómo asigno una jornada?" con los pasos
de verdad en vez de que el modelo se los invente. Con una lista cerrada de
temas es imposible que alucine una pantalla que no existe.

**Lo que NO metería**: `send_message_to_patient`. Escribir al paciente en su
nombre es otra categoría de riesgo, y el chat 1:1 ya existe con su propia
pantalla.

---

## 16. Por dónde empezaría

1. **`update_measurement`** — el frontend ya la espera, es media hora.
2. **Horarios** (secciones 1-7) — formularios hechos y verificados.
3. **`get_appointment_types` + `find_available_slots`** — las dos que mejoran
   tools que ya existen en vez de añadir superficie nueva.
4. **Perfil del centro y tipos de cita** — cierran la configuración.
5. **Ficha del paciente** (sección 12) — tres formularios reactivos, baratos.
6. **`get_patients_needing_followup`** — el salto a proactivo.
7. **Menús** — lo último, y en dos entregas.

Todo lo de escritura de este documento necesita además dos cosas que no son por
tool: añadirlas al `Set<String> WRITE_TOOLS`, y que `confirm()` no exija
paciente visible cuando la acción es de ámbito tenant (sección 5).

### Lo que falta en Angular

De las tools de arriba, estas rellenarían formulario en cuanto exista la
superficie, que es trabajo de `sif-web` y no de aquí:

- `update_tenant_profile`, `create_appointment_type` / `update_appointment_type`
  (los dos con `FieldAccess` a mano, porque van con `ngModel`).
- `update_clinical_status`, `create_patient_event`, `assign_nutritionist`,
  `assign_menu_template` (reactivos: baratos).
- `create_calendar_note`, `update_meal` (este último con filas repetibles).

Mientras no existan, las tools funcionan igual y caen en la tarjeta de
confirmar.
