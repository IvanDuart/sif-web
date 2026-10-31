# Fase 3 — Automatizar y cumplir

> **Duración estimada:** 8-9 semanas con 1 backend dedicado.  
> **Objetivo:** automatizar la práctica clínica con generación asistida por IA, motor de reglas por patología, contenido educativo, analíticas y fórmulas predictivas; además, reforzar escalabilidad con rate limiting y webhooks.  
> **Entregable:** generador de menús/recetas sobre intercambios, advertencias clínicas automáticas, educación, labs, fórmulas predictivas y capacidad de webhooks.

---

## 1. Decisiones de producto aplicables en esta fase

- IA Gemini: siempre clave del centro (ya protegida en Fase 0).
- Suscripción: ya operativa desde Fase 0B; aquí solo se usa `currency` para importes de citas, no para el cobro de la plataforma.
- Sin reserva pública: se deja preparado el terreno.

---

## 2. Prerrequisitos (deben venir de Fases 0-2)

- P3 (intercambios) y P4 (recetario) funcionales.
- T15/T16 (auditoría) operativo.
- T21 (MinIO) operativo con `StorageService` reutilizable.
- P7 (chat) y T13 (buzón notificaciones) operativos.

---

## 3. Tareas

### P14 — Contenido educativo + asignaciones

**Problema:** No hay material educativo ni forma de asignarlo a pacientes.

**Solución:**
1. Modelo:
   - `content` (id, tenant_id, title, body, type, category, tags, stored_file_id nullable, created_at)
   - `content_assignment` (id, content_id, patient_id, assigned_by, assigned_at, read_at)
2. Endpoints:
   - `GET /tenant/{id}/contents`
   - `POST /tenant/{id}/contents`
   - `POST /tenant/{id}/users/{userId}/content-assignments`
   - `GET /tenant/{id}/users/{userId}/content-assignments`
   - `PATCH /tenant/{id}/content-assignments/{id}/read`
3. Tipos: `ARTICLE`, `VIDEO`, `INFOGRAPHIC`, `TASK`.
4. Imágenes y vídeos se almacenan en **MinIO** mediante `StorageService` (T21) y se sirven por URL firmada.

**Archivos a tocar:**
- Nuevas entidades, repos, servicios, controladores.
- `service/StorageService.java` — subida de imágenes/vídeos.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Se pueden crear contenidos por tenant.
- [ ] Se pueden asignar contenidos a pacientes.
- [ ] El paciente puede marcar contenido como leído.
- [ ] Los archivos multimedia se almacenan en MinIO y se sirven por URL firmada.

---

### P15 — Labs / analíticas

**Problema:** No hay registro estructurado de resultados de laboratorio.

**Solución:**
1. Modelo:
   - `lab_result` (id, tenant_id, patient_id, measured_at, notes, stored_file_id nullable, created_at)
   - `lab_result_marker` (id, lab_result_id, marker_code, value, unit, reference_range)
2. Endpoints:
   - `POST /tenant/{id}/users/{userId}/lab-results`
   - `GET /tenant/{id}/users/{userId}/lab-results`
   - `GET /tenant/{id}/users/{userId}/lab-results/{labResultId}`
3. Catálogo de marcadores comunes (glucosa, HbA1c, colesterol, etc.).
4. Archivos PDF/imagen de analíticas se almacenan en **MinIO** mediante `StorageService` (T21) y se sirven por URL firmada.

**Archivos a tocar:**
- Nuevas entidades, repos, servicios, controladores.
- `service/StorageService.java` — subida de PDFs/imágenes.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Se pueden registrar analíticas con múltiples marcadores.
- [ ] Se puede adjuntar archivo PDF/imagen almacenado en MinIO.
- [ ] Se listan cronológicamente.
- [ ] El archivo se sirve por URL firmada.

---

### P17 — Generador asistido por IA sobre intercambios

**Problema:** La planificación manual por raciones es lenta.

**Solución:**
1. Endpoint:
   - `POST /tenant/{id}/menus/generate`
2. Input: objetivos calóricos/macros, patologías, alergias, preferencias, semana tipo.
3. El sistema usa Gemini (clave del centro) para proponer un menú basado en intercambios.
4. La propuesta SIEMPRE es revisable y editable por el profesional antes de guardarse.
5. El motor debe respetar:
   - `exchangeGroupsEnabled`
   - `nutrientDisplayMode`
   - Alérgenos del paciente

**Archivos a tocar:**
- Nuevo `service/MenuGenerationService`.
- `service/GeminiService` o integración existente.
- `controller/MenuController.java` — nuevo endpoint.
- `service/AuditLogService` — registrar generación IA.

**Criterios de aceptación:**
- [ ] Se genera un borrador de menú a partir de intercambios.
- [ ] El profesional debe confirmar antes de persistir.
- [ ] La salida respeta alergias y preferencias del paciente.
- [ ] Se audita la generación.

**Notas:**
- La IA no debe publicar menús automáticamente; siempre con confirmación humana.
- Definir límites de tokens/llamadas para controlar coste.

---

### P18 — Motor de reglas por patología

**Problema:** No hay validaciones automáticas de seguridad clínica al planificar.

**Solución:**
1. Modelo:
   - `clinical_rule` (id, tenant_id, condition_code, parameter, operator, threshold, message, severity, active)
2. Reglas predefinidas:
   - Diabetes: limitar HC rápidos, controlar fibra/sodio.
   - Hipertensión: controlar sodio.
   - Dislipemia: controlar grasas saturadas.
   - Insuficiencia renal: controlar fósforo/potasio.
3. Al guardar/editar menú, receta o diario, ejecutar reglas y devolver `warnings[]`.
4. Las reglas son configurables por tenant.

**Archivos a tocar:**
- Nuevas entidades, repos, servicios.
- `service/MenuService.java` — validar al guardar menú.
- `service/MealService.java` — validar al guardar comida.
- `service/RecipeService.java` — validar recetas.
- `controller/MenuController.java`, `MealController.java`, `RecipeController.java`.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Existe catálogo inicial de reglas por patología.
- [ ] Las reglas se ejecutan al guardar menús/comidas/recetas.
- [ ] Se devuelven advertencias sin bloquear al profesional (modo advertencia, no bloqueo).

**Notas:**
- En v1 las reglas son informativas; no bloquean la acción para no entorpecer el flujo.

---

### P19 — Fórmulas predictivas

**Problema:** No hay cálculo automatizado de gasto energético y necesidades.

**Solución:**
1. Servicio `PredictiveFormulasService` con fórmulas:
   - Harris-Benedict
   - Mifflin-St Jeor
   - Factor de actividad física (PAL)
2. Input: edad, peso, altura, sexo, nivel de actividad.
3. Output: TMB, GET, recomendación calórica.
4. Endpoint:
   - `GET /tenant/{id}/users/{userId}/energy-needs`

**Archivos a tocar:**
- Nuevo servicio/controlador.
- `models/dto/EnergyNeedsDto.java`.
- `service/UserTenantProfileService.java` si se guardan objetivos.

**Criterios de aceptación:**
- [ ] Se calculan TMB y GET con al menos dos fórmulas.
- [ ] El resultado se puede usar para fijar objetivos del paciente.

---

### T18 — Dinero tipado + moneda por tenant

**Problema:** El dinero se maneja como `number` y la moneda está hardcodeada a EUR.

**Solución:**
1. Reutilizar `billing_currency`/`currency` de `Tenant` (Fase 0 y Fase 0B); no duplicar.
2. Añadir `currency` a `Appointment` y `AppointmentType`.
3. Crear clase/utilidad `Money` (`amount`, `currency`) para operaciones seguras.
4. Asegurar que `Revenue` y métricas incluyan moneda.

**Archivos a tocar:**
- `models/entity/Tenant.java`, `Appointment.java`, `AppointmentType.java`.
- `models/dto/RevenueDto.java` o similar.
- `utils/Money.java` (nuevo).
- `service/AppointmentService.java`, `AppointmentTypeService.java`.

**Criterios de aceptación:**
- [ ] Cada tenant tiene moneda configurada.
- [ ] Citas y tipos de cita incluyen moneda.
- [ ] No se usan `float`/`double` para dinero; usar `BigDecimal`.

---

### T19 — Rate limiting y cuotas por tenant

**Problema:** No hay control de uso de recursos por tenant.

**Solución:**
1. Implementar rate limiting con Bucket4j + Redis.
2. Cuotas configurables por tenant:
   - Llamadas API por minuto/hora.
   - Llamadas a Gemini por día.
   - Almacenamiento de adjuntos.
3. Devolver `429 Too Many Requests` con `Retry-After`.

**Archivos a tocar:**
- Nueva configuración `RateLimitConfig`.
- Filtro `RateLimitFilter`.
- `models/entity/TenantPreferences.java` o `Tenant` — añadir cuotas.

**Criterios de aceptación:**
- [ ] Se limitan llamadas por tenant.
- [ ] Se devuelve `429` consistente.
- [ ] Redis se usa como almacén de buckets.

---

### T20 — Webhooks de eventos

**Problema:** Sistemas externos no pueden reaccionar a eventos de la plataforma.

**Solución:**
1. Modelo:
   - `webhook_subscription` (id, tenant_id, url, secret, events[], active, created_at)
2. Eventos iniciales:
   - `appointment.created`, `appointment.completed`, `appointment.cancelled`
   - `menu.published`, `menu.updated`
   - `patient.clinical_status_changed`
3. Enviar POST con payload + firma HMAC al suscribirse.
4. Reintentos con backoff.

**Archivos a tocar:**
- Nuevas entidades, repos, servicios, controladores.
- `service/WebhookDeliveryService` con reintentos.
- Publicación de eventos desde `AppointmentService`, `MenuService`, etc.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Se pueden registrar webhooks por tenant.
- [ ] Los eventos configurados se entregan con firma HMAC.
- [ ] Hay reintentos ante fallos.

---

## 4. Tarea opcional aplazada

### Solicitud de cita desde web pública

- **Estado:** fuera de roadmap por decisión de producto.
- **Preparación:** si en el futuro se decide, la base está lista:
  - `Tenant` tiene branding público.
  - `Appointment` soporta citas `PROPOSED`.
  - Basta con añadir un endpoint anónimo `POST /public/{tenantSlug}/appointment-requests`.

---

## 5. Dependencias internas de la fase

```
P14 ->  requiere T21 (MinIO) para archivos multimedia
P15 ->  requiere T21 (MinIO) para PDFs/imágenes de analíticas
P17 ->  requiere P3 (intercambios) y P4 (recetas)
P18 ->  requiere P3, P4, P5 (diario) y P15 (labs)
P19 ->  independiente; puede hacerse en paralelo
T18 ->  requiere T2 (price/currency) de Fase 0
T19 ->  requiere Redis
T20 ->  requiere T19 y P7/P9 para eventos
```

## 6. Checklist de cierre de fase

- [ ] Contenido educativo y asignaciones operativos, con archivos en MinIO.
- [ ] Registro de analíticas (labs) funcional, con archivos en MinIO.
- [ ] Generador asistido por IA sobre intercambios (con confirmación humana).
- [ ] Motor de reglas por patología con advertencias.
- [ ] Fórmulas predictivas de gasto energético.
- [ ] Moneda por tenant y dinero tipado.
- [ ] Rate limiting por tenant con Redis.
- [ ] Webhooks de eventos con firma y reintentos.
- [ ] Tests pasan y aplicación compila.
- [ ] `doc/breaking-changes.md` actualizado.
