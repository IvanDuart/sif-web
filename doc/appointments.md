# Citas — agendamiento de pacientes

## 1. Resumen

Se añade el módulo de **citas** para que los nutricionistas puedan agendar, gestionar y hacer seguimiento de sus consultas con pacientes.

Cada cita vincula a un **nutricionista** (rol `STAFF`) con un **paciente** (rol `PATIENT`) dentro de un mismo tenant, con horario definido, estado trazable y un **tipo de cita** configurable.

**Reglas de negocio:**
- No se permiten citas solapadas para el mismo nutricionista en el mismo tenant.
- Solo se puede agendar a usuarios con rol `PATIENT`.
- Solo usuarios con rol `STAFF` pueden ser nutricionistas asignantes.
- **Nutricionista titular**: cada paciente tiene un único nutricionista titular persistido en `user_tenant_role.assigned_nutritionist_id` (ver `doc/relacion_paciente_nutricionista.md`). Lo fija su primera cita y **no** cambia por citas posteriores atendidas por otro profesional (suplencias).
- **Un paciente, una cita activa**: no se puede crear otra cita si el paciente ya tiene una `SCHEDULED`/`PROPOSED` con `endTime` futuro (`409`). Para moverla hay que reagendarla.
- Una cita creada nace con estado `SCHEDULED` y puede transicionar a `COMPLETED`, `CANCELLED` o `NO_SHOW`.
- Si no se envía `endTime`, se calcula automáticamente desde `startTime` + la duración del `typeId`.
- **Citas sin paciente (primera consulta)**: `patientId` es opcional. Solo el personal (`MANAGE_APPOINTMENTS`) puede crear citas sin paciente; en ese caso no se envían notificaciones al crearse, reprogramarse o cambiar de estado. El paciente se puede vincular más adelante editando la cita (ver `doc/appointments_without_patient.md`).

---

## 2. AppointmentStatus

| Valor | Descripción |
|---|---|
| `SCHEDULED` | Agendada — estado inicial |
| `COMPLETED` | Completada — el paciente asistió |
| `CANCELLED` | Cancelada — se canceló antes de ocurrir |
| `NO_SHOW` | No ha asistido — el paciente no se presentó |

---

## 3. Endpoints

### POST /tenant/{tenantId}/appointments

Crea una nueva cita.

**Cuerpo de la solicitud:**
```json
{
  "nutritionistId": "uuid-del-nutricionista",
  "patientId": "uuid-del-paciente",
  "startTime": "2026-06-20T10:00:00Z",
  "typeId": "uuid-del-tipo-de-cita",
  "notes": "Primera consulta — evaluación inicial"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `nutritionistId` | `UUID` | No* | ID del usuario con rol `STAFF`. El **staff** debe indicarlo (si lo omite → `400`); el **paciente** no lo envía y se resuelve su nutricionista titular |
| `patientId` | `UUID` | No* | ID del usuario con rol `PATIENT`. Si se omite, se crea una **cita sin paciente** (solo personal) |
| `startTime` | `ISO 8601` | Sí | Inicio de la cita |
| `endTime` | `ISO 8601` | No* | Fin de la cita (si no se envía, se calcula desde `typeId`) |
| `typeId` | `UUID` | No* | Tipo de cita (obligatorio si no se envía `endTime`) |
| `notes` | `string` | No | Observaciones opcionales |

\* Debe enviarse al menos `endTime` o `typeId`. Si se envían ambos, se respeta `endTime`.
\* `patientId` opcional: si se omite y el llamador **no** tiene `MANAGE_APPOINTMENTS`, se responde `403`. Las citas sin paciente no generan notificaciones push.
\* `nutritionistId` y el paciente: si quien crea la cita es un paciente (`REQUEST_APPOINTMENT`), `nutritionistId` se **ignora/resuelve** desde su nutricionista titular. Sin titular → `409`.

**Validaciones:**
- `startTime` debe ser posterior a `now`.
- `endTime` debe ser posterior a `startTime`.
- El nutricionista debe tener rol `STAFF` en el tenant.
- El paciente (si se envía) debe tener rol `PATIENT` en el tenant.
- No debe existir otra cita activa (`SCHEDULED`) del mismo nutricionista en el rango solicitado.
- El paciente no debe tener ya una cita activa (`SCHEDULED`/`PROPOSED` con `endTime` futuro) → `409`.
- La primera cita de un paciente sin titular **le asigna** ese nutricionista como titular.

**Response 201:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "nutritionistId": "uuid",
  "nutritionistName": "Dr. Martínez",
  "patientId": "uuid",
  "patientName": "María García",
  "typeId": "uuid",
  "typeName": "Primera consulta",
  "startTime": "2026-06-20T10:00:00Z",
  "endTime": "2026-06-20T10:50:00Z",
  "status": "SCHEDULED",
  "notes": "Primera consulta — evaluación inicial",
  "createdAt": "2026-06-15T12:00:00Z"
}
```

**Response 409 — Horario solapado:**
```json
{
  "error": "The nutritionist already has an appointment in that time slot"
}
```

**Response 409 — El paciente ya tiene una cita activa:**
```json
{
  "error": "This patient already has an upcoming appointment. Use reschedule to change it"
}
```

**Response 409 — El paciente no tiene nutricionista titular (petición del propio paciente):**
```json
{
  "error": "You don't have an assigned nutritionist yet. Contact the center for your first appointment"
}
```

**Response 400 — El staff no indicó nutricionista:**
```json
{
  "error": "A nutritionist must be provided when creating an appointment"
}
```

---

### GET /tenant/{tenantId}/appointments/nutritionist/{nutritionistId}

Obtiene las citas de un nutricionista. Soporta filtros opcionales por query params.

**Parámetros query (opcionales):**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `from` | `ISO 8601` | Filtra citas desde esta fecha |
| `to` | `ISO 8601` | Filtra citas hasta esta fecha |
| `status` | `string` | Filtra por estado (`SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`) |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "tenantId": "uuid",
    "nutritionistId": "uuid",
    "nutritionistName": "Dr. Martínez",
    "patientId": "uuid",
    "patientName": "María García",
    "typeId": "uuid",
    "typeName": "Primera consulta",
    "startTime": "2026-06-20T10:00:00Z",
    "endTime": "2026-06-20T10:50:00Z",
    "status": "SCHEDULED",
    "notes": "Primera consulta",
    "createdAt": "2026-06-15T12:00:00Z"
  }
]
```

---

### GET /tenant/{tenantId}/appointments/patient/{patientId}

Obtiene las citas de un paciente. Mismos filtros opcionales que el endpoint anterior.

**Response 200:** misma estructura que el endpoint de nutricionista.

---

### PATCH /tenant/{tenantId}/appointments/{appointmentId}/status

Actualiza el estado de una cita.

**Cuerpo de la solicitud:**
```json
{
  "status": "COMPLETED"
}
```

**Valores permitidos:** `COMPLETED`, `CANCELLED`, `NO_SHOW`

**Response 200:** el objeto completo de la cita actualizado.

---

### GET /tenant/{tenantId}/appointments/nutritionist/{nutritionistId}/patients

Lista la **cartera** del nutricionista: los pacientes que tienen **asignado** a ese nutricionista como **titular** (no los que simplemente han tenido alguna cita con él). Ver `doc/relacion_paciente_nutricionista.md`.

Consecuencias:
- Un paciente que lleva mucho tiempo sin venir **sigue apareciendo**.
- Un paciente atendido puntualmente por una suplencia **no** aparece en la lista del suplente.
- Puede aparecer un paciente sin ninguna cita (`lastAppointment` y `nextAppointment` a `null`).
- `lastAppointment` / `nextAppointment` se calculan sobre **todas** las citas del paciente en el centro, sean de quien sean.

**Response 200:**
```json
[
  {
    "patientId": "uuid",
    "firstName": "María",
    "lastName": "García",
    "email": "maria@example.com",
    "lastAppointment": "2026-06-20T10:00:00Z",
    "nextAppointment": "2026-07-20T10:00:00Z"
  }
]
```

| Campo | Tipo | Descripción |
|---|---|---|
| `patientId` | `UUID` | ID del paciente |
| `firstName` | `string` | Nombre del paciente |
| `lastName` | `string` | Apellido del paciente |
| `email` | `string` | Email del paciente |
| `lastAppointment` | `ISO 8601` | Fecha de la última cita (puede ser `null`) |
| `nextAppointment` | `ISO 8601` | Fecha de la próxima cita agendada (puede ser `null`) |

---

## 4. Seguridad

El acceso a los endpoints de citas estará protegido por los permisos del usuario autenticado en el tenant:

| Permiso | Endpoints | Asignado a |
|---|---|---|
| `MANAGE_APPOINTMENTS` | `POST`, `PATCH /status` | `ADMIN`, `NUTRITIONIST` |
| `VIEW_APPOINTMENTS` | `GET /nutritionist/{id}`, `GET /patient/{id}`, `GET /nutritionist/{id}/patients` | `ADMIN`, `NUTRITIONIST` |

---

## 5. Tabla de campos — appointment

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `UUID` | PK |
| `tenant_id` | `UUID` | FK → `tenant`, multi-tenant |
| `nutritionist_id` | `UUID` | FK → `app_user`, el nutricionista |
| `patient_id` | `UUID` | FK → `app_user`, el paciente (nullable — permite citas sin paciente) |
| `type_id` | `UUID` | FK → `appointment_type`, tipo de cita (nullable) |
| `start_time` | `TIMESTAMPTZ` | Inicio de la cita |
| `end_time` | `TIMESTAMPTZ` | Fin de la cita |
| `status` | `VARCHAR(20)` | Estado actual |
| `notes` | `TEXT` | Observaciones |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | Fecha de última actualización |

---

## 6. Notas técnicas

- **Solapamiento**: la validación se hace en la capa de servicio consultando si existe alguna cita del mismo nutricionista con estado `SCHEDULED` donde los rangos horarios se intersequen. Se usa la condición: `start < :endTime AND end > :startTime`.
- **Cálculo automático de endTime**: si el frontend envía `typeId` pero no `endTime`, el servidor calcula `endTime = startTime + durationMinutes` del tipo de cita.
- **Multi-tenant**: la entidad `Appointment` lleva `@Filter(name = "tenantFilter")` para que todas las consultas se filtren automáticamente por el tenant del contexto.
- **Relación paciente-nutricionista**: es **explícita y persistida** en `user_tenant_role.assigned_nutritionist_id` (un nutricionista titular por paciente y tenant). No se deriva del histórico de citas. El endpoint `GET /nutritionist/{id}/patients` lee esa asignación. El nutricionista titular solo cambia con `PUT /tenant/{tenantId}/users/{userId}/assigned-nutritionist` o, si el paciente aún no tenía, con su primera cita. Detalle completo en `doc/relacion_paciente_nutricionista.md`.
- **Notificaciones**: se envían **después del commit** de la transacción (`PushNotificationService.notifyUserAfterCommit`), para no avisar de cambios que finalmente no se han guardado.
- **Estados**: una vez que una cita sale de `SCHEDULED` (a `COMPLETED`, `CANCELLED` o `NO_SHOW`) no puede volver a `SCHEDULED`.

---

## 7. Archivos creados / modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V8__create_appointments_table.sql` | Nuevo — crea tabla `appointment` + permisos |
| `db/migration/V9__appointment_types.sql` | Nuevo — crea tabla `appointment_type` + FK `type_id` en `appointment` |
| `db/migration/V29__make_appointment_patient_nullable.sql` | Nuevo — hace `patient_id` nullable (citas sin paciente) |
| `models/entity/AppointmentStatus.java` | Nuevo — enum con estados |
| `models/entity/Appointment.java` | Nuevo — entidad JPA con tenant filter + relación a `AppointmentType`; `patient` opcional |
| `models/dto/AppointmentDto.java` | Nuevo — incluye `typeId` y `typeName`; `patientId`/`patientName` pueden ser `null` |
| `controller/dto/CreateAppointmentRequest.java` | Nuevo — `endTime` opcional + `typeId` opcional; `patientId` opcional |
| `controller/dto/UpdateAppointmentStatusRequest.java` | Nuevo — DTO de cambio de estado |
| `repository/AppointmentRepository.java` | Nuevo — repositorio JPA |
| `service/AppointmentService.java` | Nuevo — incluye resolución de tipo de cita, cálculo automático de `endTime` y soporte de citas sin paciente |
| `controller/AppointmentController.java` | Nuevo — endpoints REST |
| `exception/ConflictException.java` | Nuevo — excepción HTTP 409 |

### Cambios posteriores (relación paciente-nutricionista explícita)

| Ruta | Cambio |
|---|---|
| `db/migration/V45__add_assigned_nutritionist.sql` | Nueva — columna `assigned_nutritionist_id` en `user_tenant_role` + backfill |
| `models/entity/UserTenantRole.java` | Nuevo campo `assignedNutritionist` |
| `repository/AppointmentRepository.java` | `findActiveByPatient`, `findByPatientOrderByStartTimeDesc`; se eliminan `findDistinctPatientIdsByNutritionist` y `findByNutritionistAndPatientOrderByStartTimeDesc` |
| `service/AppointmentService.java` | `resolveNutritionist`, `assignTitularIfMissing`, `ensurePatientHasNoActiveAppointment`, refactor de `findPatientsByNutritionist`, fixes de `reschedule`, notificaciones post-commit |
| `controller/dto/CreateAppointmentRequest.java` | `nutritionistId` opcional |
| `exception/ErrorResource.java` + `i18n/Messages*.properties` | 4 claves de error nuevas |

Detalle completo en **`doc/relacion_paciente_nutricionista.md`**.
