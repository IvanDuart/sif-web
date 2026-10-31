# Plan de Mejoras Backend — Tus Dietas

> **Ubicación:** `doc/roadmap/plan-mejoras/`  
> **Propósito:** guía de implantación por fases para que diferentes agentes o sesiones puedan ejecutar cada fase de forma independiente.  
> **Estado:** plan cerrado tras revisión de código y decisiones de producto.  
> **Última actualización:** 2026-10-29

---

## 1. Contexto del proyecto

- **Stack backend:** Spring Boot 4.1.1, Java 25, PostgreSQL, Flyway, Keycloak (JWT), Springdoc OpenAPI 3.1.1, Redis disponible.
- **Repositorio:** monolito en `/home/ivan/IdeaProjects/tus-dietas`.
- **App móvil:** Flutter (ya existe) y web en Angular. Cualquier breaking change debe coordinarse con frontend.
- **Context-path actual:** `/api`. **No se hará versionado `/api/v1` en este roadmap** para reducir complejidad.
- **Almacenamiento de objetos:** MinIO ya desplegado. Bucket privado; el backend genera URLs firmadas para logos, PDFs, imágenes de recetas, adjuntos de chat y archivos de labs.
- **Cobro:** suscripción mensual fija por tenant con Stripe. El resto de pagos (citas, profesionales) sigue fuera de alcance.
- **Equipo:** 1 backend dedicado. Roadmap completo estimado: ~36-38 semanas (~8,5-9 meses) de backend.

---

## 2. Decisiones de producto cerradas

| Tema | Decisión |
|---|---|
| Nutrientes | `HIDDEN` por defecto a nivel tenant. La clínica decide si activar `MACROS` o `FULL`. |
| Alta clínica | `DISCHARGED` mantiene acceso de solo lectura a historial. |
| Citas futuras | 1 cita activa por defecto; configurable por tenant. |
| Anamnesis | Solo el profesional la rellena/edita. |
| Recetario | Biblioteca propia + importación CSV/JSON controlada. Habrá recetas **públicas** (gestionadas por superadmin de plataforma, visibles para todos los tenants) y recetas **propias** de cada tenant. Las públicas son de solo lectura, pero clonables a una receta propia editable. |
| IA Gemini | Siempre clave del centro; se enmascara y cifra, sin modo "cuota incluida". |
| Intercambios | Configurable por centro (`exchangeGroupsEnabled`, default `false`). |
| Chat | Texto + imágenes con límite de tamaño. Sin datos clínicos sensibles en push. |
| Suscripción | **25 €/mes fijo por tenant**, cobrado con Stripe (Billing + Tax). Trial de 14 días por defecto. Si falla el pago, **10 días de gracia con acceso completo**; después el tenant queda `SUSPENDED`. El admin conserva acceso a billing para pagar. El superadmin puede marcar tenants como exentos (tenant de prueba, partners, lifetime). |
| Reserva pública | **Fuera de roadmap.** Solo se habilitará un endpoint de solicitud de cita desde web si se decide más adelante. |
| Almacenamiento de objetos | **MinIO** (S3 compatible) ya desplegado. Se usa para logos, PDFs, imágenes de recetas, adjuntos de chat y archivos de labs. Bucket privado con URLs firmadas. |

---

## 3. Estructura del plan

Cada fase tiene su propio archivo markdown. Un agente debe poder leer solo el archivo de la fase asignada y el presente `README.md` para entender el contexto.

| Fase | Archivo | Objetivo | Semanas estimadas |
|---|---|---|---|
| 0 | [`fase-0-endurecer.md`](fase-0-endurecer.md) | Seguridad, contrato API, datos correctos, estado clínico e integración base con MinIO. | 4-5 |
| 0B | [`fase-0b-suscripciones.md`](fase-0b-suscripciones.md) | Suscripción mensual por tenant con Stripe, trial, gracia de 10 días, suspensión y facturación. | 5-6 |
| 1 | [`fase-1-planificar.md`](fase-1-planificar.md) | Intercambios, recetario público y por tenant, diario/adherencia, PDF enriquecido. | 8-9 |
| 2 | [`fase-2-conectar.md`](fase-2-conectar.md) | Chat, recurrencia, lista de espera, integraciones, auditoría. | 6-7 |
| 3 | [`fase-3-automatizar.md`](fase-3-automatizar.md) | IA, motor de reglas, educación, labs, rate limiting, webhooks. | 8-9 |

---

## 4. Convenciones para los agentes

### 4.1 Antes de empezar una fase
1. Leer este `README.md`.
2. Leer el archivo de la fase asignada.
3. Revisar el código existente en `src/main/java/com/carajillolabs/tusdietas`.
4. No asumir que los DTOs/documentación antigua (`scripts/api-docs.json`) están actualizados; la fuente de verdad es el código Java.

### 4.2 Durante la implementación
- Usar **Flyway** para todas las migraciones de base de datos (`src/main/resources/db/migration/VNN__descripcion.sql`).
- Mantener el estilo existente: Lombok, records para DTOs inmutables, `JsonViews` para control de serialización, `@PreAuthorize` para permisos.
- Cualquier breaking change en DTOs/respuestas debe documentarse en `doc/breaking-changes.md`.
- Añadir tests unitarios y/o de integración para lógica nueva.
- No modificar lógica de negocio existente si no es estrictamente necesario; si se hace, justificarlo.

### 4.3 Al finalizar una fase
- Actualizar este README si una decisión cambia.
- Actualizar `doc/API.md` o la documentación de endpoints afectados.
- Verificar que la aplicación compila (`./mvnw clean verify` o `mvn clean verify`).
- Dejar anotadas las deudas técnicas o tareas aplazadas para la siguiente fase.

---

## 5. Riesgos transversales

1. **1 backend = cuello de botella.** Cualquier baja o pico de soporte retrasa el roadmap.
2. **Migraciones irreversibles.** Fase 0 toca enums y datos históricos; probar migraciones con dump de producción antes de desplegar.
3. **Dependencia frontend.** Intercambios, diario, chat y billing requieren cambios en Flutter/Angular; coordinar con el equipo frontend.
4. **Integraciones externas.** Google Calendar requiere app en Google Cloud y consentimiento OAuth fuera del desarrollo. Stripe requiere cuenta verificada, webhook público y revisión fiscal.
5. **Cobro y suspensión.** Un error en el webhook o en el job de gracia puede cortar el acceso a un tenant que sí ha pagado. Mitigar con idempotencia, overrides manuales y alertas.

---

## 6. Glosario de abreviaturas

- `Tenant`: centro / clínica.
- `UTR`: `UserTenantRole`, membresía de un usuario en un tenant.
- `SSE`: Server-Sent Events.
- `KMS`: Key Management Service (para cifrado de secretos).
- `GDPR`: Reglamento General de Protección de Datos.
- `Stripe Billing`: gestión de suscripciones recurrentes.
- `Trial`: periodo de prueba sin cobro.
- `Gracia`: 10 días de acceso completo tras un fallo de pago antes de suspender.
- `Exento`: tenant que no se factura (`billing_exempt`).
