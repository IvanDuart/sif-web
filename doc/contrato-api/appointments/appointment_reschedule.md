# Reagendamiento de citas

## 1. Resumen

Se añade la funcionalidad de **reagendar (reschedule)** una cita existente, permitiendo modificar su fecha, hora, tipo de cita y notas sin necesidad de cancelarla y crear una nueva.

**Reglas de negocio:**
- Solo se pueden reagendar citas en estado `SCHEDULED` o `PROPOSED`.
- No se transfiere la cita a otro nutricionista.
- Se valida solapamiento excluyendo la propia cita (no choca consigo misma).
- Si no se envía `endTime`, se recalcula automáticamente desde `startTime` + la duración del tipo de cita (o la duración actual de la cita).
- El **staff** tiene semántica PATCH: todos los campos son opcionales.
- El **paciente** debe enviar siempre `startTime` (si no, `400` `error.appointment_reschedule_requires_start_time`). Un reagendado del paciente devuelve la cita a `PROPOSED`.
- Las validaciones de horario/solapamiento solo se ejecutan si el tramo horario cambia realmente.

---

## 2. Endpoint

### PATCH /tenant/{tenantId}/appointments/{appointmentId}

**Cuerpo de la solicitud** (todos los campos opcionales):
```json
{
  "startTime": "2026-07-01T10:00:00Z",
  "typeId": "uuid-del-tipo-de-cita",
  "notes": "Reagendado por preferencia del paciente"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `startTime` | `ISO 8601` | No | Nueva hora de inicio |
| `endTime` | `ISO 8601` | No | Nueva hora de fin (si no se envía, se calcula desde `typeId`) |
| `typeId` | `UUID` | No | Nuevo tipo de cita |
| `notes` | `string` | No | Nuevas observaciones |

**Notas sobre el comportamiento:**
- Si se envía `startTime` pero no `endTime`, y la cita ya tiene un `typeId` asignado, se recalcula el `endTime` con la duración del tipo.
- Si además se cambia el `typeId`, se usa la duración del nuevo tipo para el cálculo.
- Si no se envía `startTime` (solo staff), no se modifica la fecha/hora actual.
- Los campos no enviados se mantienen con su valor actual.

**Validaciones:**
- La cita debe estar en estado `SCHEDULED` o `PROPOSED`.
- Si el llamador es el **paciente**, `startTime` es obligatorio (`400`).
- Si se cambia `startTime`, debe ser posterior a `now`.
- `endTime` (recalculado o explícito) debe ser posterior a `startTime`.
- No debe solaparse con otras citas agendadas del mismo nutricionista (excluyéndose a sí misma).

**Response 200:** el objeto completo de la cita actualizado.

---

## 3. Lógica de recalculo de `endTime`

El fin **siempre** se recalcula; nunca queda descolgado del `startTime`.

| ¿Envió `endTime`? | ¿Hay `typeId` en la cita? | Resultado |
|---|---|---|
| Sí | — | Se usa el `endTime` enviado |
| No | Sí | `endTime = startTime + type.durationMinutes` |
| No | No | `endTime = startTime + duración actual de la cita` |

---

## 4. Seguridad

Requiere el permiso `MANAGE_APPOINTMENTS` en el tenant (mismo que crear o cancelar citas).

---

## 5. Archivos creados / modificados

| Ruta | Cambio |
|---|---|
| `controller/dto/RescheduleAppointmentRequest.java` | Nuevo — DTO con campos opcionales |
| `repository/AppointmentRepository.java` | Modificado — añadido `findOverlappingExcludingId` |
| `service/AppointmentService.java` | Modificado — añadido método `reschedule` |
| `controller/AppointmentController.java` | Modificado — añadido endpoint `PATCH /{appointmentId}` |
