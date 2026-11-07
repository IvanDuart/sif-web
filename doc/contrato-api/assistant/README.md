# Asistente, mascota y chat

Documentación del asistente conversacional, la mascota y el chat 1:1 paciente–nutricionista.

## Documentos

| Documento | Contenido |
|---|---|
| [`mascota-frontend.md`](mascota-frontend.md) | Contrato de la mascota conversacional: sesiones, consentimiento, look, catálogo y acciones pendientes. |
| [`assistant-frontend.md`](assistant-frontend.md) | Contrato del asistente para nutricionistas: pantallas, tools, streaming SSE, `uiActions` y `pendingAction`. |
| [`assistant-tools-backend.md`](assistant-tools-backend.md) | Catálogo de tools del asistente y guía de implementación backend. |
| [`assistant-backend-peticion.md`](assistant-backend-peticion.md) | Peticiones de protocolo al backend: streaming, tipos de `uiAction`, reanudación de sesión. |
| [`chat-frontend.md`](chat-frontend.md) | Contrato del chat 1:1: hilos, mensajes, adjuntos, SSE y notificaciones push. |

## Orden de lectura sugerido

1. **Para la mascota (paciente):** `mascota-frontend.md`.
2. **Para el asistente (nutricionista):** `assistant-frontend.md` → `assistant-tools-backend.md`.
3. **Para el protocolo SSE y sesiones:** `assistant-backend-peticion.md`.
4. **Para el chat 1:1:** `chat-frontend.md`.

## Relaciones con otros dominios

- **Citas:** el asistente puede consultar y gestionar agenda, tipos de cita y horarios del centro. Ver [`../appointments/appointments.md`](../appointments/appointments.md) y [`../appointments/horarios_centros.md`](../appointments/horarios_centros.md).
- **Pacientes:** el asistente accede a ficha, anamnesis y mediciones. Ver [`../patients/patient_profile.md`](../patients/patient_profile.md), [`../patients/anamnesis_checklist_fields.md`](../patients/anamnesis_checklist_fields.md) y [`../patients/water_intake_and_anamnesis_config.md`](../patients/water_intake_and_anamnesis_config.md).
- **Menús:** tools de creación de menús desde plantillas y búsqueda de alimentos. Ver [`../menus/menuTemplateUpload.md`](../menus/menuTemplateUpload.md) y [`../menus/menus-estructurados-bedca-frontend.md`](../menus/menus-estructurados-bedca-frontend.md).
- **Composición corporal:** tool de registro y actualización de mediciones. Ver [`../body-composition/body_composition_and_segmental_measurements.md`](../body-composition/body_composition_and_segmental_measurements.md).
- **Notificaciones/SSE:** el chat y el asistente comparten infraestructura de SSE y push. Ver [`../notifications/sse-notificaciones-frontend.md`](../notifications/sse-notificaciones-frontend.md).
- **Arquitectura:** almacenamiento de adjuntos en MinIO. Ver [`../architecture/minio-storage.md`](../architecture/minio-storage.md).
- **IA:** la clave de Gemini se guarda cifrada en las preferencias del tenant. Ver [`../ai/ai-shopping-list.md`](../ai/ai-shopping-list.md).

## Notas

- La mascota y el asistente comparten parte de la infraestructura conversacional pero tienen audiencias distintas: la mascota orienta al paciente y el asistente acelera la consulta del nutricionista.
- Ninguna escritura del asistente o la mascota se aplica sin una `pendingAction` confirmada explícitamente por el usuario.
- El chat 1:1 es independiente de la conversación con la mascota: un canal de mensajería directa entre paciente y nutricionista.
