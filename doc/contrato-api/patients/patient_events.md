# Eventos del paciente — calendario personal

## 1. Resumen

Se añade el módulo de **eventos del paciente** para que los nutricionistas puedan registrar y visualizar eventos relevantes en la vida del paciente (bodas, operaciones, viajes, exámenes, etc.) en un calendario.

A diferencia de las citas, los eventos del paciente no están vinculados a un nutricionista ni tienen estados — son registros informativos que el paciente o el nutricionista pueden gestionar.

**Reglas de negocio:**
- Un evento pertenece a un paciente concreto dentro del tenant.
- `endTime` debe ser posterior a `startTime`.
- Si no se envía `endTime`, se copia `startTime` (evento puntual).
- No hay validación de solapamiento — los eventos no bloquean horarios.

---

## 2. Endpoints

### POST /tenant/{tenantId}/patients/{patientId}/events

Crea un nuevo evento para el paciente.

**Cuerpo de la solicitud:**
```json
{
  "title": "Boda",
  "description": "Boda del hermano — probablemente coma fuera de casa",
  "startTime": "2026-07-18T10:00:00Z",
  "endTime": "2026-07-18T23:59:00Z"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `title` | `string` | Sí | Título del evento (ej: "Boda", "Operación") |
| `description` | `string` | No | Notas o detalles adicionales |
| `startTime` | `ISO 8601` | Sí | Fecha y hora de inicio |
| `endTime` | `ISO 8601` | No | Fecha y hora de fin (si no se envía, se copia `startTime`) |

**Validaciones:**
- `title` no puede estar vacío.
- `startTime` debe ser posterior a `now`.
- `endTime` debe ser posterior a `startTime`.

**Response 201:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "patientId": "uuid",
  "patientName": "María García",
  "title": "Boda",
  "description": "Boda del hermano — probablemente coma fuera de casa",
  "startTime": "2026-07-18T10:00:00Z",
  "endTime": "2026-07-18T23:59:00Z",
  "createdAt": "2026-06-30T12:00:00Z"
}
```

---

### GET /tenant/{tenantId}/patients/{patientId}/events

Obtiene los eventos de un paciente. Soporta filtros opcionales por rango de fechas.

**Parámetros query (opcionales):**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `from` | `ISO 8601` | Filtra eventos desde esta fecha |
| `to` | `ISO 8601` | Filtra eventos hasta esta fecha |

Si se envían `from` y `to`, se usa una query optimizada por rango. Si no, se devuelven todos los eventos del paciente ordenados por fecha ascendente.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "tenantId": "uuid",
    "patientId": "uuid",
    "patientName": "María García",
    "title": "Boda",
    "description": "Boda del hermano",
    "startTime": "2026-07-18T10:00:00Z",
    "endTime": "2026-07-18T23:59:00Z",
    "createdAt": "2026-06-30T12:00:00Z"
  }
]
```

---

### PUT /tenant/{tenantId}/patient-events/{eventId}

Actualiza un evento existente (actualización parcial — solo se actualizan los campos enviados).

**Cuerpo de la solicitud:**
```json
{
  "title": "Boda familiar (confirmado)",
  "startTime": "2026-07-18T12:00:00Z"
}
```

**Response 200:** el objeto completo del evento actualizado.

---

### DELETE /tenant/{tenantId}/patient-events/{eventId}

Elimina un evento existente.

**Response 204:** sin contenido.

---

## 3. Seguridad

El acceso a los endpoints está protegido por los permisos del usuario autenticado en el tenant:

| Permiso | Endpoints | Asignado a |
|---|---|---|
| `MANAGE_PATIENT_EVENTS` | `POST`, `PUT`, `DELETE` | `ADMIN`, `NUTRITIONIST` |
| `VIEW_PATIENT_EVENTS` | `GET` | `ADMIN`, `NUTRITIONIST` |

---

## 4. Tabla de campos — patient_event

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `UUID` | PK |
| `tenant_id` | `UUID` | FK → `tenant`, multi-tenant |
| `patient_id` | `UUID` | FK → `app_user`, el paciente |
| `title` | `VARCHAR(255)` | Título del evento |
| `description` | `TEXT` | Descripción o notas (nullable) |
| `start_time` | `TIMESTAMPTZ` | Inicio del evento |
| `end_time` | `TIMESTAMPTZ` | Fin del evento |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | Fecha de última actualización |

---

## 5. Notas técnicas

- **Diferencia con citas**: los eventos del paciente son meramente informativos. No tienen estado, no bloquean horarios del nutricionista y no requieren validación de solapamiento.
- **Multi-tenant**: la entidad `PatientEvent` lleva `@Filter(name = "tenantFilter")` para que todas las consultas se filtren automáticamente por el tenant del contexto.
- **Búsqueda por rango**: el repositorio expone `findByPatientAndTimeRange` con la condición `startTime < :endTime AND endTime > :startTime` para localizar eventos que intersecten un período dado (útil para pintar un calendario mensual/semanal).
- **Eventos de un día**: si el frontend solo envía `startTime`, el backend copia ese valor a `endTime`, creando un evento puntual.

---

## 6. Archivos creados / modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V11__create_patient_events_table.sql` | Nuevo — crea tabla `patient_event` + permisos |
| `models/entity/PatientEvent.java` | Nuevo — entidad JPA con tenant filter |
| `models/dto/PatientEventDto.java` | Nuevo — DTO de salida |
| `controller/dto/CreatePatientEventRequest.java` | Nuevo — DTO de creación |
| `controller/dto/UpdatePatientEventRequest.java` | Nuevo — DTO de actualización parcial |
| `repository/PatientEventRepository.java` | Nuevo — repositorio JPA |
| `service/PatientEventService.java` | Nuevo — lógica de negocio |
| `controller/PatientEventController.java` | Nuevo — endpoints REST |
| `exception/ErrorResource.java` | Modificado — añadido `PATIENT_EVENT_NOT_FOUND` |
