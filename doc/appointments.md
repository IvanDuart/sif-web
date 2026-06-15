# Citas — agendamiento de pacientes

## 1. Resumen

Se añade el módulo de **citas** para que los nutricionistas puedan agendar, gestionar y hacer seguimiento de sus consultas con pacientes.

Cada cita vincula a un **nutricionista** (rol `STAFF`) con un **paciente** (rol `PATIENT`) dentro de un mismo tenant, con horario definido, estado trazable y un **tipo de cita** configurable.

**Reglas de negocio:**
- No se permiten citas solapadas para el mismo nutricionista en el mismo tenant.
- Solo se puede agendar a usuarios con rol `PATIENT`.
- Solo usuarios con rol `STAFF` pueden ser nutricionistas asignantes.
- Una cita creada nace con estado `SCHEDULED` y puede transicionar a `COMPLETED`, `CANCELLED` o `NO_SHOW`.
- Si no se envía `endTime`, se calcula automáticamente desde `startTime` + la duración del `typeId`.

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
| `nutritionistId` | `UUID` | Sí | ID del usuario con rol `STAFF` |
| `patientId` | `UUID` | Sí | ID del usuario con rol `PATIENT` |
| `startTime` | `ISO 8601` | Sí | Inicio de la cita |
| `endTime` | `ISO 8601` | No* | Fin de la cita (si no se envía, se calcula desde `typeId`) |
| `typeId` | `UUID` | No* | Tipo de cita (obligatorio si no se envía `endTime`) |
| `notes` | `string` | No | Observaciones opcionales |

\* Debe enviarse al menos `endTime` o `typeId`. Si se envían ambos, se respeta `endTime`.

**Validaciones:**
- `startTime` debe ser posterior a `now`.
- `endTime` debe ser posterior a `startTime`.
- El nutricionista debe tener rol `STAFF` en el tenant.
- El paciente debe tener rol `PATIENT` en el tenant.
- No debe existir otra cita activa (`SCHEDULED`) del mismo nutricionista en el rango solicitado.

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

Lista los pacientes (distintos) que tienen o han tenido citas con el nutricionista indicado.

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
| `patient_id` | `UUID` | FK → `app_user`, el paciente |
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
- **Relación paciente-nutricionista**: se deriva del histórico de citas. No existe una tabla separada de asignación; la lista de pacientes de un nutricionista se obtiene consultando los `patientId` distintos de sus citas.
- **Estados**: una vez que una cita sale de `SCHEDULED` (a `COMPLETED`, `CANCELLED` o `NO_SHOW`) no puede volver a `SCHEDULED`.

---

## 7. Archivos creados / modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V8__create_appointments_table.sql` | Nuevo — crea tabla `appointment` + permisos |
| `db/migration/V9__appointment_types.sql` | Nuevo — crea tabla `appointment_type` + FK `type_id` en `appointment` |
| `models/entity/AppointmentStatus.java` | Nuevo — enum con estados |
| `models/entity/Appointment.java` | Nuevo — entidad JPA con tenant filter + relación a `AppointmentType` |
| `models/dto/AppointmentDto.java` | Nuevo — incluye `typeId` y `typeName` |
| `controller/dto/CreateAppointmentRequest.java` | Nuevo — `endTime` opcional + `typeId` opcional |
| `controller/dto/UpdateAppointmentStatusRequest.java` | Nuevo — DTO de cambio de estado |
| `repository/AppointmentRepository.java` | Nuevo — repositorio JPA |
| `service/AppointmentService.java` | Nuevo — incluye resolución de tipo de cita y cálculo automático de `endTime` |
| `controller/AppointmentController.java` | Nuevo — endpoints REST |
| `exception/ConflictException.java` | Nuevo — excepción HTTP 409 |
