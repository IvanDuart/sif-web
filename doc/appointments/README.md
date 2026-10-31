# Citas, agenda y precios

Documentación del módulo de citas: creación, tipos, recordatorios, reagendamiento, solapes, calendario del nutricionista, horarios del centro, relación paciente–nutricionista, métricas y precios de consultas.

## Documentos

| Documento | Contenido |
|---|---|
| [`appointments.md`](appointments.md) | Módulo de citas: reglas de negocio, estados, endpoints y seguridad. |
| [`appointment_types.md`](appointment_types.md) | Catálogo de tipos de cita por tenant, duraciones y borrado lógico. |
| [`appointment_reminders.md`](appointment_reminders.md) | Job diario de recordatorios push y preferencia `enable_appointment_reminders`. |
| [`appointment_overlap_frontend.md`](appointment_overlap_frontend.md) | Cómo permitir solapes de citas al staff con `allowOverlap`. |
| [`appointment_reschedule.md`](appointment_reschedule.md) | Reagendamiento de citas y recálculo de `endTime`. |
| [`appointments_without_patient.md`](appointments_without_patient.md) | Citas sin paciente para primeras consultas. |
| [`citas_pacientes_onesignal.md`](citas_pacientes_onesignal.md) | Solicitud de citas por pacientes, estados `PROPOSED` y push con OneSignal. |
| [`calendario_notas_nutricionista_frontend.md`](calendario_notas_nutricionista_frontend.md) | Notas personales y bloqueos de horario del nutricionista. |
| [`horarios_centros.md`](horarios_centros.md) | Perfil del centro, jornadas, asignaciones de horario y festivos. |
| [`relacion_paciente_nutricionista.md`](relacion_paciente_nutricionista.md) | Nutricionista titular persistido, cartera de pacientes y suplencias. |
| [`metricas_asistencia_frontend.md`](metricas_asistencia_frontend.md) | Endpoint agregado de métricas de facturación y asistencia. |
| [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) | Resumen ejecutivo de la funcionalidad de precios de consultas. |
| [`FEATURE_APPOINTMENT_PRICING.md`](FEATURE_APPOINTMENT_PRICING.md) | Especificación técnica completa de precios de consultas. |
| [`FRONTEND_INTEGRATION_GUIDE.md`](FRONTEND_INTEGRATION_GUIDE.md) | Guía de integración frontend de precios de consultas. |
| [`API_TESTING_GUIDE.md`](API_TESTING_GUIDE.md) | Ejemplos de cURL, script Bash y colección Postman. |

## Orden de lectura sugerido

1. **Para entender el módulo:** `appointments.md` → `appointment_types.md` → `relacion_paciente_nutricionista.md`.
2. **Para agenda y disponibilidad:** `horarios_centros.md` → `calendario_notas_nutricionista_frontend.md` → `appointment_overlap_frontend.md`.
3. **Para precios:** `EXECUTIVE_SUMMARY.md` → `FEATURE_APPOINTMENT_PRICING.md` → `FRONTEND_INTEGRATION_GUIDE.md` → `API_TESTING_GUIDE.md`.
4. **Para métricas:** `metricas_asistencia_frontend.md`.

## Relaciones con otros dominios

- **Notificaciones:** los eventos de cita se entregan por push y SSE. Ver [`../notifications/sse-notificaciones-frontend.md`](../notifications/sse-notificaciones-frontend.md).
- **Pacientes:** la cartera y el estado clínico afectan a la agenda. Ver [`../patients/clinical-status.md`](../patients/clinical-status.md) y [`../patients/listado_pacientes_frontend.md`](../patients/listado_pacientes_frontend.md).
- **Seguridad:** los permisos de citas y usuarios se describen en [`../security/`](../security/README.md).
- **Arquitectura:** la creación de tenants genera tipos de cita y horarios por defecto. Ver [`../architecture/tenant-creation-workflow.md`](../architecture/tenant-creation-workflow.md).

## Notas

- `citas_pacientes_onesignal.md` es el documento puente entre citas y notificaciones: el dominio principal es citas, pero el contrato de `data`/`additionalData` se reutiliza en SSE.
- La suite de precios (`EXECUTIVE_SUMMARY`, `FEATURE_APPOINTMENT_PRICING`, `FRONTEND_INTEGRATION_GUIDE`, `API_TESTING_GUIDE`) se mantiene unida porque describe una misma funcionalidad desde distintas audiencias.
