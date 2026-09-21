# Relación paciente → nutricionista (titular) — guía para frontend y app

## 1. Resumen

Hasta ahora la relación entre un paciente y su nutricionista **se infería del histórico de citas**: si un paciente llevaba meses sin venir, seguía apareciendo en "mis pacientes" solo porque alguna vez tuvo una cita, y bastaba una cita puntual de otro profesional para "moverlo" de cartera.

A partir de este cambio la relación es **explícita y persistida**:

- Cada paciente tiene **un único nutricionista titular** (su "cartera") dentro de cada centro.
- El titular se fija **automáticamente la primera vez**: lo asigna el nutricionista que le da su primera cita, o el nutricionista que crea/invita al paciente.
- Solo se puede **cambiar explícitamente** con un `PUT` de reasignación.
- Un paciente puede ser **atendido por otro nutricionista** (suplencias, vacaciones, bajas) **sin cambiar** quién es su titular.

Esto es lo que permite el caso de uso clave: **un paciente que lleva tiempo sin ir puede pedir cita nueva y el sistema la asigna automáticamente a su nutricionista titular**.

### Conceptos que no hay que confundir

| Concepto | Dónde vive | Qué significa |
|---|---|---|
| **Nutricionista titular** (`assignedNutritionistId`) | `user_tenant_role.assigned_nutritionist_id` | Quién es "su" nutricionista en el centro. Define la cartera de "Mis Pacientes". Cambia solo con el `PUT`. |
| **Nutricionista de la cita** (`appointment.nutritionistId`) | `appointment.nutritionist_id` | Quién atiende **esa** cita concreta. Puede ser distinto del titular (suplencia). |

> Regla de oro: **`appointment.nutritionistId` nunca modifica por sí solo `assignedNutritionistId`**, salvo en la **primera** cita del paciente (cuando todavía no tiene titular).

---

## 2. Reglas de negocio

1. **Un solo nutricionista titular por paciente y centro.** Un mismo usuario puede ser paciente en varios centros, y en cada uno tener un titular distinto. Un mismo usuario puede ser nutricionista en un centro y paciente en otro.
2. **La primera cita fija el titular.** Si el paciente no tiene titular, el nutricionista de esa cita pasa a serlo. Si ya tenía, **no se sobreescribe** (caso suplencia).
3. **Al crear/invitar a un paciente siendo nutricionista, se lo queda.** Si quien invita tiene rol `NUTRITIONIST` en el centro, se auto-asigna como titular. Si quien invita es `ADMIN`, el paciente queda sin titular hasta su primera cita.
4. **Solo el `PUT` cambia la asignación** una vez fijada. Se puede reasignar a otro nutricionista del centro o dejarla vacía (`null`).
5. **El titular tiene que ser personal del centro** (rol con tipo `STAFF` en ese tenant). El paciente tiene que tener rol tipo `PATIENT`.
6. **Un paciente solo puede tener una cita activa a la vez** (`SCHEDULED` o `PROPOSED`, y con `endTime` futuro). Para moverla hay que **reagendar**, no crear otra.
7. **Solo el titular es nutricionista válido para una cita pedida por el paciente.** Si intenta pedir cita sin indicar nutricionista y todavía no tiene titular, se responde `409` con un mensaje pidiéndole contactar con el centro.

---

## 3. Base de datos

Migración nueva: `src/main/resources/db/migration/V45__add_assigned_nutritionist.sql`

```sql
ALTER TABLE user_tenant_role ADD COLUMN assigned_nutritionist_id UUID;

ALTER TABLE user_tenant_role
    ADD CONSTRAINT fk_utr_assigned_nutritionist
    FOREIGN KEY (assigned_nutritionist_id) REFERENCES app_user(id) ON DELETE SET NULL;

CREATE INDEX idx_utr_assigned_nutritionist
    ON user_tenant_role (tenant_id, assigned_nutritionist_id);
```

**Backfill**: se recorre el histórico y se asigna a cada paciente **el nutricionista de su cita más reciente** (`DISTINCT ON (patient_id, tenant_id) ... ORDER BY start_time DESC`). Los pacientes sin ninguna cita se quedan sin titular `NULL` hasta su primera cita.

> Si se borra un usuario nutricionista, los pacientes que tuviera asignados quedan con `assigned_nutritionist_id = NULL` (hay que reasignarlos).

---

## 4. Cambios de API

### 4.1 `TenantUserDto` — dos campos nuevos

Se añaden a la respuesta de `GET /tenant/{tenantId}/users`, `GET /tenant/{tenantId}/users/by-type/{userType}` y al `PUT` de reasignación:

| Campo | Tipo | Descripción |
|---|---|---|
| `assignedNutritionistId` | `UUID` \| `null` | ID del nutricionista titular. `null` si aún no tiene. |
| `assignedNutritionistName` | `string` \| `null` | Nombre completo (`firstName lastName`) del titular. `null` si aún no tiene. |

```json
{
  "id": "uuid-paciente",
  "email": "maria@example.com",
  "firstName": "María",
  "lastName": "García",
  "userType": "PATIENT",
  "roleCode": "PATIENT",
  "assignedNutritionistId": "uuid-nutricionista",
  "assignedNutritionistName": "Laura Pérez"
}
```

### 4.2 `POST /tenant/{tenantId}/appointments` — `nutritionistId` ahora es opcional

| Escenario | ¿Envía `nutritionistId`? | Resultado |
|---|---|---|
| **Staff** agenda | Sí (lo normal) | Se usa ese nutricionista — así se cubren suplencias sin tocar al titular |
| **Staff** agenda sin indicarlo | No | `400` `error.appointment_nutritionist_required` (el staff debe elegir) |
| **Paciente** pide cita | **No debe enviarlo** | El backend resuelve su **nutricionista titular** |
| **Paciente** pide cita y no tiene titular | No | `409` `error.appointment_no_nutritionist_assigned` |

Además, en la creación se aplica ahora:

- Si el paciente no tenía titular, **se le asigna** el de esa cita y se persiste.
- Si el paciente ya tiene una cita activa, `409` `error.appointment_patient_has_active`.

```bash
# Paciente pidiendo cita: sin nutritionistId
curl -X POST ".../tenant/$TENANT/appointments" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "patientId": "550e8400-e29b-41d4-a716-446655440000",
    "startTime": "2026-10-20T10:00:00Z",
    "typeId": "8c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7f",
    "notes": "Quiero retomar el seguimiento"
  }'
```

### 4.3 Nuevo endpoint: reasignar nutricionista titular

```
PUT /tenant/{tenantId}/users/{userId}/assigned-nutritionist
Permiso: MANAGE_USER
```

**Cuerpo:**
```json
{ "nutritionistId": "uuid-del-nutricionista" }
```

`nutritionistId: null` **desasigna** al paciente (queda sin titular).

**Response 200:** el `TenantUserDto` del paciente ya actualizado.

**Errores:**

| Código | `error` | Cuándo |
|---|---|---|
| `400` | `error.user_not_patient` | El usuario indicado no es un paciente del centro |
| `400` | `error.user_not_nutritionist` | El `nutritionistId` no es personal (`STAFF`) del centro |
| `404` | `error.user_not_found` | No existe ese usuario |
| `404` | `error.user_not_in_tenant` | El paciente o el nutricionista no pertenecen a ese centro |

### 4.4 `GET /tenant/{tenantId}/appointments/nutritionist/{nutritionistId}/patients` — nueva semántica

Cambia lo que devuelve:

| | Antes | Ahora |
|---|---|---|
| Criterio | Haber tenido **alguna cita** con ese nutricionista | Ser su **paciente asignado** (titular) |
| Paciente antiguo sin citas recientes | Aparecía | **Sigue apareciendo** ✅ |
| Paciente visto una vez por suplencia | Aparecía en la lista del suplente | **No aparece** (es del titular) ✅ |
| `lastAppointment` / `nextAppointment` | Solo sus citas con ese nutricionista | **Todas** las citas del paciente en el centro (incluye suplencias) |
| Paciente sin ninguna cita | No aparecía | **Aparece** con ambos campos `null` ✅ |

El formato de respuesta no cambia:

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

### 4.5 `PUT /tenant/{tenantId}/appointments/{appointmentId}` (reagendar) — refuerzos

- **El paciente debe enviar `startTime`.** Si no lo envía: `400` `error.appointment_reschedule_requires_start_time`. (Antes se aceptaba un reagendado "vacío" que solo cambiaba el estado a `PROPOSED`.)
- El staff puede seguir actualizando solo `typeId` / `notes` sin enviar `startTime`.
- `endTime` **siempre** se recalcula: `endTime` explícito → `startTime + durationMinutes` del tipo → duración actual. Ya no puede quedar un `endTime` descolgado del `startTime` (antes podía dar lugar a citas con fin anterior al inicio).
- Las validaciones de solapamiento / horario / festivos se ejecutan solo cuando el tramo horario cambia realmente.

---

## 5. Errores nuevos (i18n)

Los textos llegan ya resueltos en el idioma del usuario desde el `MessageSource` (bundles `Messages.properties`, `Messages_es.properties`, `Messages_en.properties`).

| Clave | ES | EN |
|---|---|---|
| `error.appointment_nutritionist_required` | Debes indicar el nutricionista al crear la cita | A nutritionist must be provided when creating an appointment |
| `error.appointment_no_nutritionist_assigned` | Todavía no tienes un nutricionista asignado. Contacta con el centro para tu primera cita | You don't have an assigned nutritionist yet. Contact the center for your first appointment |
| `error.appointment_patient_has_active` | Ya existe una cita próxima para este paciente. Usa el reagendado para cambiarla | This patient already has an upcoming appointment. Use reschedule to change it |
| `error.appointment_reschedule_requires_start_time` | Debes indicar la nueva fecha y hora para solicitar el reagendado | A new date and time are required to request a reschedule |

---

## 6. Instrucciones para el frontend (web / Angular)

### 6.1 Listado de pacientes del nutricionista

`GET /tenant/{tenantId}/appointments/nutritionist/{nutritionistId}/patients` ahora devuelve la **cartera real**. Consecuencias en la UI:

- Un paciente puede aparecer con `lastAppointment: null` y `nextAppointment: null` (asignado pero nunca atendido). **No romper el render por nulos** — mostrar "Sin citas todavía".
- Un paciente con `nextAppointment` próximo pero `lastAppointment` muy antiguo es exactamente el caso de "paciente que lleva tiempo sin venir". Es un buen candidato para un recordatorio/CTA de reactivación.
- No usar `lastAppointment` para deducir quién es el titular: viene del histórico completo del paciente.

### 6.2 Alta de paciente

- Al invitar a un paciente con `POST /tenant/{tenantId}/users/invite`, si estás logueado como `NUTRITIONIST` el paciente **se te asigna automáticamente**. Puedes leer el resultado en `TenantUserDto.assignedNutritionistId`.
- Si un `ADMIN` invita al paciente, en la respuesta vendrá `assignedNutritionistId: null`. La pantalla de ficha del paciente debería ofrecer el selector de nutricionista para asignarlo.

### 6.3 Selector de nutricionista titular

Nuevo endpoint `PUT /tenant/{tenantId}/users/{userId}/assigned-nutritionist`:

```ts
assignNutritionist(tenantId: string, userId: string, nutritionistId: string | null) {
  return this.http.put<TenantUser>(
    `${this.baseUrl}/tenant/${tenantId}/users/${userId}/assigned-nutritionist`,
    { nutritionistId }
  );
}
```

- Para poblar el desplegable, usar los usuarios del centro con `userType === 'STAFF'` (por ejemplo `GET /tenant/{tenantId}/users/by-type/STAFF`).
- Enviar `{ "nutritionistId": null }` para desasignar. Mostrar la opción "Sin asignar" / "Ninguno".
- El endpoint devuelve el `TenantUserDto` actualizado; refrescar la ficha con esa respuesta.

### 6.4 Formulario de cita — cuándo mostrar el campo "Nutricionista"

- **Staff** (`ADMIN` / `NUTRITIONIST`): el campo es **obligatorio**. Si el paciente ya tiene titular, **preseleccionarlo**; el staff puede cambiarlo (suplencia).
- **Paciente** en la app: el campo **no debe mostrarse**, no se envía `nutritionistId`.
  - Si el paciente tiene titular, la cita se crea igual que siempre (`PROPOSED`) y al nutricionista le llega el push de "Nueva solicitud de cita".
  - Si **no** tiene titular, la creación devuelve `409`. Mostrar un mensaje del estilo: *"Todavía no tienes nutricionista asignado. Contacta con el centro para tu primera cita."*
- Antes de mostrar el formulario de nueva cita a un paciente que **ya tiene una cita activa**, conviene consultar `GET /tenant/{tenantId}/appointments/patient/{patientId}` y ofrecer **"Reagendar"** en lugar de "Nueva cita" (el `POST` devolverá `409` `error.appointment_patient_has_active`).

### 6.5 Al reagendar como paciente

- `startTime` es **obligatorio** en el `PUT /appointments/{id}`. No reutilizar el flujo antiguo de "solo cambiar notas".
- No enviar `endTime` si se envía `typeId`: el backend recalcula el fin a partir de la duración del tipo.

---

## 7. Instrucciones para la app Flutter

### 7.1 Modelo

```dart
class TenantUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String userType; // STAFF | PATIENT
  final String? assignedNutritionistId;
  final String? assignedNutritionistName;
  // ...
}
```

Añadir `assignedNutritionistId` / `assignedNutritionistName` al `fromJson` como **opcionales** (`json['assignedNutritionistId'] as String?`).

### 7.2 Pedir cita (paciente)

```dart
Future<Appointment> requestAppointment({
  required String tenantId,
  required String patientId,
  required DateTime startTime,
  required String typeId,
  String? notes,
}) async {
  // IMPORTANTE: no enviar nutritionistId — el backend resuelve el titular.
  final body = {
    'patientId': patientId,
    'startTime': startTime.toUtc().toIso8601String(),
    'typeId': typeId,
    if (notes != null) 'notes': notes,
  };
  return api.post('/tenant/$tenantId/appointments', body);
}
```

Manejo de errores a contemplar explícitamente:

| HTTP | Mensaje a mostrar |
|---|---|
| `409` con `error.appointment_no_nutritionist_assigned` | "Todavía no tienes nutricionista asignado. Contacta con el centro para tu primera cita." |
| `409` con `error.appointment_patient_has_active` | "Ya tienes una cita próxima." + botón **Reagendar** → `PUT /appointments/{id}` con `startTime` |
| `400` con `error.appointment_in_past` | "La fecha debe ser futura" |
| `400` con `error.appointment_outside_operating_hours` | "Ese horario está fuera del horario del centro" |
| `400` con `error.center_closed_on_holiday` | "Ese día el centro está cerrado" |

### 7.3 Mostrar quién es "mi nutricionista"

No hay endpoint específico (a propósito). Para mostrarlo en la app:

- Al pedir cita, el `nutritionistName` de la respuesta de la cita ya identifica a quien la atiende.
- El perfil del paciente dentro del tenant puede exponer el titular añadiendo `assignedNutritionistId` / `assignedNutritionistName` al DTO que ya consume la app (mismo campo que devuelve el listado de usuarios del centro).

### 7.4 Reagendar

`PUT /tenant/{tenantId}/appointments/{appointmentId}` — enviar **siempre** `startTime` (y opcionalmente `typeId` / `notes`). La cita pasa a `PROPOSED` y se notifica al nutricionista.

---

## 8. Casos de uso

### 8.1 Paciente que lleva un año sin venir

1. Está en `user_tenant_role` con `assigned_nutritionist_id = <Laura>`, aunque su última cita sea de hace un año.
2. Sigue apareciendo en `GET /nutritionist/<Laura>/patients` con `lastAppointment` de hace un año.
3. Pide cita desde la app sin enviar `nutritionistId` → el backend resuelve a Laura.
4. Se crea la cita en `PROPOSED` y a Laura le llega el push. ✅

### 8.2 Suplencia

Laura está de baja. Su compañero Diego abre la agenda y crea la cita del paciente de Laura.

1. Diego envía `nutritionistId = <Diego>` en el `POST`.
2. La validación de solapamiento se hace contra la agenda de **Diego**.
3. El paciente **mantiene** a Laura como titular: sigue en la cartera de Laura y **no** aparece en la de Diego.
4. `lastAppointment`/`nextAppointment` del paciente sí reflejan esa cita con Diego (el histórico es del paciente, no del titular).

### 8.3 Reasignación definitiva

El paciente quiere cambiar de nutricionista:

`PUT /tenant/{tenantId}/users/{patientId}/assigned-nutritionist` con `{ "nutritionistId": "<Diego>" }`.

A partir de ahí aparece en la cartera de Diego y desaparece de la de Laura. El histórico de citas no se toca.

---

## 9. Archivos creados / modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V45__add_assigned_nutritionist.sql` | Nueva — columna `assigned_nutritionist_id`, FK, índice y backfill desde el histórico |
| `models/entity/UserTenantRole.java` | Nuevo campo `assignedNutritionist` (`@ManyToOne` LAZY) |
| `models/dto/TenantUserDto.java` | Nuevos campos `assignedNutritionistId` / `assignedNutritionistName` |
| `controller/dto/AssignNutritionistRequest.java` | Nuevo — `nutritionistId` (nullable) |
| `controller/dto/CreateAppointmentRequest.java` | `nutritionistId` deja de ser `@NotNull` |
| `controller/UserTenantRoleController.java` | Nuevo endpoint `PUT /{userId}/assigned-nutritionist` |
| `service/UserTenantRoleService.java` | `assignNutritionist(...)`, auto-asignación al invitar, nuevos campos del DTO |
| `service/AppointmentService.java` | `resolveNutritionist`, `assignTitularIfMissing`, `ensurePatientHasNoActiveAppointment`, refactor de `findPatientsByNutritionist`, fixes de `reschedule`, notificaciones post-commit |
| `repository/UserTenantRoleRepository.java` | `findByTenantIdAndAssignedNutritionistId(...)` |
| `repository/AppointmentRepository.java` | `findActiveByPatient(...)`, `findByPatientOrderByStartTimeDesc(...)`; se eliminan las consultas basadas en el histórico |
| `service/PushNotificationService.java` | Nuevo `notifyUserAfterCommit(...)` |
| `security/HasAccess.java` | Fix de NPE en `isAppointmentPatient` para citas sin paciente |
| `exception/ErrorResource.java` + `i18n/Messages*.properties` | 4 claves de error nuevas (ES/EN) |

---

## 10. Tests

Ficheros actualizados (408 tests en verde con `.\mvnw.cmd test`):

| Fichero | Qué cubre |
|---|---|
| `service/AppointmentServiceTest.java` | Paciente sin titular → `409`; paciente con titular → se usa; auto-asignación en primera cita; bloqueo de cita duplicada; `reschedule` sin `startTime` como paciente; "mis pacientes" por asignación (incluye paciente sin citas) |
| `service/UserTenantRoleServiceTest.java` | Auto-asignación al invitar siendo `NUTRITIONIST`; no asignación si quien invita es `ADMIN`; asignar / desasignar; rechazo de no-`STAFF` y de no-`PATIENT` |
| `controller/UserTenantRoleControllerTest.java` | `PUT .../assigned-nutritionist` con id y con `null` |
| `controller/AppointmentControllerTest.java` | `POST` acepta `nutritionistId` nulo (lo resuelve el servicio) |
