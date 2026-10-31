# Fase 2 — Conectar

> **Duración estimada:** 6-7 semanas con 1 backend dedicado.  
> **Objetivo:** conectar a pacientes y profesionales mediante chat, mejorar la gestión de agenda con recurrencia y lista de espera, integrar dispositivos/calendarios externos y sentar las bases de auditoría.  
> **Entregable:** chat funcional, recurrencia de citas, lista de espera, importación InBody, sincronización Google Calendar y trazabilidad de escrituras clínicas.

---

## 1. Decisiones de producto aplicables en esta fase

- Chat: texto + imágenes con límite de tamaño.
- Suscripción: gestionada en Fase 0B con Stripe; esta fase no añade cobros por cita ni pagos a profesionales.
- Reserva pública: fuera de roadmap; solo se deja preparado el terreno.

---

## 2. Prerrequisitos (deben venir de Fase 0 y 1)

- T3/T4 (errores/OpenAPI) y T13 (buzón de notificaciones) funcionales.
- T21 (MinIO) operativo con `StorageService` reutilizable.
- Redis operativo.
- T11 (timezone) estable.

---

## 3. Tareas

### P7 — Chat v1 (SSE + push + imágenes)

**Problema:** No hay comunicación directo-paciente en la plataforma.

**Solución:**
1. Modelo:
   - `chat_thread` (id, tenant_id, patient_id, nutritionist_id, created_at)
   - `chat_message` (id, thread_id, sender_id, content, sent_at)
   - `chat_attachment` (id, message_id, stored_file_id, file_name, content_type, size_bytes)
2. Un hilo por `(tenant, patient, nutritionist)`.
3. Endpoints:
   - `GET /tenant/{id}/threads`
   - `GET /tenant/{id}/threads/{threadId}/messages?before=&limit=`
   - `POST /tenant/{id}/threads/{threadId}/messages`
   - `GET /tenant/{id}/threads/{threadId}/stream` (SSE)
   - `PATCH /tenant/{id}/threads/{threadId}/read`
4. Adjuntos:
   - Solo imágenes, límite de tamaño (ej. 5 MB) y tipos MIME permitidos.
   - Se almacenan en **MinIO** mediante `StorageService` (T21).
   - Se sirven como URLs firmadas con TTL; nunca por URL pública directa.
5. Push al receptor cuando llega mensaje nuevo.
6. SSE con Redis pub/sub para multi-nodo.

**Archivos a tocar:**
- Nuevas entidades, repos, servicios, controladores.
- `service/PushNotificationService.java` — notificación de nuevo mensaje.
- `service/NotificationService.java` — persistir notificación de chat.
- `service/StorageService.java` — subida y URL firmada de imágenes (T21).
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Paciente y nutricionista pueden intercambiar mensajes dentro de un hilo.
- [ ] Los adjuntos de imagen se almacenan en MinIO y se sirven por URL firmada.
- [ ] Se valida tamaño y MIME antes de subir.
- [ ] El receptor recibe push/SSE en tiempo real.
- [ ] No se incluyen datos clínicos sensibles en el push.
- [ ] `GET /messages` soporta paginación cursor-based.

**Notas:**
- Validar que el usuario pertenece al hilo antes de permitir lectura/escritura.
- Considerar moderación básica (no datos sensibles, no spam) en futuras fases.

---

### P9 — Recurrencia de citas

**Problema:** Hoy cada cita se crea individualmente.

**Solución:**
1. Modelo:
   - `appointment_recurrence` (id, tenant_id, nutritionist_id, patient_id, type_id, start_time, rrule, count, until, created_at)
   - Las citas generadas siguen en la tabla `appointment` con `recurrence_id`.
2. Endpoint:
   - `POST /tenant/{id}/appointments/recurrence`
3. Validar solapes para toda la serie generada.
4. Permitir editar toda la serie o una instancia concreta (decidir scope; recomendación: serie completa en v1).

**Archivos a tocar:**
- Nuevas entidades, repos.
- `service/AppointmentService.java` — generar citas desde recurrencia.
- `controller/AppointmentController.java`.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Se puede crear una serie de citas recurrentes.
- [ ] Se validan solapes con citas existentes y bloqueos de calendario.
- [ ] Las citas generadas respetan horario/festivos del centro.
- [ ] El límite de 1 cita activa por paciente sigue aplicando (si no se ha configurado lo contrario).

---

### P10 — Lista de espera + `recoveredSlots`

**Problema:** Cuando hay cancelación, el hueco se pierde; no hay métrica de huecos recuperados.

**Solución:**
1. Modelo:
   - `waitlist_entry` (id, tenant_id, patient_id, nutritionist_id, preferred_from, preferred_to, status, created_at)
2. Endpoints:
   - `GET /tenant/{id}/appointments/waitlist`
   - `POST /tenant/{id}/appointments/waitlist`
   - `POST /tenant/{id}/appointments/waitlist/{id}/offer` (ofrecer hueco cancelado)
3. Al cancelar una cita, opcionalmente ofrecer el hueco a la lista de espera.
4. Métrica `recoveredSlots`: contar citas creadas desde ofertas de waitlist.

**Archivos a tocar:**
- Nuevas entidades, repos, servicios, controladores.
- `service/AppointmentService.java` — al cancelar, buscar waitlist.
- `service/AppointmentMetricsService.java` — añadir recovered slots.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Se puede apuntar paciente a lista de espera.
- [ ] Al cancelar una cita se puede ofrecer el hueco.
- [ ] Se registran huecos recuperados.
- [ ] El paciente confirma/rechaza la oferta.

---

### P12 — Importación InBody / báscula (CSV/JSON)

**Problema:** Las mediciones se introducen manualmente.

**Solución:**
1. Endpoint:
   - `POST /tenant/{id}/users/{userId}/measurements/import`
2. Soportar formatos CSV/JSON con columnas estándar de InBody:
   - `measuredAt`, `weightKg`, `bodyFatPct`, `muscleMassPct`, `visceralFatLevel`, `bodyWaterPct`, segmentales, etc.
3. Mapear a `BodyMeasurement`.
4. Validar datos y devolver resumen de importación.

**Archivos a tocar:**
- `controller/BodyMeasurementController.java`
- `service/BodyMeasurementService.java` — método `importMeasurements`.
- Nuevo DTO `ImportBodyMeasurementsRequest`.
- Utilidad de parseo CSV/JSON.

**Criterios de aceptación:**
- [ ] Se importan mediciones desde CSV y JSON.
- [ ] Los campos requeridos mínimos son `measuredAt` y `weightKg`.
- [ ] Se devuelve resumen de filas importadas/errores.
- [ ] No se duplican mediciones para la misma fecha/hora.

---

### P13 — Google Calendar bidireccional

**Problema:** Las citas no se sincronizan con calendarios externos.

**Solución:**
1. OAuth2 con Google Calendar por nutricionista.
2. Al crear/modificar/cancelar cita, sincronizar evento en Google Calendar del nutricionista.
3. Webhook de Google para recibir cambios externos y reflejarlos en la app (opcional v1; al menos documentar).
4. Almacenar `google_calendar_event_id` en `appointment`.

**Archivos a tocar:**
- `models/entity/Appointment.java` — añadir `googleCalendarEventId`.
- Nuevo servicio `GoogleCalendarService`.
- Configuración OAuth2 en `application.yaml`.
- `service/AppointmentService.java` — llamadas a sync en create/update/status.
- Migración Flyway.

**Criterios de aceptación:**
- [ ] El nutricionista puede conectar su Google Calendar.
- [ ] Crear/editar/cancelar cita refleja cambios en Google Calendar.
- [ ] Se manejan errores de autenticación (token expirado) notificando al usuario.

**Notas:**
- Requiere crear proyecto en Google Cloud Console fuera del desarrollo.
- Considerar scope read-write o solo write en v1.

---

### T15/T16 — Auditoría + soft delete

**Problema:** No hay trazabilidad de escrituras clínicas; los borrados son físicos.

**Solución:**
1. Tabla `audit_log`:
   - `id`, `tenant_id`, `actor_id`, `action` (CREATE/UPDATE/DELETE), `entity`, `entity_id`, `before` (JSON), `after` (JSON), `ip`, `created_at`.
2. Interceptor o aspecto que registre escrituras en entidades clínicas:
   - `AppUser`, `UserTenantRole`, `Appointment`, `Menu`, `Meal`, `BodyMeasurement`, `UserTenantProfile`, `PatientEvent`.
   - Operaciones sobre archivos en MinIO (`StoredFile`): subida y borrado, con referencia al recurso asociado.
3. Soft delete:
   - Añadir `deleted_at` a entidades clínicas.
   - Repositorios filtran `deleted_at IS NULL` por defecto.
   - Separar `revokeAccess` (soft delete de UTR) de `deleteUser` (hard delete solo si no hay datos clínicos).
4. Endpoint:
   - `GET /tenant/{id}/audit-log?entity=&entityId=&from=&to=`

**Archivos a tocar:**
- `models/entity/AuditLog.java` (nuevo)
- `repository/AuditLogRepository.java` (nuevo)
- Nuevo aspecto/interceptor `AuditAspect`.
- Entidades a auditar: añadir `deletedAt`.
- Repositorios: añadir filtros de soft delete.
- `service/UserTenantRoleService.java` — `revokeAccess` como soft delete.
- `controller/TenantController.java` o nuevo `AuditLogController`.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Toda escritura clínica queda registrada en `audit_log`.
- [ ] Las subidas y borrados de archivos en MinIO quedan auditadas.
- [ ] Se puede consultar auditoría por entidad, id y rango.
- [ ] Los borrados de menús, comidas y UTR son soft delete.
- [ ] No se pierde trazabilidad al revocar acceso.

---

## 4. Dependencias internas de la fase

```
P7  ->  requiere T13 (buzón de notificaciones), T21 (MinIO) y Redis
P9  ->  requiere AppointmentService actual y T11 (timezone)
P10 ->  depende de P9 y AppointmentService
P12 ->  requiere T8 (heightCm snapshot) y BodyMeasurementService
P13 ->  depende de AppointmentService; requiere configuración Google OAuth
T15/T16 ->  transversal; debe hacerse antes o junto con P7/P9/P10
```

## 5. Checklist de cierre de fase

- [ ] Chat funcional con imágenes en MinIO, SSE y push.
- [ ] Recurrencia de citas con validación de solapes.
- [ ] Lista de espera y métrica de huecos recuperados.
- [ ] Importación InBody/báscula CSV/JSON.
- [ ] Google Calendar sync básico.
- [ ] Auditoría de escrituras clínicas y de archivos en MinIO.
- [ ] Soft delete en entidades clínicas y UTR.
- [ ] Tests pasan y aplicación compila.
- [ ] `doc/breaking-changes.md` actualizado.
