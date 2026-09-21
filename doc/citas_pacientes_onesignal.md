# Solicitud de Citas por Pacientes e Integración con OneSignal

Este documento detalla los cambios realizados en el backend para permitir que los pacientes soliciten citas para sí mismos (las cuales inician en estado `PROPOSED` pendiente de aprobación) y la integración de notificaciones push en tiempo real a través de **OneSignal**.

---

## 1. Solicitud de Citas por Paciente

### Flujo de Permisos
Anteriormente, el endpoint de creación de citas (`POST /tenant/{tenantId}/appointments`) requería el permiso `MANAGE_APPOINTMENTS` (solo disponible para administradores y nutricionistas).

Se ha creado un nuevo permiso `REQUEST_APPOINTMENT` asignado al rol **USER** (pacientes). 

El endpoint ahora soporta ambos escenarios:
```java
@PreAuthorize("@hasAccess.withTenantPermission(#tenantId, 'MANAGE_APPOINTMENTS') or " +
              "@hasAccess.withTenantPermission(#tenantId, 'REQUEST_APPOINTMENT')")
```

### Reglas de Negocio en Creación (`POST`)
1. **Creado por Paciente (`REQUEST_APPOINTMENT`):**
   - El paciente solo puede solicitar citas para sí mismo. Si intenta enviar un `patientId` distinto al suyo en el body de la petición, el servidor devolverá un error `403 Forbidden`.
   - La cita se guarda automáticamente con el estado inicial **`PROPOSED`** (Propuesta/Pendiente de confirmación).
   - **No debe enviar `nutritionistId`**: el backend resuelve su **nutricionista titular** (ver `doc/relacion_paciente_nutricionista.md`). Si aún no tiene titular → `409` (`error.appointment_no_nutritionist_assigned`), y la app debe pedirle que contacte con el centro.
   - Si ya tiene una cita activa (`SCHEDULED`/`PROPOSED` con fin futuro) → `409` (`error.appointment_patient_has_active`): debe **reagendar**, no crear otra.
2. **Creado por Staff (`MANAGE_APPOINTMENTS`):**
   - Mantiene el comportamiento original: puede agendar citas para cualquier paciente en el tenant y el estado inicial es **`SCHEDULED`** (Confirmada).
   - `nutritionistId` es **obligatorio** (`400` si se omite) y puede ser cualquier nutricionista del centro, aunque el paciente tenga otro titular (suplencias). Esa cita **no** cambia el titular.
   - Si el paciente no tenía nutricionista titular, esta cita se lo asigna.

---

## 2. Integración de Notificaciones Push (OneSignal)

El backend cuenta con integración directa con la REST API de OneSignal para disparar notificaciones push en tiempo real ante eventos de citas. 

### Arquitectura de Identificación
Para evitar mantener una base de datos local con tokens de dispositivos, el backend utiliza el mapeo por **`external_id`** provisto por OneSignal.
- El backend identifica al destinatario de la notificación enviando su ID único de base de datos (`AppUser.id`) en el parámetro `include_aliases` -> `external_id`.
- **Acción requerida en Flutter:** Tras autenticarse y conocer el UUID de su usuario en la base de datos, la app móvil Flutter debe registrar al usuario en OneSignal de la siguiente forma:
  ```dart
  // Vincular el ID del usuario con OneSignal
  OneSignal.login(userId); // Donde userId es el UUID del usuario
  ```
  Al cerrar sesión, recordad desvincularlo:
  ```dart
  OneSignal.logout();
  ```

---

## 3. Disparadores de Notificación e Idiomas

Las notificaciones push enviadas por el backend incluyen el texto tanto en español (`es`) como en inglés (`en`). Los eventos y mensajes son los siguientes:

| Evento | Destinatario | Título (Push) | Cuerpo (Push) |
|---|---|---|---|
| Paciente solicita una cita | **Nutricionista** | Nueva solicitud de cita | El paciente {Nombre Paciente} ha solicitado una cita para el {Fecha/Hora ISO} |
| Cita confirmada por el Staff | **Paciente** | Cita agendada | Tu cita con {Nombre Nutricionista} ha sido agendada para el {Fecha/Hora ISO} |
| Paciente pide reprogramar | **Nutricionista** | Solicitud de reprogramación | El paciente {Nombre Paciente} ha solicitado reprogramar su cita al {Fecha/Hora ISO} |
| Reprogramada y confirmada | **Paciente** | Cita reprogramada y confirmada | Tu cita con {Nombre Nutricionista} ha sido reprogramada y confirmada para el {Fecha/Hora ISO} |
| Cita completada | **Paciente** | Cita completada | Tu cita del {Fecha/Hora ISO} ha sido marcada como completada. ¡Gracias por asistir! |
| Cita cancelada | **Ambos** | Cita cancelada | [Personalizado según si es paciente o nutricionista notificando la cancelación] |
| Ausencia del paciente | **Paciente** | Ausencia registrada | Tu cita del {Fecha/Hora ISO} ha sido registrada como no presentado (no show) |

> **Nota sobre Fechas y Horas:** El backend envía las marcas de tiempo en formato ISO 8601 UTC (p. ej. `2026-08-13T10:00:00Z`). La app Flutter debe parsear y formatear localmente estas marcas de tiempo en el timezone del propio dispositivo del usuario para mostrar la hora correspondiente.

---

## 4. Ejemplos de Petición cURL (Paciente solicitando cita)

```bash
curl -X POST "http://localhost:8081/api/tenant/00000000-0000-0000-0000-000000000001/appointments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "550e8400-e29b-41d4-a716-446655440000", 
    "startTime": "2026-08-20T10:00:00Z",
    "endTime": "2026-08-20T11:00:00Z",
    "typeId": "8c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7f",
    "notes": "Me gustaría tratar las alergias de esta temporada."
  }'
```

> **Nota (cambio posterior)**: el paciente ya **no** envía `nutritionistId`. El backend usa su nutricionista titular. Si la petición incluye `nutritionistId`, también se ignora (se resuelve el titular).

*Respuesta esperada (201 Created):*
```json
{
  "id": "a110000f-bd6b-d6c2-9bdd-2b0d7b3dcb99",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "nutritionistId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "nutritionistName": "Laura Pérez",
  "patientId": "550e8400-e29b-41d4-a716-446655440000",
  "patientName": "Ana Gómez",
  "typeId": "8c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7f",
  "typeName": "Consulta",
  "startTime": "2026-08-20T10:00:00Z",
  "endTime": "2026-08-20T11:00:00Z",
  "status": "PROPOSED",
  "notes": "Me gustaría tratar las alergias de esta temporada.",
  "createdAt": "2026-08-13T12:00:00Z"
}
```
