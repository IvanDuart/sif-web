# Frontend — sif-web

Documentación del desarrollo de la aplicación web Angular: guías de integración, decisiones de UX, arquitectura del cliente y planes de mejora.

> Para los contratos de backend (endpoints, DTOs, reglas), ver [`../contrato-api/`](../contrato-api/README.md).
> Para planes de futuro, ver [`../roadmap/`](../roadmap/README.md).

---

## Dominios

| Carpeta | Contenido |
|---|---|
| [`appointments/`](appointments/README.md) | Integración de citas, calendario, notas del nutricionista, métricas y precios. |
| [`body-composition/`](body-composition/README.md) | Guías de integración del informe de composición corporal. |
| [`menus/`](menus/README.md) | Integración de menús, BEDCA y subida de plantillas con IA. |
| [`notifications/`](notifications/README.md) | Integración del canal SSE en la web. |
| [`patients/`](patients/README.md) | Listados, filtros y flujos de pacientes. |
| [`ai/`](ai/README.md) | Renderizado de la lista de la compra generada por IA. |
| [`assistant/`](assistant/README.md) | *(Reservado)* Implementación Angular de NutrIA. |
| [`chat/`](chat/README.md) | *(Reservado)* Implementación Angular del chat 1:1. |
| [`mascot/`](mascot/README.md) | Planes de mejora y ejemplos de implementación de la mascota. |
| [`billing/`](billing/README.md) | *(Reservado)* Implementación Angular de facturación/suscripciones. |

---

## Convenciones

- El stack es Angular 21, Taiga UI v5, Tailwind CSS, Font Awesome 7, Chart.js, FullCalendar y Maskito.
- La gestión de estado usa **Angular signals** (`signal`, `computed`, `effect`).
- Las páginas lazy-loaded son componentes standalone exportados por defecto (`*.page.ts`).
- Los servicios HTTP del frontend viven en `src/app/core/api/services/*.api.ts` y reciben `tenantId` como primer argumento.
- Cualquier nueva funcionalidad debe documentar su integración frontend aquí y su contrato en `../contrato-api/`.
