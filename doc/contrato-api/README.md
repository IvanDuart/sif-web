# Contrato API

Documentación del backend de *Tus Dietas*: contratos REST/SSE, endpoints, DTOs, reglas de negocio, permisos, migraciones y peticiones pendientes.

> Para la integración Angular, arquitectura del frontend y decisiones de UX, ver [`../frontend/`](../frontend/README.md).
> Para planes de futuro, ver [`../roadmap/`](../roadmap/README.md).

---

## Documentos transversales

| Documento | Contenido |
|---|---|
| [`api-docs.json`](api-docs.json) | Especificación OpenAPI/Swagger del backend. |
| [`breaking-changes.md`](breaking-changes.md) | Cambios incompatibles que afectan a web y app móvil. |

## Dominios

| Carpeta | Contenido |
|---|---|
| [`appointments/`](appointments/README.md) | Citas, agenda, tipos de cita, horarios, festivos, relación paciente–nutricionista, precios y métricas. |
| [`architecture/`](architecture/README.md) | Creación de tenants, MinIO, versionado de app y evolución del modelo. |
| [`body-composition/`](body-composition/README.md) | Mediciones, informe clínico, análisis segmental y PDF. |
| [`menus/`](menus/README.md) | Menús, plantillas, comidas, BEDCA, subida con IA y SSE. |
| [`notifications/`](notifications/README.md) | Contratos de push (OneSignal) y SSE. |
| [`patients/`](patients/README.md) | Perfil clínico, anamnesis, estado clínico, eventos y campos fijos. |
| [`security/`](security/README.md) | Autenticación, permisos, usuarios, roles y ciclo de vida de cuentas. |
| [`ai/`](ai/README.md) | Gemini, lista de la compra con IA. |
| [`assistant/`](assistant/README.md) | NutrIA: asistente conversacional para nutricionistas. |
| [`chat/`](chat/README.md) | Chat 1:1 paciente–nutricionista. |
| [`mascot/`](mascot/README.md) | Mascota conversacional: contrato API y peticiones al backend. |
| [`billing/`](billing/README.md) | Facturación por tenant y estados de suscripción. |

---

## Convenciones

- Los endpoints usan el prefijo `/api/tenant/{tenantId}` salvo que el documento indique lo contrario.
- Las respuestas de error devuelven `{ "error": "..." }` o `ProblemDetail` según se indique en cada documento.
- La paginación vigente usa el formato **PagedModel**: `{ content: [...], page: { size, number, totalElements, totalPages } }`.
