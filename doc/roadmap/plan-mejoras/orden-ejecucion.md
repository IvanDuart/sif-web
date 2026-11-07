# Orden de ejecución recomendado

> **Duración total estimada:** ~36-38 semanas con 1 backend dedicado.  
> **Enfoque:** secuencial por fases, respetando dependencias técnicas. Algunas tareas transversales se pueden adelantar si no dependen de otras.  
> **Objetivo de este documento:** servir de guía para planificar sprints y asignar agentes/sesiones a tareas concretas sin perder de vista el orden lógico.

---

## 1. Principios generales

1. **Fase 0 primero.** Sin ella, el resto del código se construye sobre un contrato inseguro y datos incorrectos.
2. **No saltar dependencias.** Por ejemplo, no implementar intercambios (P3) antes de cerrar los enums de día/tipo de comida (T6).
3. **Frontend es cuello de botella.** Muchos cambios de Fase 1 y 2 requieren adaptación en Flutter. Acordar mocks/endpoints con frontend antes de empezar.
4. **Migraciones irreversibles con cuidado.** T6, T7, T8 y T15/T16 tocan datos existentes. Hacer backup y probar migraciones antes de desplegar.
5. **Spikes para incertidumbres.** P17 (IA generativa) y P18 (motor de reglas) son los más volátiles; reservar 2-3 días de spike antes de comprometer estimación final.

---

## 2. Orden detallado de tareas

### Fase 0 — Endurecer (semanas 1-10)

Orden recomendado:

1. **T1 — Enmascarar `geminiApiKey` y cifrar**
   - Impacto alto y rápido. Desbloquea el resto de trabajo con preferencias.
   - *Agente recomendado:* seguridad / configuración.

2. **T21 — Integración con MinIO**
   - MinIO ya está desplegado. Crea `StorageService`, `stored_file` y URLs firmadas.
   - Bloquea P4, P6, P7, P14 y P15; conviene tenerlo listo cuanto antes.
   - *Agente recomendado:* infraestructura / backend.

3. **T6 — Enums `DayOfWeek` y `MealType` + migración**
   - Bloquea P3, P4, P5, P6. Hacerlo lo antes posible.
   - *Atención:* requiere conocer valores legacy antes de escribir la migración.

4. **T3 — Errores `ProblemDetail` + catálogo de códigos**
   - Transversal. Puede hacerse en paralelo con T6.
   - *Agente recomendado:* arquitectura / contrato.

5. **T4 — OpenAPI con seguridad y summaries**
   - Depende parcialmente de T3 (respuestas de error). Puede avanzar en paralelo.

6. **T2 — `price` + `currency` en `AppointmentDto`**
   - Rápido. Dependencia leve con T18, pero se puede hacer ahora parcialmente.

7. **T5 — `PATCH /tenant/{id}/preferences` con merge**
   - Depende de T1 (porque toca preferencias). Hacer después de T1.

8. **T7 — `joinedAt` + separar `lastVisitDate`/`lastNoShowDate`**
   - Cambia DTOs de listado. Afecta a frontend.

9. **T8 — `heightCm` snapshot en medición + IMC estable**
   - Migración de datos. Probar con dump de producción.

10. **P1 — Estado clínico separado del acceso**
    - Requiere nuevas tablas y lógica de autoría. Dependencia con UTR.

11. **P2 — Toggle de nutrientes por centro**
    - Depende de T5 (preferencias mergeables). Cierre de Fase 0.

---

### Fase 0B — Suscripciones (semanas 11-16)

Orden recomendado:

1. **BILL-01 — Spike de Stripe**
   - Validar Checkout, Customer Portal, Tax, webhooks y dunning en modo test.
   - Crear producto y precio de 25 €/mes en EUR.
   - *Agente recomendado:* backend con experiencia en integraciones.

2. **BILL-02 — Migración y modelo de datos**
   - Columnas de billing en `tenant`, `subscription_event`, `subscription_invoice`, `billing_webhook_event`, `billing_reminder`.
   - Backfill: `admin_tenant` exento; resto en trial de 14 días.

3. **BILL-03 — Configuración de Stripe**
   - Dependencia `stripe-java`, propiedades, variables de entorno.
   - `stripe.enabled=false` para desarrollo local.

4. **BILL-04 — Máquina de estados y servicio de billing**
   - `TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `EXEMPT`, `CANCELLED`.
   - Transiciones y validaciones.

5. **BILL-05 — Checkout y Customer Portal**
   - Crear `Customer`, `Checkout Session` y `Portal Session`.
   - Vincular `tenant.stripe_customer_id` y `stripe_subscription_id`.

6. **BILL-06 — Webhooks**
   - Verificación de firma, idempotencia y procesamiento transaccional.
   - `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*`.

7. **BILL-07 — Middleware de suspensión**
   - `TenantBillingAccessInterceptor`.
   - Rutas exentas: `/billing/**`, `/users/me`, `/notifications/**`, webhook.
   - Cabeceras `X-Billing-Status` para el frontend.

8. **BILL-08 — Endpoints de superadmin**
   - Listado, configuración, trial, suspender/reactivar, eventos y facturas.
   - `billing_exempt` con motivo auditado.

9. **BILL-09 — Endpoints del admin del tenant**
   - Estado, checkout, portal, cancelar, reactivar, facturas y PDF.

10. **BILL-10 — Job diario y recordatorios**
    - Trial vencido, gracia agotada, cancelaciones vencidas.
    - Emails a 7/3/1 días de trial y 3/7/10 de gracia.
    - Idempotencia con `billing_reminder`.

11. **BILL-11 — Email y notificaciones**
    - `EmailService` + proveedor transaccional (Resend recomendado).
    - Plantillas de trial, fallo, suspensión, reactivación y factura.
    - Push/in-app a administradores del tenant.

12. **BILL-12 — Facturas**
    - Persistir facturas de Stripe.
    - PDF en MinIO + URL firmada.
    - Numeración local si se requiere.

13. **BILL-13 — Tests**
    - Máquina de estados, webhook, middleware, job.
    - Integración con Stripe CLI.

14. **BILL-14 — Contrato Angular**
    - `doc/contrato-api/billing/billing-frontend.md`.

> **Nota:** BILL-01 y BILL-02 pueden adelantarse al final de la Fase 0 si el agente termina antes. El resto es secuencial.

---

### Fase 1 — Planificar mejor (semanas 17-26)

Orden recomendado:

1. **T9 — Paginación en listados largos**
   - Transversal. Mejor hacerlo al inicio para no tocar los mismos endpoints dos veces.

2. **T10 — ETag/`If-Match` en menús y comidas**
   - Afecta a cómo el frontend edita menús. Coordinar con Flutter.

3. **T11 — `tenant.timezone` + hora de recordatorio**
   - Cambio en job programado. Relativamente aislado.

4. **T12 — `Idempotency-Key` en POST críticos**
   - Infraestructura con Redis. Puede hacerse en paralelo con T13.

5. **T13 — Buzón de notificaciones + replay SSE**
   - Requiere Redis. Base para P7 (chat).

6. **P4 — Recetario CRUD + importación + recetas públicas**
   - Independiente de P3. Puede empezarse mientras se define el modelo de intercambios.
   - Incluye recetas `PUBLIC` (superadmin) y `TENANT`, clonación e imágenes en MinIO.

7. **P3 — Intercambios v1 + planificador por raciones**
   - Bloquea parte de P6 (PDF enriquecido) y P17 (IA generativa).
   - Requiere T6 cerrado.

8. **P5 — Diario y adherencia v1**
   - Puede desarrollarse en paralelo con P3/P4.

9. **P6 — PDF de menú enriquecido**
   - Depende de P4 (recetas), T21 (MinIO) y P3 (intercambios, opcional).
   - Cierre de Fase 1.

---

### Fase 2 — Conectar (semanas 27-32)

Orden recomendado:

1. **T15/T16 — Auditoría + soft delete**
   - Transversal. Es más fácil activar la auditoría antes de añadir muchos endpoints nuevos en esta fase.

2. **P7 — Chat v1 (SSE + push + imágenes en MinIO)**
   - Requiere T13 (buzón), T21 (MinIO) y Redis. Es la tarea más grande de esta fase.

3. **P9 — Recurrencia de citas**
   - Extiende `AppointmentService`. Hacer antes de P10.

4. **P10 — Lista de espera + `recoveredSlots`**
   - Depende de P9 y de la cancelación de citas.

5. **P12 — Importación InBody / báscula**
   - Aislado. Puede hacerse en paralelo con P13.

6. **P13 — Google Calendar bidireccional**
   - Requiere configuración Google Cloud fuera del desarrollo.
   - Reservar tiempo para OAuth y pruebas de integración.

---

### Fase 3 — Automatizar (semanas 33-38)

Orden recomendado:

1. **T18 — Dinero tipado + moneda por tenant**
   - Preparación técnica. Depende de T2 (hecho en Fase 0).

2. **P19 — Fórmulas predictivas**
   - Aislado. Puede hacerse en paralelo.

3. **P14 — Contenido educativo + asignaciones**
   - Independiente de IA/reglas. Archivos multimedia en MinIO (T21).

4. **P15 — Labs / analíticas**
   - Independiente. Puede paralelizarse con P14. Archivos en MinIO (T21).

5. **Spike: P17 (generador IA) + P18 (motor de reglas)**
   - Antes de comprometer, validar viabilidad técnica y coste de Gemini.

6. **P17 — Generador asistido por IA sobre intercambios**
   - Depende de P3 y P4.

7. **P18 — Motor de reglas por patología**
   - Depende de P3, P4, P5 y P15.

8. **T19 — Rate limiting y cuotas por tenant**
   - Infraestructura con Redis.

9. **T20 — Webhooks de eventos**
   - Depende de T19 y de los eventos generados en P7/P9/P1.

---

## 3. Propuesta de sprints (2 semanas cada uno)

| Sprint | Semanas | Tareas principales |
|---|---|---|
| **Sprint 1** | 1-2 | T1 (Gemini), T21 (MinIO) |
| **Sprint 2** | 3-4 | T6 (enums), T3 (ProblemDetail) |
| **Sprint 3** | 5-6 | T4 (OpenAPI), T2 (price), T5 (PATCH preferencias) |
| **Sprint 4** | 7-8 | T7 (joinedAt/visitas), T8 (IMC estable) |
| **Sprint 5** | 9-10 | P1 (estado clínico), P2 (toggle nutrientes) |
| **Sprint 6** | 11-12 | BILL-01 (spike Stripe), BILL-02 (migración), BILL-03 (config), BILL-04 (estados) |
| **Sprint 7** | 13-14 | BILL-05 (checkout/portal), BILL-06 (webhooks), BILL-07 (middleware) |
| **Sprint 8** | 15-16 | BILL-08 (superadmin), BILL-09 (tenant), BILL-10 (job), BILL-11 (email), BILL-12 (facturas), BILL-13 (tests), BILL-14 (contrato Angular) |
| **Sprint 9** | 17-18 | T9 (paginación), T10 (ETag), T11 (timezone) |
| **Sprint 10** | 19-20 | T12 (idempotencia), T13 (buzón notificaciones) |
| **Sprint 11** | 21-22 | P4 (recetario + públicas + MinIO), inicio P3 (intercambios) |
| **Sprint 12** | 23-24 | P3 (intercambios), P5 (diario/adherencia) |
| **Sprint 13** | 25-26 | P6 (PDF + MinIO), cierre Fase 1 |
| **Sprint 14** | 27-28 | T15/T16 (auditoría + soft delete), inicio P7 (chat) |
| **Sprint 15** | 29-30 | P7 (chat con imágenes en MinIO), P9 (recurrencia) |
| **Sprint 16** | 31-32 | P10 (waitlist), P12 (InBody), P13 (Google Calendar) |
| **Sprint 17** | 33-34 | T18 (moneda), P19 (fórmulas), P14 (contenido + MinIO) |
| **Sprint 18** | 35-36 | P15 (labs + MinIO), spike P17/P18 |
| **Sprint 19** | 37-38 | P17 (IA), P18 (reglas), T19/T20 (rate limiting + webhooks) |

> **Nota:** la Fase 0 ocupa 5 sprints (10 semanas) en el calendario, aunque el trabajo efectivo estimado sea 4-5 semanas; el resto es margen para migraciones, revisión y carga de 1 backend.

> **Nota:** la Fase 0B (Stripe) añade 3 sprints (~6 semanas). El calendario pasa de 16 a 19 sprints (~38 semanas), dentro del margen de 9 meses.

> **Nota:** con 1 backend, los sprints están muy cargados. Se recomienda reservar margen (15-20 %) para bugs, soporte y revisión de PRs.

---

## 4. Paralelismo posible

Aunque hay 1 backend, algunas tareas son lo suficientemente independientes como para intercalarlas:

- **T3 + T4 + T12 + T13:** infraestructura/contracto. Se pueden trabajar en paralelo si el agente maneja bien las ramas.
- **T21 (MinIO):** infraestructura aislada; puede hacerse en paralelo con T1/T3/T4.
- **BILL-01 + BILL-02:** el spike de Stripe y la migración pueden solaparse al final de la Fase 0.
- **BILL-08 + BILL-09 + BILL-11 + BILL-12:** una vez cerrados los estados y webhooks, se pueden repartir.
- **P4 (recetario) y P5 (diario):** no se bloquean mutuamente.
- **P12 (InBody) y P13 (Google Calendar):** integraciones externas independientes.
- **P14 (contenido) y P15 (labs):** dominios distintos.

**Evitar paralelizar:**
- T6 con P3/P4/P5/P6 (los enums deben estar cerrados).
- T21 con P4/P6/P7/P14/P15 (los adjuntos dependen de MinIO).
- BILL-04 con BILL-05/06/07 (la máquina de estados es la base).
- BILL-07 con BILL-08/09 (el middleware debe estar probado antes de exponer paneles).
- P7 con T13 (el buzón es base del chat).
- P17 con P18 (ambos dependen de P3/P4; pueden entrarse, pero comparten modelo de datos).

---

## 5. Puntos de sincronización con frontend

Antes de empezar estas tareas, coordinar con el equipo Flutter/web:

| Tarea | Qué necesita frontend |
|---|---|
| T3/T4 | Adaptarse al nuevo formato de errores y OpenAPI. |
| T6 | Conocer valores finales de `DayOfWeek`/`MealType`. |
| T7 | Mostrar `joinedAt`, `lastVisitDate`, `lastNoShowDate`. |
| T10 | Enviar `If-Match` y manejar `409`. |
| T13 | Conectar `Last-Event-ID` y leer buzón. |
| T21 | Consumir URLs firmadas de MinIO para logos, PDFs e imágenes. |
| BILL | Pantallas de estado, checkout, portal, facturas y suspensión; banner global. |
| P3 | Nueva UI de planificación por raciones. |
| P4 | Biblioteca de recetas propias y públicas, clonación e instanciación; imágenes por URL firmada. |
| P5 | Pantalla de diario y adherencia. |
| P7 | Pantalla de chat con imágenes servidas por URL firmada. |
| P9 | UI de series recurrentes. |
| P10 | UI de lista de espera y ofertas. |
| P13 | OAuth Google Calendar. |

---

## 6. Recomendaciones para asignar agentes

### Agente A — Contrato y seguridad
- Tareas: T1, T3, T4, T5, T19.
- Perfil: seguridad, OpenAPI, manejo de excepciones.

### Agente B — Datos y core clínico
- Tareas: T6, T7, T8, P1, P2, T15/T16.
- Perfil: JPA, Flyway, lógica de negocio clínica.

### Agente C — Planificación dietética
- Tareas: P3, P4, P5, P6, P17, P18.
- Perfil: dominio nutricional, cálculos, generación de contenido/PDF, recetas públicas y por tenant.

### Agente D — Conectividad e integraciones
- Tareas: T21, T12, T13, P7, P9, P10, P12, P13, T20.
- Perfil: MinIO/S3, Redis, SSE, push, OAuth, integraciones externas.

### Agente E — Automatización y escalabilidad
- Tareas: P14, P15, P19, T18, T20.
- Perfil: contenido, cálculos, webhooks, rate limiting.

### Agente F — Billing y cumplimiento
- Tareas: BILL-01 a BILL-14.
- Perfil: Stripe, suscripciones, webhooks, email transaccional, fiscalidad.
- *Apoyo externo:* asesor fiscal para IVA/Verifactu y revisión de facturas.

> En la práctica, con 1 backend estas asignaciones se solapan. Úsalo como mapa de habilidades, no como roles rígidos.

---

## 7. Checklist de inicio de cada fase

Antes de que un agente empiece una fase:

- [ ] Leer `README.md` y el archivo de la fase correspondiente.
- [ ] Verificar que los prerrequisitos de fases anteriores están mergeados.
- [ ] Confirmar con frontend los endpoints/DTOs que cambian.
- [ ] Tener dump de producción o datos de test para migraciones.
- [ ] Confirmar acceso a Redis, Google Cloud, etc. si la fase lo requiere.
- [ ] Para Fase 0B: cuenta de Stripe verificada, webhook público en staging, proveedor de email y revisión fiscal.
