# Plan de producto y análisis del contrato de API

> **Fecha:** 28 de octubre de 2026
> **Alcance:** plan de mejoras de producto + auditoría del contrato OpenAPI.
> **Fuentes:** `doc/` (55 documentos, ~12.200 líneas) y `doc/contrato-api/api-docs.json`
> (OpenAPI 3.1.0: **80 rutas, 115 operaciones, 131 esquemas**).
> **Contexto verificado:** existe app móvil Flutter para pacientes y nutricionistas;
> existe ciclo de vida (alta en el centro, última visita, próxima cita, habilitar/deshabilitar).

---

## 0. Resumen ejecutivo

1. El producto ya cubre **clínica + planificación + agenda + negocio + app + marca blanca**. El hueco competitivo no es "más features", es **el bucle diario del paciente** (intercambios, diario, chat, recetas) y **la velocidad de pautado**.
2. El contrato de API es **funcionalmente rico pero contractualmente débil**: no tiene esquema de seguridad, ni errores tipados, ni media types, ni control de concurrencia, ni idempotencia, ni auditoría.
3. Hay **una posible fuga de la clave Gemini** en el esquema público de preferencias y **un dato de negocio ausente** (`price` en la cita). Ambas son de prioridad alta.
4. La secuencia correcta es: **endurecer contrato (2-3 semanas) → intercambios + recetario + diario (6-8 semanas) → chat + pagos + agenda avanzada → automatización clínica**.
5. Sin tocar el modelo de negocio, hay 4 quick wins de alto impacto: estado clínico separado del acceso, `lastVisitDate` sin no-shows, toggle de nutrientes por centro y `joinedAt` real por centro.

---

## 1. Punto de partida verificado

### 1.1 Lo que ya existe (y no hay que construir)

| Dominio | Evidencia |
|---|---|
| Multitenant + RBAC + marca blanca | `doc/API.md`, `doc/contrato-api/security/userType.md`, `doc/contrato-api/menus/menu-pdf-and-tenant-contact.md` |
| App Flutter paciente + nutricionista | `doc/*` ("Para: equipo de Frontend (app Flutter)"), `doc/contrato-api/appointments/relacion_paciente_nutricionista.md` §7 |
| Agenda completa | `doc/contrato-api/appointments/appointments.md`, `doc/contrato-api/appointments/appointment_reminders.md`, `doc/frontend/appointments/calendario_notas_nutricionista_frontend.md`, `doc/contrato-api/appointments/horarios_centros.md` |
| Precios, ingresos y métricas | `doc/contrato-api/appointments/EXECUTIVE_SUMMARY.md`, `doc/frontend/appointments/metricas_asistencia_frontend.md` |
| Menús BEDCA + plantillas + PDF + lista de compra IA | `doc/frontend/menus/menus-estructurados-bedca-frontend.md`, `doc/contrato-api/ai/ai-shopping-list.md` |
| Composición corporal clínica + PDF | `doc/contrato-api/body-composition/body_composition_and_segmental_measurements.md`, `doc/contrato-api/body-composition/pdf-composicion-corporal.md` |
| Anamnesis estructurada (18 condiciones) | `doc/contrato-api/patients/anamnesis_checklist_fields.md` |
| Portal paciente (dieta, evolución, agua, PDFs) | `doc/contrato-api/patients/water_intake_and_anamnesis_config.md`, `doc/contrato-api/body-composition/pdf-composicion-corporal.md` |
| Ciclo de vida | `createdAt` ("Alta en el centro"), `lastAppointmentDate`, `nextAppointmentDate`, `enabled`/`disabledAt`, `PATCH /users/{id}/status` |
| Control de versiones de la app | `GET/PUT /api/v1/app/version` (`AppVersionDto`, `mandatoryUpdate`) |
| Exportación de usuarios | `GET /tenant/{tenantId}/users/export` |

### 1.2 Correcciones al análisis previo

- **No falta app móvil.** Falta paridad funcional y bucle de engagement dentro de ella.
- **No falta ciclo de vida.** Falta separar **estado clínico** de **estado de acceso**, y arreglar la semántica de "última visita".
- **Sí existe una noción de receta** en el contrato (`RecipeDto`, `RecipeItemDto`), pero **no hay CRUD**: solo aparece en `GET /food/search`.

---

## 2. Benchmark competitivo (corregido)

| Capacidad | SIF | Nutrium | Dietopro |
|---|---|---|---|
| App paciente y profesional | ✅ Flutter | ✅ | ✅ |
| Autoservicio de cita | ✅ in-app (`PROPOSED`) | ✅ + web pública | ✅ |
| Recordatorios push | ✅ OneSignal | ✅ | ✅ |
| Ciclo de vida | ✅ | ✅ | ✅ |
| Composición corporal segmental + informe | ✅ **superior** | Parcial | Antropometría + InBody |
| Multitenant / marca blanca | ✅ **superior** | Parcial | Parcial |
| Métricas de negocio del centro | ✅ **superior** | Pagos/facturación | Recordatorios |
| Planes por raciones/intercambios | ❌ | ✅ | ✅ **núcleo** |
| Generación automática por patología | ❌ | Parcial (IA) | ✅ |
| Recetario gestionable | 🟠 parcial | ✅ miles | ✅ 24.000 |
| Diario alimentario / adherencia | ❌ | ✅ | ✅ |
| Chat | ❌ | ✅ | ✅ |
| Contenido educativo | ❌ | ✅ | ✅ TCC |
| Pagos / facturación | 🟠 solo ingresos | ✅ | ✅ |
| Integraciones (InBody, calendario, labs) | ❌ | ✅ Zoom/Meet | ✅ InBody + Google Calendar |
| Vademécum fármaco-nutriente | ❌ | ❌ | ✅ |

**Lectura:** no competir por volumen de recetas ni por red social. Competir por **rigor clínico + rapidez + control del centro + marca propia**.

---

## 3. Análisis del contrato de API

### 3.1 Inventario

| Métrica | Valor |
|---|---|
| Rutas | 80 |
| Operaciones | 115 |
| Esquemas | 131 |
| `securitySchemes` | **0** |
| `security` global | **0** |
| Operaciones con `summary` | **0 / 115** |
| Operaciones con `description` | 115 / 115 |
| Respuestas con esquema de error | **0** |
| Media types declarados | `*/*` en la mayoría; `text/event-stream` en SSE |
| Servidor declarado | solo `http://localhost:8081/api` |

### 3.2 Cobertura por dominio

| Dominio | Estado | Comentario |
|---|---|---|
| Identidad y usuarios | ✅ | `me`, invitación, roles, estado, lote, export |
| Tenant / branding / preferencias | 🟠 | Funciona, pero con 5 caminos de escritura y esquemas duplicados |
| Agenda | ✅ | Tipos, estados, solapes, sin paciente, reagenda, notas, horarios, festivos |
| Métricas | ✅ | Endpoint agregado + revenue |
| Menús / comidas / plantillas | ✅ | BEDCA, texto, clonar día, instanciar, PDF, SSE |
| Alimentos y nutrición | 🟠 | Búsqueda y nutrientes; recetas sin CRUD |
| Salud y mediciones | ✅ | Histórico, última, evolución, composición, PDF |
| Perfil clínico / anamnesis | ✅ | 18 condiciones + campos configurables |
| Agua | ✅ | Solo paciente |
| Eventos del paciente | ✅ | Calendario informativo |
| Lista de la compra | ✅ | IA + check de ítems |
| Notificaciones | 🟠 | SSE efímero, sin buzón |
| Pagos / facturación | ❌ | Solo cálculo de ingresos |
| Diario / adherencia | ❌ | Sin contrato |
| Chat | ❌ | Sin contrato |
| Recetario | 🟠 | DTO en búsqueda, sin CRUD |
| Intercambios / raciones | ❌ | Sin contrato |
| Auditoría / consentimiento | ❌ | Sin contrato |
| Labs / integraciones | ❌ | Sin contrato |
| Reserva pública | ❌ | Solo dentro de la app autenticada |

### 3.3 Hallazgos del contrato

Severidad: **A** = bloquea venta o genera riesgo; **M** = deuda que frena integración/escala; **B** = higiene.

| ID | Sev. | Hallazgo | Evidencia | Impacto | Corrección propuesta |
|---|---|---|---|---|---|
| C1 | **A** | `gemini_api_key` aparece en `TenantPreferences_Public`, idéntico a `_Full`, y `GET /tenant/{tenantId}/profile` devuelve `Tenant_Public.preferences` | `api-docs.json` esquemas `TenantPreferences*`; ruta `/tenant/{tenantId}/profile` | Posible exposición de la clave de IA a usuarios del tenant (incluido paciente si el permiso lo permite) | Campo write-only, `hasApiKey: boolean`, cifrado en reposo, rotación y auditoría. **Verificar si el serializer la enmascara hoy** |
| C2 | **A** | `AppointmentDto` no expone `price` aunque la cita lo persiste | `doc/contrato-api/appointments/EXECUTIVE_SUMMARY.md` vs esquema `AppointmentDto` | No se puede mostrar/auditar el importe por cita; solo el total agregado | Añadir `price`, `currency`, `priceSource` y `paidAt` (futuro) |
| C3 | **A** | Contrato de errores inconsistente: literales en inglés, claves i18n y 400 de Spring sin formato | `doc/contrato-api/appointments/appointments.md`, `doc/contrato-api/appointments/relacion_paciente_nutricionista.md`, `doc/calendario_notas_*` §238 | Cliente frágil, mensajes sin traducir, imposible tests por código | `ProblemDetail` (RFC 9457) con `code`, `message`, `fieldErrors`, `traceId`; catálogo de códigos |
| C4 | **A** | OpenAPI incompleto: sin seguridad, sin summaries, sin errores, media types `*/*`, servidor localhost | `api-docs.json` | No se pueden generar SDKs ni contract tests; onboarding lento | Anotar seguridad, publicar OpenAPI versionado, lint en CI (Spectral), portal de API |
| C5 | **A** | Preferencias con 5 caminos de escritura y reemplazo total del documento | `POST /tenants`, `PUT /tenants/{id}`, `PUT /tenant/{id}/profile`, `PUT .../profile/preferences`, `PUT .../branding/preferences` | Un PUT parcial borra flags (`doc/frontend/menus/menus-estructurados-bedca-frontend.md` §2) | Un único `PATCH /tenant/{id}/preferences` con merge y validación por campo |
| C6 | **M** | `dayOfWeek`, `mealType`, `menu_creation_mode` son strings libres | `doc/frontend/menus/menus-estructurados-bedca-frontend.md` §3 | Datos inconsistentes; agregación imposible | Enums + migración + validación + valores legacy |
| C7 | **M** | Listados sin paginación: notas de calendario, comidas de menú, citas por nutricionista, historial de menús, eventos, listas de compra, nutrientes | `api-docs.json` (respuestas `array`) | Crecimiento sin límite y latencia | `Page<>` o cursor; `limit` máximo |
| C8 | **M** | Sin control de concurrencia en menús/comidas | Sin `@Version`/ETag en el contrato; SSE solo notifica | Dos profesionales editan y el último gana; pérdida de trabajo | `@Version` + `If-Match`/ETag + `409` |
| C9 | **M** | Recordatorios a las 08:00 **hora del servidor**, no configurable por tenant; el tenant no tiene `timezone` | `doc/contrato-api/appointments/appointment_reminders.md` §5; `AppUser_Me.timezone` | Avisos a horas raras en centros de otra zona | `tenant.timezone` + `reminderHour` + job por zona |
| C10 | **M** | No hay "alta en el centro": `TenantUserDto` sin `joinedAt`; `AppUser.createdAt` es la cuenta global | `api-docs.json`; `es.json` `joined_at` | Un paciente en dos centros muestra la fecha del primero | `joinedAt` en `user_tenant_role` + DTO |
| C11 | **M** | `lastAppointmentDate` incluye `NO_SHOW` | `doc/frontend/patients/listado_pacientes_frontend.md` §2 | Un no-show figura como "última visita"; sesga retención | Separar `lastVisitDate` (`COMPLETED`) y `lastNoShowDate` |
| C12 | **B** | Duplicidad `Menu.active` / `Menu.isActive`; preferencias en `snake_case` | `api-docs.json` | Modelos generados sucios | Unificar nombres |
| C13 | **M** | Versionado inconsistente: `/api` para todo, `/api/v1` solo para versión de app | `api-docs.json` | Cambios breaking sin ruta de escape | `/api/v1` o `Accept-Version` + política de deprecación |
| C14 | **M** | Sin idempotencia en POST críticos | Citas, menús, mediciones, lista de compra | Reintentos móviles duplican datos | `Idempotency-Key` + TTL |
| C15 | **M** | SSE efímero, sin buzón ni `Last-Event-ID` | `doc/frontend/notifications/sse-notificaciones-frontend.md` §1 | Notificación perdida si el usuario está offline | Tabla `notification` + `GET /notifications` + replay |
| C16 | **B** | `/users/export` sin contrato (200 `*/*`) | `api-docs.json` | Integradores a ciegas | `text/csv`, columnas y ejemplo documentados |
| C17 | **A** | Sin auditoría, consentimientos ni historial de anamnesis | No hay endpoints; perfil se sobrescribe (`doc/contrato-api/patients/patient_profile.md` §5) | Requisito de compra en clínica; riesgo legal | `audit_log` append-only, `patient_consent`, historial de perfil |
| C18 | **B** | Solo el paciente puede registrar agua | `doc/contrato-api/patients/water_intake_and_anamnesis_config.md` | El nutricionista no puede registrar en consulta | Añadir `MANAGE_WATER_INTAKE` si se decide |
| C19 | **M** | Dinero como `number` sin moneda por tenant; `currency` fijo EUR en métricas | `api-docs.json` `Revenue`, `AppointmentTypeDto` | Redondeos y expansión internacional | `Money { amount, currency }` o `currency` en tenant |
| C20 | **M** | IMC histórico calculado con la altura actual | `doc/contrato-api/architecture/history.md` §8 | Informes antiguos cambian solos | Guardar `heightCm` en cada medición |
| C21 | **M** | Sin `soft delete` ni política de borrado | `DELETE /menu/{id}`, `/meal/{id}`, `/users/{userId}` | Pérdida de trazabilidad y de histórico | `deletedAt` + `revokeAccess` ≠ `delete` |
| C22 | **B** | `food/search` limitado a 20 alimentos + 10 recetas, sin `total` ni cursor | `doc/frontend/menus/menus-estructurados-bedca-frontend.md` §4 | Catálogo difícil de explorar | Cursor + `total` + facetas |
| C23 | **B** | `RecipeDto` sin CRUD | `api-docs.json` | No hay biblioteca de recetas gestionable | Ver §3.4 |
| C24 | **M** | Sin lista de espera; `recoveredSlots` siempre `null` | `doc/frontend/appointments/metricas_asistencia_frontend.md` §1 | No se puede recuperar hueco ni medirlo | Ver §3.4 |
| C25 | **M** | Sin estado clínico distinto del acceso | `enabled`/`disabledAt` deshabilita Keycloak | Un paciente "de alta" pierde acceso a su historial | `clinicalStatus` + `accessStatus` |

### 3.4 Contratos nuevos propuestos

#### A) Estado clínico separado del acceso

```http
PATCH /tenant/{tenantId}/users/{userId}/clinical-status
```
```json
{ "status": "PAUSED", "reason": "Embarazo", "changedAt": "2026-10-28T10:00:00Z" }
```
- `status`: `ONBOARDING | ACTIVE | PAUSED | DISCHARGED | DROPPED_OUT`
- `accessStatus` sigue siendo `enabled`/`disabledAt`.
- `GET /tenant/{id}/users/{userId}/clinical-status/history` devuelve transiciones.
- Regla: `DISCHARGED` mantiene lectura; `SUSPENDED` corta login.

#### B) Intercambios / raciones

```http
GET  /tenant/{tenantId}/exchange-groups
GET  /tenant/{tenantId}/exchange-groups/{groupId}/equivalents
POST /tenant/{tenantId}/exchange-groups/{groupId}/equivalents
PUT  /meal/{mealId}/exchanges
```
```json
{
  "items": [
    { "groupId": "cereales", "rations": 3, "foodId": "opcional", "notes": null }
  ]
}
```
- Equivalente = `{ foodId, rationsPerUnit, householdMeasure, gramsPerRation }`.
- El planificador valida macros contra objetivos y devuelve `warnings[]`.
- Mantener `MealItem` en gramos como capa de persistencia; intercambios como capa de autoría.

#### C) Diario y adherencia

```http
POST /tenant/{tenantId}/users/{userId}/diary/{date}
GET  /tenant/{tenantId}/users/{userId}/diary?from&to
GET  /tenant/{tenantId}/users/{userId}/adherence?from&to
```
```json
{
  "mealId": "uuid",
  "status": "DONE | SWAPPED | SKIPPED | PARTIAL",
  "actualItems": [{ "foodId": "uuid", "quantityG": 120 }],
  "photoUrl": null,
  "notes": "Comí fuera de casa"
}
```
- `adherence` devuelve `{ plannedMeals, loggedMeals, adherenceRate, byDay[] }`.

#### D) Chat

```http
GET  /tenant/{tenantId}/threads
GET  /tenant/{tenantId}/threads/{threadId}/messages?before&limit
POST /tenant/{tenantId}/threads/{threadId}/messages
GET  /tenant/{tenantId}/threads/{threadId}/stream   (SSE)
PATCH /tenant/{tenantId}/threads/{threadId}/read
```
- Un hilo por `(tenant, patient, nutritionist)`.
- Adjuntos con límite y tipo validado; sin datos clínicos sensibles en push.

#### E) Recetario

```http
GET/POST      /tenant/{tenantId}/recipes
GET/PUT/DELETE/tenant/{tenantId}/recipes/{recipeId}
POST          /tenant/{tenantId}/recipes/{recipeId}/instantiate
```
```json
{
  "name": "Bowl de pollo y arroz",
  "servings": 2,
  "items": [{ "foodId": "uuid", "quantityG": 120, "sortOrder": 0 }],
  "steps": ["Cocer el arroz", "Saltear el pollo"],
  "allergens": ["GLUTEN"],
  "householdMeasures": [{ "label": "1 bol", "grams": 350 }],
  "visibility": "TENANT | PRIVATE"
}
```

#### F) Pagos y facturación

```http
POST /tenant/{tenantId}/invoices
GET  /tenant/{tenantId}/invoices?from&to&status
POST /tenant/{tenantId}/payments/intents
POST /webhooks/stripe
```
- `Invoice { number, appointmentId, patientId, amount, tax, currency, status, pdfUrl }`.
- Numeración por tenant y serie; inmutabilidad tras emisión.

#### G) Agenda avanzada

```http
POST /tenant/{tenantId}/appointments/recurrence
GET/POST /tenant/{tenantId}/appointments/waitlist
POST /tenant/{tenantId}/appointments/waitlist/{id}/offer
```
- Recurrencia `{ rrule, count, until }` con validación de solapes.
- Lista de espera alimenta `recoveredSlots`.

#### H) Auditoría y consentimiento

```http
GET  /tenant/{tenantId}/audit-log?entity&entityId&from&to
POST /tenant/{tenantId}/users/{userId}/consents
GET  /tenant/{tenantId}/users/{userId}/consents
```
- `audit_log`: `actorId`, `action`, `entity`, `entityId`, `before`, `after`, `ip`, `createdAt`.
- Consentimientos versionados (texto + fecha + firma/aceptación).

#### I) Educación, labs e integraciones

```http
GET/POST /tenant/{tenantId}/contents
POST     /tenant/{tenantId}/users/{userId}/content-assignments
POST     /tenant/{tenantId}/users/{userId}/lab-results
POST     /tenant/{tenantId}/integrations/inbody/import
GET/POST /tenant/{tenantId}/integrations/google-calendar
GET      /public/{tenantSlug}/availability
POST     /public/{tenantSlug}/appointments
```

---

## 4. Backlog priorizado

### 4.1 Contrato y plataforma (T)

| ID | Mejora | Horizonte | Impacto | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|---|
| T1 | Enmascarar `gemini_api_key` y añadir `hasApiKey` | 0 | 5 | S | La clave no aparece en ningún GET; test de contrato lo verifica |
| T2 | `price` + `currency` en `AppointmentDto` | 0 | 5 | S | El listado permite auditar importe por cita |
| T3 | Errores `ProblemDetail` + catálogo de códigos | 0 | 5 | M | Todos los 4xx/5xx tienen `code` estable y `traceId` |
| T4 | OpenAPI con seguridad, media types, summaries y errores | 0 | 4 | M | `spectral lint` en CI sin errores; SDK generado |
| T5 | `PATCH /tenant/{id}/preferences` único con merge | 0 | 4 | M | Un patch parcial no borra flags |
| T6 | Enums `DayOfWeek`, `MealType`, `MenuCreationMode` | 0 | 3 | S | Validación + migración de valores legacy |
| T7 | `joinedAt` por centro + `lastVisitDate` sin no-show | 0 | 4 | S | DTO y listado con semántica correcta |
| T8 | `heightCm` snapshot en medición + IMC estable | 0 | 3 | S | Informes históricos no cambian |
| T9 | Paginación en listados largos | 1 | 3 | M | Todos los listados con `page/size` o cursor |
| T10 | ETag/`If-Match` en menús y comidas | 1 | 4 | M | Edición concurrente devuelve `409` |
| T11 | `tenant.timezone` + hora de recordatorio | 1 | 3 | S | Recordatorio a la hora local del centro |
| T12 | `Idempotency-Key` en POST críticos | 1 | 4 | M | Reintento no duplica cita/menú/medición |
| T13 | Buzón de notificaciones + replay SSE | 1 | 4 | M | `GET /notifications` + no leídas |
| T14 | Versionado `/api/v1` + política de deprecación | 2 | 3 | M | Clientes actuales siguen funcionando |
| T15 | Auditoría + consentimientos | 2 | 5 | L | Toda escritura clínica trazable |
| T16 | Soft delete y separación revocar/eliminar | 2 | 3 | M | Nada clínico se borra físicamente |
| T17 | Contrato de `/users/export` + export completo GDPR | 2 | 3 | S | CSV tipado + paquete de datos por paciente |
| T18 | Dinero tipado + moneda por tenant | 2 | 3 | M | Sin `float`; informes multi-moneda |
| T19 | Rate limiting y cuotas por tenant | 3 | 3 | M | 429 consistente y métricas |
| T20 | Webhooks de eventos | 3 | 3 | M | `menu.published`, `appointment.created`, etc. |

### 4.2 Producto (P)

| ID | Mejora | Horizonte | Impacto | Esfuerzo | Depende de |
|---|---|---|---|---|---|
| P1 | Estado clínico + historial de estados | 0 | 4 | S | T7 |
| P2 | Toggle de nutrientes por centro (`HIDDEN/MACROS/FULL`) | 0 | 4 | S | — |
| P3 | Intercambios v1 + planificador por raciones | 1 | 5 | L | T6 |
| P4 | Recetario CRUD + biblioteca + alérgenos | 1 | 5 | M | — |
| P5 | Diario + adherencia v1 | 1 | 5 | M | P3 |
| P6 | PDF de menú con ingredientes, medidas caseras y alérgenos | 1 | 4 | S | P4 |
| P7 | Chat v1 sobre SSE + push | 2 | 5 | M | T13 |
| P8 | Pagos + factura PDF | 2 | 4 | L | T18 |
| P9 | Recurrencia + múltiples citas activas configurables | 2 | 4 | M | — |
| P10 | Lista de espera + `recoveredSlots` | 2 | 3 | M | — |
| P11 | Anamnesis autocompletada por el paciente | 2 | 4 | M | T15 |
| P12 | Importación InBody / báscula (CSV/JSON) | 2 | 4 | M | — |
| P13 | Google Calendar bidireccional | 2 | 3 | M | — |
| P14 | Contenido educativo + asignaciones | 3 | 4 | M | — |
| P15 | Labs / analíticas | 3 | 3 | M | — |
| P16 | Seguimiento fotográfico | 3 | 3 | S | — |
| P17 | Generador asistido por IA sobre intercambios | 3 | 5 | L | P3, P4 |
| P18 | Motor de reglas por patología | 3 | 4 | XL | P17 |
| P19 | Fórmulas predictivas (Harris-Benedict, Mifflin, PAL) | 3 | 3 | S | — |
| P20 | Vademécum fármaco-nutriente (licencia/partner) | 3 | 3 | L | — |
| P21 | Reserva pública + web del centro | 3 | 4 | M | — |
| P22 | Objetivos y hábitos del paciente | 3 | 3 | M | P5 |
| P23 | Paridad funcional web/app documentada | 2 | 4 | M | — |

---

## 5. Roadmap y KPIs

### Fase 0 — Endurecer (semanas 1-3)

- T1-T8, P1-P2.
- Entregable: contrato seguro y tipado + estado clínico + toggle de nutrientes.
- KPI: 0 hallazgos críticos de seguridad en el contrato; 100% de errores con `code`.

### Fase 1 — Planificar mejor (semanas 4-10)

- P3, P4, P5, P6; T9-T13.
- Entregable: intercambios, recetario, diario, PDF enriquecido.
- KPI: tiempo medio por plan (objetivo: −40%), % de comidas con ítems estructurados, adherencia media registrada.

### Fase 2 — Conectar y cobrar (semanas 11-18)

- P7-P13, T14-T17.
- Entregable: chat, pagos, recurrencia, lista de espera, InBody, calendario.
- KPI: no-show (objetivo: −20%), huecos recuperados/mes, % de citas pagadas online.

### Fase 3 — Automatizar y cumplir (semanas 19-30)

- P14-P22, T18-T20.
- Entregable: generación asistida, educación, labs, auditoría, reserva pública.
- KPI: retención a 6 meses, pacientes activos semanales, tickets de soporte por usuario, cumplimiento GDPR documentado.

---

## 6. Decisiones de producto pendientes

1. **Nutrientes:** ¿`HIDDEN` por defecto (posicionamiento conductual) o `MACROS`/`FULL` (clínico)? Recomendación: preferencia por centro con `FULL` en clínica.
2. **Estado clínico:** ¿"alta" mantiene acceso de lectura? Recomendación: sí; el acceso se corta con `SUSPENDED`.
3. **Citas:** ¿permitir varias citas futuras por paciente? Recomendación: configurable; por defecto 1 activa, pero permitir seguimiento pre-agendado.
4. **Anamnesis:** ¿el paciente puede rellenarla? Recomendación: sí, con revisión y firma del profesional.
5. **Recetas:** ¿biblioteca propia curada o importación de terceros? Recomendación: propias + importación, no competir por volumen.
6. **Pagos:** ¿solo registro o cobro real? Recomendación: Stripe + factura PDF; Veri*factu si se vende a autónomos españoles.
7. **IA:** ¿clave del centro o clave de plataforma con cuota? Recomendación: mantener clave del centro y añadir modo "cuota incluida" para planes altos.
8. **Moneda:** ¿EUR-only a corto plazo? Recomendación: modelar `currency` ya, aunque solo se use EUR.

---

## 7. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Fuga de la clave Gemini | Media | Alto | T1 inmediato, rotación y auditoría |
| Cambios breaking sin versionado | Media | Alto | T14 + contract tests |
| Scope creep en intercambios | Alta | Medio | v1 solo grupos + equivalentes + validación de macros |
| Coste de IA descontrolado | Media | Medio | Clave por tenant + límites + telemetría |
| IA con error clínico | Media | Alto | Salida siempre revisable; nunca publicar sin confirmación |
| Pérdida de trabajo por edición concurrente | Media | Medio | T10 |
| Requisitos GDPR no cubiertos | Media | Alto | T15 + T17 + revisión legal |
| Duplicidad web/app | Alta | Medio | P23: una sola API, paridad documentada |
| Dependencia de OneSignal | Baja | Medio | Buzón propio (T13) y fallback email |

---

## 8. Anexo: método y evidencias

- **Documentos leídos:** `doc/*.md` (55 entradas, ~12.200 líneas) y `PRODUCT.md`.
- **Contrato:** `doc/contrato-api/api-docs.json` (OpenAPI 3.1.0; 80 rutas, 115 operaciones, 131 esquemas).
- **Frontend:** `src/app/app.routes.ts` y estructura de `src/app/features`.
- **Comprobaciones directas:**
  - `securitySchemes` ausente y `security` global ausente.
  - 0/115 operaciones con `summary`; 115/115 con `description`.
  - 0 respuestas con esquema de error.
  - `TenantPreferences`, `TenantPreferences_Public` y `TenantPreferences_Full` con propiedades idénticas (incluida `gemini_api_key`).
  - `AppointmentDto` sin `price`; `AppointmentTypeDto` con `price`.
  - `TenantUserDto` sin `joinedAt`; `AppUser_Full.createdAt` global.
  - Respuestas `array` sin paginación en 7 listados.
  - `RecipeDto`/`RecipeItemDto` sin ruta CRUD.
- **Limitaciones:** no se ha inspeccionado el backend (no está en este repositorio) ni el código Flutter. Los hallazgos C1, C3 y C25 deben confirmarse contra la implementación antes de tratarlos como bug en producción.
