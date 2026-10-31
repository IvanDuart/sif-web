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

Documento completo: **`doc/appointments/relacion_paciente_nutricionista.md`**.

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

---

## 6. Errores en formato `ProblemDetail` (`T3`)

### ¿Qué cambió?

Todos los errores 4xx/5xx dejan de devolver `{ "error": "..." }` y pasan a devolver un `ProblemDetail` (RFC 9457) con código estable y `traceId`.

### Formato antiguo

```json
{ "error": "Usuario no encontrado" }
```

### Formato nuevo

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Usuario no encontrado",
  "instance": "/api/tenant/.../users/...",
  "code": "error.user_not_found",
  "traceId": "4f1c2f0e-..."
}
```

En errores de validación se añade además:

```json
{
  "fieldErrors": [
    { "field": "email", "message": "must not be blank" }
  ]
}
```

### Acción requerida en frontend y app

1. Leer el mensaje de `detail` en lugar de `error`.
2. Usar `code` para lógica de negocio (por ejemplo, `error.appointment_overlap`) en lugar de comparar textos.
3. Enviar `X-Request-Id` si se quiere correlacionar la traza del cliente con los logs del backend.
4. Mostrar o registrar `traceId` en pantallas de error para soporte.

---

## 7. Precio y moneda en citas (`T2`)

### ¿Qué cambió?

`AppointmentDto` ahora expone el precio congelado de la cita y su moneda. La moneda del centro se guarda en `tenant.currency` (por defecto `EUR`).

### Aditivo (no rompe)

```json
{
  "id": "...",
  "price": 50.00,
  "currency": "EUR",
  "...": "..."
}
```

- `GET /appointments/...` devuelve `price` y `currency`.
- `GET /appointments/revenue` sigue devolviendo el total, pero la moneda sale de `tenant.currency`.
- Las citas nuevas copian `currency` del tenant al crearse.
- Las citas históricas se migran a `EUR`.

### Acción requerida en frontend y app

1. Mostrar el importe con `price` + `currency` (usar `Intl.NumberFormat` con la moneda recibida).
2. No asumir `EUR` en clientes antiguos: leer siempre `currency` de la cita o del perfil del centro.

---

## 8. PATCH parcial de preferencias del centro (`T5`)

### ¿Qué cambió?

Se añade un endpoint único para modificar preferencias sin reemplazar el documento completo:

```http
PATCH /api/tenant/{tenantId}/preferences
Content-Type: application/json

{
  "ai_enabled": true,
  "attendance_target_rate": 0.92
}
```

Solo se modifican los campos enviados. Los omitidos conservan su valor actual.

### Compatibilidad

- Los `PUT` antiguos siguen funcionando, pero quedan **deprecados**:
  - `PUT /tenant/{tenantId}/profile/preferences`
  - `PUT /tenant/{tenantId}/branding/preferences`
- Validaciones nuevas: `attendance_target_rate` entre `0` y `1`, `cancellation_notice_threshold_hours >= 0`, `primary_color` con formato `#RRGGBB`.

### Acción requerida en frontend y app

1. Migrar las pantallas de configuración al `PATCH`.
2. Dejar de reenviar el documento completo de preferencias.
3. Manejar `400 ProblemDetail` con `fieldErrors` si algún valor no es válido.

---

## 9. Clave Gemini write-only y cifrada (`T1`)

### ¿Qué cambió?

`geminiApiKey` deja de serializarse en cualquier respuesta. Se guarda cifrada en `tenant.preferences` y se expone un booleano `api_key_configured` (o `hasApiKey` en branding) para saber si hay clave sin revelarla.

### Antes

```json
{
  "aiEnabled": true,
  "geminiApiKey": "AIza..."
}
```

### Ahora

```json
{
  "ai_enabled": true,
  "api_key_configured": true
}
```

La clave se envía en el `PATCH` de preferencias (acepta `gemini_api_key` o `geminiApiKey`) o en el endpoint dedicado:

```json
{ "gemini_api_key": "AIza..." }
```

```http
PUT /tenant/{tenantId}/preferences/ai-key
{ "apiKey": "AIza..." }
```

Nunca se devuelve en ningún `GET`.

### Migración

`V49__encrypt_gemini_api_keys` cifra las claves existentes con AES/GCM. La clave maestra se configura con `TENANT_SECRET_KEY` (base64 de 32 bytes). El valor por defecto del repositorio es **solo para desarrollo**.

### Acción requerida en frontend y app

1. Dejar de leer `geminiApiKey` de las respuestas.
2. Usar `api_key_configured` (preferencias) o `hasApiKey` (branding) para saber si la integración está configurada.
3. Enviar la clave solo al guardarla/rotarla mediante `PATCH /tenant/{tenantId}/preferences` o `PUT /tenant/{tenantId}/preferences/ai-key`.
4. No cachear ni registrar la clave en logs del cliente.

---

## 10. Visibilidad de nutrientes por centro (`P2`)

### ¿Qué cambió?

Cada centro decide cuánto detalle nutricional se muestra. Nueva preferencia `nutrient_display_mode`:

| Valor | Comportamiento |
|---|---|
| `HIDDEN` (por defecto) | `GET /menu/{id}/nutrition` devuelve `total` y `days` vacíos y `nutrients` vacíos por comida. |
| `MACROS` | Solo energía y macronutrientes principales (`ENERC_KCAL`, `PROT`, `FAT`, `CHOCDF`, `FIBTG`, `SUGAR`). |
| `FULL` | Todos los nutrientes, como hasta ahora. |

El modo se cambia con `PATCH /tenant/{tenantId}/preferences`:

```json
{ "nutrient_display_mode": "MACROS" }
```

### Acción requerida en frontend y app

1. No asumir que `total`/`days`/`nutrients` vienen siempre completos.
2. Ocultar la sección de nutrientes cuando el centro tenga `HIDDEN`.
3. Si se muestra la barra de macros, usar solo las claves presentes en la respuesta.

---

## 11. Altura congelada en mediciones e IMC estable (`T8`)

### ¿Qué cambió?

Cada `BodyMeasurement` guarda la altura (`height_cm`) con la que se tomó. El IMC se calcula con esa altura, no con la altura actual del paciente, de modo que los informes históricos no cambian si el paciente se mide de nuevo.

### Aditivo (no rompe)

- `POST /users/{userId}/measurements` y `PUT /measurements/{measurementId}` aceptan `heightCm` opcional.
- Si se omite en el alta, se copia `app_user.height_cm`.
- `BodyMeasurementDto` y `MeasurementHistoryDto.points[]` incluyen `heightCm`.

### Migración

`V50__body_measurement_height_cm.sql` añade la columna y rellena las mediciones históricas con la altura actual del paciente.

### Acción requerida en frontend y app

1. Enviar `heightCm` si la toma incluye una altura distinta a la del perfil.
2. Mostrar el IMC usando el `heightCm` devuelto por la medición.
3. No recalcular el IMC histórico con la altura actual del paciente.

---

## 12. Alta en el centro y separación visita/ausencia (`T7`)

### ¿Qué cambió?

`TenantUserDto` separa la última visita real de la última ausencia y añade la fecha de alta en el centro.

| Antes | Ahora |
|---|---|
| `lastAppointmentDate` (mezclaba `COMPLETED` y `NO_SHOW`) | `lastVisitDate` (solo `COMPLETED`) + `lastNoShowDate` (solo `NO_SHOW`) |
| — | `joinedAt` (`user_tenant_role.created_at`) |

También cambia `NutritionistPatientDto`: `lastAppointment` pasa a `lastVisitDate` y se añade `lastNoShowDate`.

### Acción requerida en frontend y app

1. Sustituir `lastAppointmentDate` por `lastVisitDate` y `lastNoShowDate`.
2. Mostrar `joinedAt` en la ficha/listado de pacientes.
3. Si se ordena por última visita, usar `sort=lastVisitDate,desc`; para ausencias, `sort=lastNoShowDate,desc`.
4. El CSV exportado añade las columnas `Alta`, `Ultima visita`, `Ultima ausencia` y mantiene `Proxima cita`.

Documento actualizado: `doc/patients/listado_pacientes_frontend.md`.

---

## 13. Enums `DayOfWeek` y `MealType` (`T6`)

### ¿Qué cambió?

`dayOfWeek` y `mealType` dejan de ser texto libre. Ahora son enums cerrados y la base de datos guarda los nombres ingleses.

| Campo | Valores |
|---|---|
| `dayOfWeek` | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY`, `OTHER` |
| `mealType` | `BREAKFAST`, `MID_MORNING`, `LUNCH`, `SNACK`, `DINNER`, `OTHER` |

### Compatibilidad de entrada

Al escribir se aceptan los valores legacy en español y los nombres ingleses:

- `LUNES` → `MONDAY`
- `MIERCOLES` / `MIÉRCOLES` → `WEDNESDAY`
- `DESAYUNO` → `BREAKFAST`
- `MEDIA_MAÑANA` → `MID_MORNING`
- `COMIDA` / `ALMUERZO` → `LUNCH`
- `MERIENDA` → `SNACK`
- `CENA` → `DINNER`
- `FESTIVO` → `OTHER`

Las respuestas siempre devuelven el nombre inglés.

### Migración

`V51__meal_enums_dayofweek_mealtype.sql` normaliza `meal` y `meal_template`, y añade `CHECK` constraints para impedir valores fuera del enum.

### Acción requerida en frontend y app

1. Enviar `dayOfWeek`/`mealType` en inglés.
2. Si se guardan valores localizados para pintar, hacer el mapeo en el cliente; no volver a enviarlos en español.
3. `copy-day` usa el mismo enum: `{"from":"MONDAY","to":"WEDNESDAY"}`.
4. Manejar `400` si llega un valor desconocido.

---

## 14. Estado clínico separado del acceso (`P1`)

### ¿Qué cambió?

Se añade un estado clínico por paciente y centro, independiente de `app_user.enabled` y de Keycloak.

| Estado | Escritura |
|---|---|
| `ONBOARDING` | Permitida |
| `ACTIVE` | Permitida |
| `PAUSED` | Solo lectura |
| `DISCHARGED` | Solo lectura |
| `DROPPED_OUT` | Solo lectura |

### Endpoints nuevos

- `PATCH /tenant/{tenantId}/users/{userId}/clinical-status`
- `GET /tenant/{tenantId}/users/{userId}/clinical-status/history`

### Campos nuevos

`TenantUserDto` añade:

- `clinicalStatus`
- `clinicalStatusReason`
- `clinicalStatusChangedAt`

### Comportamiento

- `PAUSED`, `DISCHARGED` y `DROPPED_OUT` permiten login y lecturas, pero cualquier escritura bajo `/tenant/{tenantId}/...` devuelve `403` con `code = error.clinical_status_read_only`.
- `enabled`/`disabledAt` siguen controlando el acceso real.
- El listado de pacientes acepta `?clinicalStatus=...` y `sort=clinicalStatus,asc|desc` (alias `estadoClinico`).
- El CSV añade la columna `Estado clinico`.

### Acción requerida en frontend y app

1. Mostrar el estado clínico en la ficha y el listado.
2. Ocultar acciones de escritura para estados de solo lectura.
3. Diferenciar claramente “estado clínico” de “acceso habilitado/deshabilitado”.
4. Consultar el historial antes de cambiar el estado si se quiere mostrar contexto al usuario.

Documento completo: `doc/patients/clinical-status.md`.

---

## 15. Almacenamiento en MinIO (`T21`)

### ¿Qué cambió?

Los binarios privados pasan a almacenarse en MinIO. Los logos de tenant nuevos ya no se guardan como `bytea` en PostgreSQL.

### Endpoints de logo

- `GET /tenant/{tenantId}/branding/logo`
- `GET /tenant/{tenantId}/branding/logo-pdf`

Si el logo está en MinIO devuelven `302 Found` con `Location` apuntando a una URL firmada con TTL. Si aún es legacy, devuelven los bytes como antes.

### Subida

`PUT /tenant/{tenantId}/branding/logo` y `PUT .../logo-pdf` guardan en MinIO y persisten solo la ruta (`tenant_logo_path` / `tenant_logo_pdf_path`).

### Migración

`V53__stored_file_and_tenant_logo_paths.sql` crea `stored_file` y las columnas de ruta. `TenantLogoMigration` migra los `bytea` existentes al arrancar; si MinIO no está disponible, conserva el fallback y reintenta.

### Acción requerida en frontend y app

1. Seguir los redirects `302` de los endpoints de logo (no asumir `image/png` directo).
2. No cachear URLs firmadas más allá de su TTL.
3. No construir URLs públicas de MinIO: siempre usar el endpoint del backend.
4. Para PDFs, el backend resuelve el logo internamente; no es necesario descargarlo en el cliente.

Documento completo: `doc/architecture/minio-storage.md`.
