# Documentación — Tus Dietas / sif-web

Índice maestro de la documentación técnica y funcional del proyecto.

> **Última reorganización:** 2026-11-02. La documentación se divide ahora en dos áreas bien diferenciadas:
> - **`doc/contrato-api/`**: contratos, endpoints, reglas de negocio y funcionalidades del backend (implementadas o pendientes).
> - **`doc/frontend/`**: guías de integración, arquitectura, decisiones de UX y planes de desarrollo de la aplicación web Angular.
>
> Antes de modificar cualquier documento, lee [`AGENT.md`](../AGENT.md) para conocer las normas de mantenimiento.

---

## 1. Estructura

```text
doc/
├── README.md                     # Este índice maestro
├── AGENT.md                      # Normas para agentes: dónde documentar y cómo mantener
├── contrato-api/                 # Backend: contratos, endpoints, reglas de negocio
│   ├── README.md
│   ├── api-docs.json             # OpenAPI/Swagger del backend
│   ├── breaking-changes.md       # Cambios incompatibles entre versiones
│   ├── appointments/
│   ├── architecture/
│   ├── body-composition/
│   ├── menus/
│   ├── notifications/
│   ├── patients/
│   ├── security/
│   ├── ai/
│   ├── assistant/
│   ├── chat/
│   ├── mascot/
│   └── billing/
├── frontend/                     # Frontend Angular: integración, UX, arquitectura
│   ├── README.md
│   ├── appointments/
│   ├── body-composition/
│   ├── menus/
│   ├── notifications/
│   ├── patients/
│   ├── ai/
│   ├── assistant/
│   ├── chat/
│   ├── mascot/
│   └── billing/
├── roadmap/                      # Planes de futuro y sesiones por fases
│   ├── plan-mejoras/
│   └── plan-chat-mascota/
└── assets/                       # Imágenes y recursos compartidos
```

---

## 2. ¿Dónde va cada cosa?

| Tipo de documento | Va en |
|---|---|
| Contrato REST/SSE, endpoints, DTOs, permisos, migraciones | `doc/contrato-api/` |
| Peticiones de cambio al backend, bugs de API, reglas de negocio | `doc/contrato-api/` |
| Guía de integración Angular, decisiones de UX, ejemplos de código frontend | `doc/frontend/` |
| Planes de mejora/prototipo de funcionalidades web | `doc/frontend/` |
| Roadmap de fases, orden de ejecución, sesiones de agentes | `doc/roadmap/` |
| Cambios incompatibles para clientes (web/app) | `doc/contrato-api/breaking-changes.md` |
| Especificación OpenAPI/Swagger | `doc/contrato-api/api-docs.json` |

---

## 3. Índice rápido por área

### Backend / contrato-api

- [`contrato-api/appointments/`](contrato-api/appointments/README.md) — citas, agenda, horarios, precios.
- [`contrato-api/architecture/`](contrato-api/architecture/README.md) — tenants, MinIO, versionado, evolución del modelo.
- [`contrato-api/body-composition/`](contrato-api/body-composition/README.md) — mediciones, informe clínico, PDF.
- [`contrato-api/menus/`](contrato-api/menus/README.md) — menús, plantillas, BEDCA, SSE de menú.
- [`contrato-api/notifications/`](contrato-api/notifications/README.md) — canales push/SSE (contratos).
- [`contrato-api/patients/`](contrato-api/patients/README.md) — perfil clínico, anamnesis, estado clínico.
- [`contrato-api/security/`](contrato-api/security/README.md) — autenticación, permisos, usuarios, roles.
- [`contrato-api/ai/`](contrato-api/ai/README.md) — Gemini, lista de la compra.
- [`contrato-api/assistant/`](contrato-api/assistant/README.md) — NutrIA / asistente para nutricionistas.
- [`contrato-api/chat/`](contrato-api/chat/README.md) — chat 1:1 paciente–nutricionista.
- [`contrato-api/mascot/`](contrato-api/mascot/README.md) — mascota conversacional (contrato API).
- [`contrato-api/billing/`](contrato-api/billing/README.md) — facturación por tenant.
- [`contrato-api/breaking-changes.md`](contrato-api/breaking-changes.md) — cambios incompatibles.
- [`contrato-api/api-docs.json`](contrato-api/api-docs.json) — OpenAPI.

### Frontend

- [`frontend/appointments/`](frontend/appointments/README.md) — integración de citas, calendario, métricas.
- [`frontend/body-composition/`](frontend/body-composition/README.md) — guías de integración del informe corporal.
- [`frontend/menus/`](frontend/menus/README.md) — integración de menús, BEDCA, subida de plantillas.
- [`frontend/notifications/`](frontend/notifications/README.md) — integración SSE en la web.
- [`frontend/patients/`](frontend/patients/README.md) — listados y flujos de pacientes.
- [`frontend/ai/`](frontend/ai/README.md) — renderizado de lista de la compra IA.
- [`frontend/assistant/`](frontend/assistant/README.md) — *(reservado)* implementación Angular del asistente.
- [`frontend/chat/`](frontend/chat/README.md) — *(reservado)* implementación Angular del chat.
- [`frontend/mascot/`](frontend/mascot/README.md) — planes de mejora de la mascota.
- [`frontend/billing/`](frontend/billing/README.md) — *(reservado)* implementación Angular de facturación.

### Roadmap

- [`roadmap/plan-mejoras/`](roadmap/plan-mejoras/README.md) — roadmap backend por fases.
- [`roadmap/plan-chat-mascota/`](roadmap/plan-chat-mascota/README.md) — planes independientes de chat y mascota.

---

## 4. Convenciones

- Los enlaces internos son **relativos** al archivo que los contiene.
- Cada carpeta de dominio tiene su propio `README.md` con el índice de su área.
- `breaking-changes.md` vive en `contrato-api/` porque afecta al contrato con los clientes.
- Los planes de futuro viven en `roadmap/` y no deben mezclarse con la documentación del sistema actual.
- Al añadir, mover o eliminar un documento, actualiza los READMEs afectados y, si cambia un contrato o una decisión de arquitectura, [`AGENT.md`](../AGENT.md).
