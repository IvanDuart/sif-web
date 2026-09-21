# Breaking Changes

## 1. Paginación — nuevo formato de respuesta

### ¿Qué cambió?

Se activó `VIA_DTO` en `@EnableSpringDataWebSupport`. Los endpoints que devuelven páginas ahora usan el formato `PagedModel` en lugar de `PageImpl`.

### Formato antiguo (PageImpl)

```json
{
  "content": [...],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 10,
    "sort": { "empty": false, "sorted": true, "unsorted": false },
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "last": false,
  "totalPages": 5,
  "totalElements": 42,
  "size": 10,
  "number": 0,
  "sort": { "empty": false, "sorted": true, "unsorted": false },
  "first": true,
  "numberOfElements": 10,
  "empty": false
}
```

### Formato nuevo (PagedModel / VIA_DTO)

```json
{
  "content": [...],
  "page": {
    "size": 10,
    "number": 0,
    "totalElements": 42,
    "totalPages": 5
  }
}
```

### Endpoints afectados

| Controlador | URL |
|---|---|
| `MenuController` | `GET /api/tenant/{tenantId}/menu?page=...` |
| `MenuTemplateController` | `GET /api/tenant/{tenantId}/menu-template?page=...` |
| `MealController` | `GET /api/tenant/{tenantId}/meal?page=...` |
| `TenantController` | `GET /api/tenants?page=...` |
| `BodyMeasurementController` | `GET /api/tenant/{tenantId}/users/{userId}/measurements?page=...` |

### Adaptación frontend

Reemplazar el parseo actual de `PageImpl` por uno que lea `content` + `page { size, number, totalElements, totalPages }`. Se recomienda un wrapper/helper centralizado.

---

## 2. Filtrado de usuarios por tipo — cambio de URL

### ¿Qué cambió?

Se eliminó la ambigüedad entre `GET /users/{userType}` y `GET /users/{userId}` moviendo el filtro por tipo a una ruta con prefijo.

### URL antigua (rota)

```
GET /api/tenant/{tenantId}/users/STAFF
GET /api/tenant/{tenantId}/users/PATIENT
```

### URL nueva

```
GET /api/tenant/{tenantId}/users/by-type/STAFF
GET /api/tenant/{tenantId}/users/by-type/PATIENT
```

### URL sin cambios

```
GET /api/tenant/{tenantId}/users                    → listar todos
GET /api/tenant/{tenantId}/users/{userId}            → usuario concreto
GET /api/tenant/{tenantId}/users/{userId}/role       → cambiar rol
DELETE /api/tenant/{tenantId}/users/{userId}         → revocar acceso
GET /api/tenant/{tenantId}/users/invite              → invitar
```

### ¿Por qué?

Spring MVC registraba ambas rutas como `/{variable}` y no podía discriminarlas, lanzando `Ambiguous handler methods mapped` (error 500) al intentar acceder a cualquiera de las dos.

---

## 3. Nuevos endpoints — CRUD de MealTemplate en MenuTemplate

### ¿Qué cambió?

No rompe nada. Se añadieron 3 endpoints aditivos para gestionar platos individualmente dentro de una plantilla.

### Endpoints nuevos

| Método | Ruta | Permiso |
|---|---|---|
| `POST` | `/tenant/{tenantId}/menu-template/{templateId}/meals` | `MANAGE_TEMPLATE` |
| `PUT` | `/tenant/{tenantId}/menu-template/{templateId}/meals/{mealId}` | `MANAGE_TEMPLATE` |
| `DELETE` | `/tenant/{tenantId}/menu-template/{templateId}/meals/{mealId}` | `MANAGE_TEMPLATE` |

### Request body (POST/PUT)

```json
{
  "dayOfWeek": "MONDAY",
  "mealType": "LUNCH",
  "description": "Pechuga de pollo con arroz"
}
```

### Response (POST/PUT)

`MealTemplate` con vista `JsonViews.Public`: `{ id, dayOfWeek, mealType, description }`.

### ¿Por qué?

Permite al frontend tener una página de detalle navegable de plantilla con edición incremental, sin tener que enviar toda la plantilla cada vez que se añade/edita/elimina un plato.

---

## 4. Sin cambios

- `/users/me` y `/tenant/{tenantId}/users/me` mantienen su forma JSON (`memberships[]` con `tenantId`, `tenantName`, `userType`, `roleCode`, `permissions[]`).
- Todos los demás endpoints no listados arriba no fueron modificados.

---

## 5. Relación paciente → nutricionista explícita (`V45`)

### ¿Qué cambió?

La relación entre paciente y nutricionista deja de derivarse del histórico de citas y pasa a estar **persistida** (`user_tenant_role.assigned_nutritionist_id`). Un paciente tiene **un único nutricionista titular** por centro.

Documento completo: **`doc/relacion_paciente_nutricionista.md`**.

### Cambios que rompen compatibilidad

| # | Antes | Ahora |
|---|---|---|
| 1 | `POST /appointments` exigía `nutritionistId` (`@NotNull` → 400 si faltaba) | `nutritionistId` es **opcional**. El **staff** sigue obligado a enviarlo (ahora responde `400` desde el servicio); el **paciente no debe enviarlo** y el backend resuelve su titular |
| 2 | Un paciente podía acumular varias citas activas | Si ya tiene una `SCHEDULED`/`PROPOSED` futura → `409` `error.appointment_patient_has_active`. Hay que **reagendar** |
| 3 | `GET /nutritionist/{id}/patients` = pacientes con **alguna cita** con él | = pacientes **asignados** como titulares. Pacientes antiguos sin citas recientes siguen apareciendo; pacientes atendidos solo por suplencia ya no aparecen en la lista del suplente. `lastAppointment`/`nextAppointment` ahora consideran **todas** las citas del paciente |
| 4 | Un paciente podía hacer `PATCH /appointments/{id}` sin `startTime` (reagendado "vacío") | `400` `error.appointment_reschedule_requires_start_time` |
| 5 | `endTime` podía quedar descolgado del `startTime` | El `endTime` **siempre** se recalcula (explícito → duración del tipo → duración actual) |

### Aditivo (no rompe)

- Nuevo endpoint `PUT /tenant/{tenantId}/users/{userId}/assigned-nutritionist` (permiso `MANAGE_USER`), body `{ "nutritionistId": "uuid" | null }`.
- `TenantUserDto` añade `assignedNutritionistId` y `assignedNutritionistName`.
- 4 claves de error nuevas (ES/EN): `error.appointment_nutritionist_required`, `error.appointment_no_nutritionist_assigned`, `error.appointment_patient_has_active`, `error.appointment_reschedule_requires_start_time`.

### Migración de datos

`V45__add_assigned_nutritionist.sql` añade la columna, la FK (`ON DELETE SET NULL`), un índice `(tenant_id, assigned_nutritionist_id)` y hace **backfill**: cada paciente queda asignado al nutricionista de su cita más reciente. Los pacientes sin citas quedan sin titular hasta su primera cita.

### Acción requerida en frontend y app

1. **App (paciente)**: dejar de enviar `nutritionistId` al pedir cita y manejar el `409` \"sin nutricionista asignado\" (mensaje: contactar con el centro).
2. **App (paciente)**: antes de mostrar \"Nueva cita\", comprobar si ya hay cita activa y ofrecer **Reagendar** (que ahora exige `startTime`).
3. **Web (staff)**: en el formulario de cita, preseleccionar el titular del paciente y permitir cambiarlo (suplencia). El campo sigue siendo obligatorio.
4. **Web (staff)**: añadir el selector de nutricionista titular en la ficha del paciente usando el nuevo `PUT`; mostrar `assignedNutritionistName` en los listados.
