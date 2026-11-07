# Fase 0 — Endurecer contrato y plataforma

> **Duración estimada:** 4-5 semanas con 1 backend dedicado.  
> **Objetivo:** cerrar los agujeros de seguridad y contrato, corregir semántica de datos críticos y entregar los quick wins de producto que desbloquean el resto del roadmap.  
> **Entregable:** backend con contrato seguro, clave Gemini protegida, errores tipados, preferencias mergeables, enums cerrados, fechas de visita correctas, IMC histórico estable y estado clínico separado del acceso.

---

## 1. Decisiones de producto aplicables en esta fase

- Nutrientes: `HIDDEN` por defecto; la clínica decide si activar `MACROS` o `FULL`.
- Alta clínica: `DISCHARGED` mantiene acceso de solo lectura.
- API key Gemini: siempre clave del centro; se enmascara y cifra.

---

## 2. Tareas

### T1 — Enmascarar `geminiApiKey` y añadir `hasApiKey`

**Problema:** `TenantPreferences.geminiApiKey` se serializa en la vista `Public` y `GET /tenant/{tenantId}/profile` la expone a usuarios autenticados del tenant.

**Solución:**
1. Hacer la clave **write-only** en los DTOs de lectura.
2. Añadir `hasApiKey: boolean` a los DTOs que necesiten saber si está configurada.
3. Cifrar el valor en la columna JSONB `tenant.preferences` (o migrar a tabla de secretos).
4. Endpoint exclusivo para escribir/rotar la clave (o integrarlo en el PATCH de preferencias).

**Archivos a tocar:**
- `models/entity/TenantPreferences.java` — añadir `@JsonIgnore` a `geminiApiKey` o crear DTO separado.
- `models/dto/TenantBrandingDto.java` — ya expone `aiEnabled`; añadir `hasApiKey` si es necesario.
- `service/TenantService.java` — cifrado/descifrado al leer/escribir preferencias.
- `controller/TenantProfileController.java` / `TenantBrandingController.java` — asegurar que nunca se devuelve la clave.
- Migración Flyway para cifrar claves existentes.

**Criterios de aceptación:**
- [ ] Ningún endpoint GET devuelve `geminiApiKey`.
- [ ] Se devuelve `hasApiKey: true/false` donde el frontend lo necesite.
- [ ] La clave está cifrada en base de datos.
- [ ] Existe test de contrato que verifica la ausencia de la clave en la respuesta.

**Notas:**
- Si no hay KMS, usar una clave maestra en `application.yaml` con AES/GCM. Migrar después a KMS.
- No implementar modo "cuota incluida"; la clave es siempre del centro.

---

### T2 — Exponer `price` y `currency` en `AppointmentDto`

**Problema:** `Appointment` entidad persiste `price`, pero `AppointmentDto` no lo incluye.

**Solución:**
1. Añadir `price` y `currency` a `AppointmentDto`.
2. Añadir `currency` a `Tenant` (default `"EUR"`).
3. Migrar citas históricas: `UPDATE appointment SET currency = 'EUR' WHERE currency IS NULL`.

**Archivos a tocar:**
- `models/dto/AppointmentDto.java`
- `models/entity/Tenant.java`
- `service/AppointmentService.java` — método `toDto()`.
- `controller/AppointmentController.java` — no requiere cambios si solo cambia DTO.
- Migración Flyway: columna `currency` en `tenant` y `appointment`.

**Criterios de aceptación:**
- [ ] `GET /appointments/...` devuelve `price` y `currency`.
- [ ] `GET /appointments/revenue` sigue funcionando correctamente.
- [ ] Las citas nuevas copian `currency` del tenant al crearse.

---

### T3 — Errores con `ProblemDetail` + catálogo de códigos

**Problema:** `GlobalExceptionHandler` devuelve `{"error": "mensaje"}` sin código estable ni `traceId`.

**Solución:**
1. Refactorizar `GlobalExceptionHandler` para devolver `ProblemDetail` (RFC 9457).
2. Incluir campos: `type`, `title`, `status`, `detail`, `instance`, `code` (de `ErrorResource.getKey()`), `traceId`.
3. Añadir MDC/`traceId` a logs.
4. Para validaciones de bean, incluir `fieldErrors`.

**Archivos a tocar:**
- `exception/GlobalExceptionHandler.java`
- `exception/ErrorResource.java` — ya tiene `getKey()`.
- `exception/NotFoundException.java`, `ConflictException.java`, `ForbiddenException.java` — asegurar que llevan `ErrorResource`.
- `src/main/resources/i18n/Messages*.properties` — mantener traducciones.
- Tests de integración verificando el nuevo formato.

**Criterios de aceptación:**
- [ ] Todos los 4xx/5xx devuelven `ProblemDetail` con `code` estable.
- [ ] El `traceId` aparece en respuesta y logs.
- [ ] Los mensajes siguen traduciéndose según el locale.
- [ ] No se rompen tests existentes (o se actualizan acorde).

**Notas:**
- No es necesario migrar todos los endpoints a `ProblemDetail` en una sola PR; basta con cambiar el handler base. Los endpoints que devuelvan `Map.of("error", ...)` heredarán el nuevo formato automáticamente.

---

### T4 — OpenAPI con seguridad, summaries, media types y errores

**Problema:** `api-docs.json` no tiene `securitySchemes`, `summary`, media types ni respuestas de error documentadas.

**Solución:**
1. Configurar `@SecurityScheme` de tipo `bearer-jwt` en `SecurityConfig` o clase de configuración Springdoc.
2. Añadir `@Operation(summary = "...")` a todos los endpoints.
3. Añadir `@ApiResponse` para 4xx/5xx usando `ProblemDetail`.
4. Forzar media types correctos (`application/json`, `text/csv`, etc.).

**Archivos a tocar:**
- `config/SecurityConfig.java`
- Todos los `*Controller.java` — añadir `@Operation` y `@ApiResponse`.
- `application.yaml` — configuración de Springdoc.

**Criterios de aceptación:**
- [ ] `api-docs.json` incluye `securitySchemes` con bearer-jwt.
- [ ] Todas las operaciones tienen `summary`.
- [ ] Media types no son `*/*` salvo endpoints binarios justificados.
- [ ] Se documentan respuestas de error.

**Notas:**
- Se puede añadir un job de CI con `spectral lint` más adelante; en esta fase basta con que el OpenAPI generado sea válido y completo.

---

### T5 — `PATCH /tenant/{id}/preferences` único con merge

**Problema:** Hoy existen varios PUT que reemplazan el documento completo de preferencias, pudiendo borrar flags.

**Solución:**
1. Crear endpoint `PATCH /tenant/{id}/preferences`.
2. Crear DTO de patch con campos opcionales (`UpdateTenantPreferencesRequest`).
3. Servicio que mergea campo a campo con las preferencias actuales.
4. Validar valores por campo (ej. `attendanceTargetRate` entre 0 y 1).

**Archivos a tocar:**
- `controller/TenantProfileController.java` — nuevo PATCH.
- `controller/dto/UpdateTenantPreferencesRequest.java` (nuevo).
- `service/TenantService.java` — método `patchPreferences`.
- Tests de integración.

**Criterios de aceptación:**
- [ ] Un PATCH parcial no borra flags no incluidos.
- [ ] Se validan valores inválidos y se devuelve 400 con `ProblemDetail`.
- [ ] Los PUTs existentes siguen funcionando (no se eliminan, se marcan como deprecated).

---

### T6 — Enums `DayOfWeek` y `MealType` + migración legacy

**Problema:** `Meal.dayOfWeek` y `Meal.mealType` son `String` libres; datos inconsistentes.

**Solución:**
1. Crear enums `DayOfWeek` y `MealType`.
2. Migrar valores legacy a los enums (ej. "LUNES" → `DayOfWeek.MONDAY`).
3. Usar enums en DTOs de request/response.
4. Validar requests.

**Archivos a tocar:**
- `models/entity/DayOfWeek.java` (nuevo)
- `models/entity/MealType.java` (nuevo)
- `models/entity/Meal.java` — cambiar tipo de campo.
- `controller/dto/CreateMealRequest.java`, `UpdateMealRequest.java`, `CopyDayRequest.java`
- `service/MealService.java` — ajustar lógica que compare strings.
- `service/MenuService.java` / `MenuTemplateService.java` — copy-day, instantiate, etc.
- Migración Flyway: alterar columnas y convertir datos.

**Criterios de aceptación:**
- [ ] No quedan strings libres para día/tipo de comida.
- [ ] Migración correcta de datos existentes.
- [ ] PDF de menú y lista de la compra siguen funcionando.
- [ ] Front recibe valores estables (por ejemplo `MONDAY`, `LUNCH`).

**Notas:**
- Definir valores legacy esperados antes de migrar. Si hay valores inesperados, la migración debe fallar o mapearlos a `OTHER`.

---

### T7 — `joinedAt` por centro + `lastVisitDate` sin `NO_SHOW`

**Problema:**
- `TenantUserDto` no expone `joinedAt` (fecha de alta en el centro).
- `lastAppointmentDate` incluye `NO_SHOW`, lo cual sesga la noción de "última visita".

**Solución:**
1. Añadir `joinedAt` a `TenantUserDto` (mapeado desde `UserTenantRole.createdAt`).
2. Renombrar/separar en:
   - `lastVisitDate`: máxima cita `COMPLETED`.
   - `lastNoShowDate`: máxima cita `NO_SHOW`.
3. Ajustar queries en `AppointmentRepository` y `UserTenantRoleService`.
4. Actualizar export CSV.

**Archivos a tocar:**
- `models/dto/TenantUserDto.java`
- `models/dto/NutritionistPatientDto.java` (si aplica)
- `service/UserTenantRoleService.java`
- `repository/AppointmentRepository.java` — `findLastAppointmentDates` separar en `findLastVisitDates` / `findLastNoShowDates`.
- Export CSV en `UserTenantRoleService.exportUsersCsv`.

**Criterios de aceptación:**
- [ ] El listado de pacientes muestra `joinedAt` real del centro.
- [ ] `lastVisitDate` solo considera citas `COMPLETED`.
- [ ] `lastNoShowDate` se muestra por separado.
- [ ] Export CSV incluye ambas fechas.

---

### T8 — `heightCm` snapshot en medición + IMC estable

**Problema:** El IMC histórico se calcula con la altura actual del usuario, por lo que informes antiguos cambian.

**Solución:**
1. Añadir `heightCm` a `BodyMeasurement`.
2. Migrar: rellenar `heightCm` de mediciones históricas con la altura actual del usuario.
3. Calcular BMI usando `heightCm` de la medición.
4. Ajustar `MeasurementHistoryDto` y `BodyMeasurementService.computeBmi`.

**Archivos a tocar:**
- `models/entity/BodyMeasurement.java`
- `models/dto/BodyMeasurementDto.java` — añadir `heightCm`.
- `service/BodyMeasurementService.java` — `computeBmi(weight, heightCm)`.
- `service/UserTenantRoleService.java` — cálculo de `lastMeasurement.bmi`.
- Migración Flyway.

**Criterios de aceptación:**
- [ ] Cada medición guarda su propia altura.
- [ ] El IMC histórico no cambia al modificar la altura del usuario.
- [ ] Si una medición no tiene altura, usa la del usuario como fallback (solo legacy).

---

### P1 — Estado clínico separado del acceso

**Problema:** Hoy `enabled`/`disabledAt` deshabilita Keycloak y corta todo acceso; no hay noción de "alta clínica".

**Solución:**
1. Añadir a `UserTenantRole`:
   - `clinicalStatus`: enum `ONBOARDING | ACTIVE | PAUSED | DISCHARGED | DROPPED_OUT`.
   - `clinicalStatusReason` (String).
   - `clinicalStatusChangedAt` (Instant).
2. Crear tabla `clinical_status_history` para trazabilidad.
3. Endpoint: `PATCH /tenant/{tenantId}/users/{userId}/clinical-status`.
4. Endpoint: `GET /tenant/{tenantId}/users/{userId}/clinical-status/history`.
5. Reglas:
   - `DISCHARGED`: login permitido, solo lectura de historial.
   - `PAUSED`/`DROPPED_OUT`: cortar funcionalidad activa (nuevas citas, menús, diario) pero mantener lectura.
   - `enabled`/`disabledAt` sigue controlando el acceso real (Keycloak).

**Archivos a tocar:**
- `models/entity/ClinicalStatus.java` (nuevo enum)
- `models/entity/UserTenantRole.java`
- `models/entity/ClinicalStatusHistory.java` (nuevo)
- `repository/ClinicalStatusHistoryRepository.java` (nuevo)
- `service/UserTenantRoleService.java` — métodos de cambio de estado.
- `controller/UserTenantRoleController.java` — nuevos endpoints.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Se puede cambiar estado clínico sin tocar `enabled`.
- [ ] `DISCHARGED` permite login y lectura.
- [ ] El historial de estados es trazable.
- [ ] El listado de pacientes puede filtrar/ordenar por estado clínico.

---

### P2 — Toggle de nutrientes por centro

**Problema:** No hay forma de ocultar/mostrar nutrientes según la filosofía del centro.

**Solución:**
1. Añadir `nutrientDisplayMode` a `TenantPreferences`: `HIDDEN | MACROS | FULL`, default `HIDDEN`.
2. Aplicar filtro en:
   - `GET /menu/{id}/nutrition`
   - PDF de menú
   - Respuestas de alimentos (si aplica).
3. Cuando `HIDDEN`, los endpoints devuelven datos mínimos o vacíos para nutrientes.

**Archivos a tocar:**
- `models/entity/TenantPreferences.java`
- `service/MenuService.java` o servicio de nutrición.
- Generación de PDF de menú.

**Criterios de aceptación:**
- [ ] Default `HIDDEN` para tenants nuevos.
- [ ] Los endpoints respetan el modo configurado.
- [ ] El PDF no muestra nutrientes si el centro los tiene ocultos.

---

### T21 — Integración transversal con MinIO

**Problema:** Los archivos binarios (logos, PDFs, imágenes de recetas, adjuntos de chat, labs) se almacenan hoy en PostgreSQL (`bytea`) o no tienen un almacén común. MinIO ya está desplegado y debe ser el almacén oficial de objetos.

**Solución:**
1. Configurar cliente S3/MinIO en el backend.
2. Crear un servicio común de almacenamiento con:
   - `upload(bucket, path, bytes, contentType)`.
   - `delete(bucket, path)`.
   - `presignedUrl(bucket, path, ttl)`.
3. Crear tabla `stored_file` para metadata:
   - `id`, `tenant_id`, `bucket`, `path`, `content_type`, `size_bytes`, `entity_type`, `entity_id`, `created_at`.
4. Bucket **privado**: ningún archivo se sirve por URL pública directa; siempre URL firmada con TTL.
5. Migrar logos de tenant (`tenant.tenant_logo`, `tenant.tenant_logo_pdf`) a MinIO de forma progresiva.
6. Dejar preparado el servicio para que P4 (recetas), P6 (PDFs), P7 (chat), P14 (contenido) y P15 (labs) lo reutilicen sin volver a integrar MinIO.

**Archivos a tocar:**
- `pom.xml` — dependencia de MinIO/S3 (por ejemplo, `io.minio:minio` o AWS SDK v2).
- `application.yaml` — `minio.endpoint`, `minio.access-key`, `minio.secret-key`, `minio.bucket`, `minio.presigned-ttl`.
- `config/MinioConfig.java` (nuevo) — bean de cliente.
- `service/StorageService.java` (nuevo) — subida, borrado y URL firmada.
- `models/entity/StoredFile.java` (nuevo) y repositorio.
- `controller/TenantBrandingController.java` — logos desde MinIO.
- `service/TenantService.java` — sustituir `byte[]` por referencia a MinIO.
- Migración Flyway: tabla `stored_file` y columnas de referencia en `tenant`.

**Criterios de aceptación:**
- [ ] Se pueden subir, borrar y servir archivos privados mediante URL firmada.
- [ ] Los logos de tenant se sirven desde MinIO (o queda un fallback temporal documentado).
- [ ] No se añaden nuevos `bytea` para archivos; los existentes se migran progresivamente.
- [ ] El servicio es reutilizable por recetas, chat, contenido y labs.
- [ ] Las URLs firmadas tienen TTL configurable y no exponen credenciales.

**Notas:**
- MinIO ya está desplegado; no se incluye su instalación en el roadmap.
- Si la migración de logos existentes es costosa, puede hacerse en dos pasos: primero soporte dual (bytea o MinIO), después migración completa.

---

## 3. Dependencias internas de la fase

```
T1, T2, T5, P2  ->  afectan a TenantPreferences / Tenant
T6               ->  bloquea P3 (intercambios) y P4/P5/P6 (recetas/diario/PDF)
T7, T8, P1       ->  afectan listados y perfiles; deben estar antes de Fase 1
T3, T4           ->  transversales, pueden hacerse en paralelo con otras
T21              ->  bloquea P4, P6, P7, P14 y P15 (cualquier adjunto binario)
```

## 4. Checklist de cierre de fase

- [ ] Todos los endpoints GET ocultan `geminiApiKey`.
- [ ] `AppointmentDto` incluye `price` y `currency`.
- [ ] Errores devuelven `ProblemDetail` con `code` y `traceId`.
- [ ] OpenAPI incluye seguridad bearer-jwt y summaries.
- [ ] `PATCH /tenant/{id}/preferences` mergea sin borrar flags.
- [ ] `DayOfWeek` y `MealType` son enums; datos migrados.
- [ ] `TenantUserDto` incluye `joinedAt`, `lastVisitDate` y `lastNoShowDate`.
- [ ] `BodyMeasurement` guarda `heightCm` y el IMC histórico es estable.
- [ ] Estado clínico separado del acceso, con historial.
- [ ] Nutrientes configurables por centro (`HIDDEN/MACROS/FULL`).
- [ ] MinIO integrado con `StorageService`, bucket privado y URLs firmadas.
- [ ] Logos de tenant servidos desde MinIO (o fallback temporal documentado).
- [ ] Tests pasan y aplicación compila.
- [ ] `doc/contrato-api/breaking-changes.md` actualizado con cambios en DTOs.

---

## 5. Siguiente fase

La Fase 0B (suscripciones con Stripe) depende de:

- **T2**: `currency` en `Tenant` y en `AppointmentDto`.
- **T3**: errores `ProblemDetail` con `code`, necesarios para `TENANT_SUSPENDED`.
- **T5**: `PATCH /tenant/{id}/preferences` mergeable.

Ver [`fase-0b-suscripciones.md`](fase-0b-suscripciones.md).
