# Citas sin paciente (primera consulta) — guía para frontend

## Resumen

El nutricionista puede necesitar agendar una **primera consulta** para un paciente que aún no tiene ficha en el sistema. Para eso, `POST /tenant/{tenantId}/appointments` ahora acepta **citas sin paciente**: se omite `patientId` y la cita queda creada igualmente, vinculada solo al nutricionista.

**Retrocompatible**: si `patientId` se envía, el comportamiento es exactamente el mismo que antes.

**Reglas:**
- Solo el personal (permiso `MANAGE_APPOINTMENTS`) puede crear una cita sin paciente. Si el llamador no tiene ese permiso y omite `patientId`, se responde `403`.
- Las citas sin paciente **no generan notificaciones push** (ni al crearse, reprogramarse, completarse, cancelarse ni por recordatorios).
- El resto de validaciones aplican igual: solapamiento de horario con el nutricionista, horario de centro, festivos, `endTime`/`typeId`, etc.
- La cita nace con estado `SCHEDULED`.

---

## 1. Crear una cita sin paciente

`POST /tenant/{tenantId}/appointments`

**Cuerpo (sin `patientId`):**
```json
{
  "nutritionistId": "uuid-del-nutricionista",
  "startTime": "2026-06-20T10:00:00Z",
  "typeId": "uuid-del-tipo-de-cita",
  "notes": "Primera consulta — futuro paciente"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `nutritionistId` | `UUID` | Sí | ID del nutricionista (rol `STAFF`) |
| `patientId` | `UUID` | No | **Omitir** para cita sin paciente |
| `startTime` | `ISO 8601` | Sí | Inicio de la cita |
| `endTime` | `ISO 8601` | No* | Fin (si no se envía, se calcula desde `typeId`) |
| `typeId` | `UUID` | No* | Tipo de cita |
| `notes` | `string` | No | Observaciones |

\* Debe enviarse al menos `endTime` o `typeId`.

**Response 201:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "nutritionistId": "uuid",
  "nutritionistName": "Dr. Martínez",
  "patientId": null,
  "patientName": null,
  "typeId": "uuid",
  "typeName": "Primera consulta",
  "startTime": "2026-06-20T10:00:00Z",
  "endTime": "2026-06-20T10:50:00Z",
  "status": "SCHEDULED",
  "notes": "Primera consulta — futuro paciente",
  "createdAt": "2026-06-15T12:00:00Z"
}
```

> **Importante para el frontend**: `patientId` y `patientName` vienen como `null`. La UI no debe asumir que toda cita tiene paciente (ej. no mostrar avatar de paciente, mostrar placeholder "Paciente por asignar").

**Response 403 — sin permiso:**
```json
{
  "error": "Solo el personal puede crear citas sin paciente"
}
```

---

## 2. ¿Cómo se ven en las listas?

- `GET /tenant/{tenantId}/appointments/nutritionist/{nutritionistId}` — **incluye** las citas sin paciente (con `patientId`/`patientName` `null`).
- `GET /tenant/{tenantId}/appointments/patient/{patientId}` — no las incluye (no hay paciente que coincida).

---

## 3. Reprogramar / cambiar estado

- `PATCH /tenant/{tenantId}/appointments/{appointmentId}` — funciona normal; sin notificaciones.
- `PATCH /tenant/{tenantId}/appointments/{appointmentId}/status` — funciona normal (`COMPLETED`, `CANCELLED`, `NO_SHOW`); sin notificaciones.

---

## 4. Recordatorios

El job diario de recordatorios **omite** las citas sin paciente (no tiene a quién notificar).

---

## 5. Notas técnicas

- Migración `V29__make_appointment_patient_nullable.sql`: la columna `appointment.patient_id` pasa a ser `NULL`-able.
- En el DTO de respuesta `AppointmentDto`, `patientId` y `patientName` son `null` cuando la cita no tiene paciente.
- El endpoint `GET /nutritionist/{nutritionistId}/patients` ignora las citas sin paciente (solo lista pacientes reales).

---

## 6. Archivos modificados

| Ruta | Cambio |
|---|---|
| `src/main/resources/db/migration/V29__make_appointment_patient_nullable.sql` | Nueva migración — `patient_id` nullable |
| `src/main/java/.../models/entity/Appointment.java` | `patient` opcional (`@JoinColumn` sin `nullable = false`) |
| `src/main/java/.../controller/dto/CreateAppointmentRequest.java` | `patientId` deja de ser `@NotNull` |
| `src/main/java/.../service/AppointmentService.java` | Creación con paciente opcional (solo staff), notificaciones null-safe, `toDto` null-safe |
| `src/main/java/.../utils/filter/AppointmentSpecs.java` | `filterByNutritionist` usa LEFT JOIN en `patient` |
| `src/main/java/.../repository/AppointmentRepository.java` | `findDistinctPatientIdsByNutritionist` excluye pacientes `null` |
