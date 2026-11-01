# Documentación — Tus Dietas

Índice maestro de la documentación técnica y funcional del proyecto.

> **Última reorganización:** 2026-10-30. La documentación se agrupó por dominio funcional y áreas transversales para dejar de ser un “cajón de sastre”.
>
> Si buscas algo concreto y no lo encuentras aquí, revisa primero el README de la carpeta del dominio correspondiente.

---

## 1. Estructura

```text
doc/
├── README.md                  # Este índice maestro
├── breaking-changes.md        # Cambios incompatibles para clientes (transversal)
│
├── architecture/              # Plataforma, infraestructura y decisiones transversales
├── security/                  # Autenticación, permisos, usuarios y roles
├── appointments/              # Citas, agenda, horarios, métricas y precios
├── patients/                  # Pacientes, perfil clínico y anamnesis
├── body-composition/          # Mediciones y composición corporal
├── menus/                     # Menús, comidas, plantillas y PDFs
├── ai/                        # IA (Gemini), lista de la compra y automatización
├── notifications/             # Push (OneSignal) y SSE
├── roadmap/                   # Planes de futuro
└── assets/                    # Imágenes y recursos
```

---

## 2. Índice por carpeta

### Arquitectura — [`architecture/`](architecture/README.md)

| Documento | Contenido |
|---|---|
| [`tenant-creation-workflow.md`](architecture/tenant-creation-workflow.md) | Creación de tenants y datos semilla. |
| [`minio-storage.md`](architecture/minio-storage.md) | Almacenamiento de objetos privados en MinIO. |
| [`app_version_control.md`](architecture/app_version_control.md) | Versionado de la app móvil y actualización obligatoria. |
| [`history.md`](architecture/history.md) | Histórico de cambios del modelo de datos (perfil, mediciones, menús). |

### Seguridad y usuarios — [`security/`](security/README.md)

| Documento | Contenido |
|---|---|
| [`disable_user.md`](security/disable_user.md) | Habilitar/deshabilitar usuarios y alcance de permisos. |
| [`userType.md`](security/userType.md) | Clasificación `STAFF` vs `PATIENT`. |
| [`user_locale_sync.md`](security/user_locale_sync.md) | Sincronización de zona horaria e idioma del usuario. |
| [`updateUser.md`](security/updateUser.md) | Actualización del perfil básico de usuario. |

### Citas y agenda — [`appointments/`](appointments/README.md)

| Documento | Contenido |
|---|---|
| [`appointments.md`](appointments/appointments.md) | Módulo de citas: reglas, endpoints y estados. |
| [`appointment_types.md`](appointments/appointment_types.md) | Tipos de cita por tenant. |
| [`appointment_reminders.md`](appointments/appointment_reminders.md) | Recordatorios automáticos de cita. |
| [`appointment_overlap_frontend.md`](appointments/appointment_overlap_frontend.md) | Solape de citas permitido para staff. |
| [`appointment_reschedule.md`](appointments/appointment_reschedule.md) | Reagendamiento de citas. |
| [`appointments_without_patient.md`](appointments/appointments_without_patient.md) | Citas sin paciente (primera consulta). |
| [`citas_pacientes_onesignal.md`](appointments/citas_pacientes_onesignal.md) | Solicitud de citas por pacientes y push con OneSignal. |
| [`calendario_notas_nutricionista_frontend.md`](appointments/calendario_notas_nutricionista_frontend.md) | Notas y bloqueos del calendario del nutricionista. |
| [`horarios_centros.md`](appointments/horarios_centros.md) | Horarios, festivos y perfil del centro. |
| [`relacion_paciente_nutricionista.md`](appointments/relacion_paciente_nutricionista.md) | Nutricionista titular y cartera de pacientes. |
| [`metricas_asistencia_frontend.md`](appointments/metricas_asistencia_frontend.md) | Métricas de facturación y asistencia. |
| [`EXECUTIVE_SUMMARY.md`](appointments/EXECUTIVE_SUMMARY.md) | Resumen ejecutivo de precios de consultas. |
| [`FEATURE_APPOINTMENT_PRICING.md`](appointments/FEATURE_APPOINTMENT_PRICING.md) | Especificación técnica de precios de consultas. |
| [`FRONTEND_INTEGRATION_GUIDE.md`](appointments/FRONTEND_INTEGRATION_GUIDE.md) | Integración frontend de precios de consultas. |
| [`API_TESTING_GUIDE.md`](appointments/API_TESTING_GUIDE.md) | Pruebas de API con cURL y Postman. |

### Pacientes y perfil clínico — [`patients/`](patients/README.md)

| Documento | Contenido |
|---|---|
| [`patient_profile.md`](patients/patient_profile.md) | Perfil médico y datos sensibles. |
| [`anamnesis_checklist_fields.md`](patients/anamnesis_checklist_fields.md) | Checklist estructurado de anamnesis. |
| [`water_intake_and_anamnesis_config.md`](patients/water_intake_and_anamnesis_config.md) | Consumo de agua y configuración de anamnesis. |
| [`observaciones_perfil.md`](patients/observaciones_perfil.md) | Observaciones libres del profesional. |
| [`patient_phone.md`](patients/patient_phone.md) | Teléfono del paciente. |
| [`patient_events.md`](patients/patient_events.md) | Eventos del paciente en calendario. |
| [`breakfast_snack.md`](patients/breakfast_snack.md) | Desayuno y merienda fijos. |
| [`lunch_meal.md`](patients/lunch_meal.md) | Almuerzo fijo. |
| [`clinical-status.md`](patients/clinical-status.md) | Estado clínico del paciente. |
| [`listado_pacientes_frontend.md`](patients/listado_pacientes_frontend.md) | Listado de pacientes: filtros, ordenación y CSV. |

### Composición corporal — [`body-composition/`](body-composition/README.md)

| Documento | Contenido |
|---|---|
| [`body_composition_and_segmental_measurements.md`](body-composition/body_composition_and_segmental_measurements.md) | Motor clínico de composición corporal y análisis segmental. |
| [`cambios-composicion-corporal-frontend.md`](body-composition/cambios-composicion-corporal-frontend.md) | Cambios API v1: masa muscular y grasa visceral. |
| [`cambios-composicion-corporal-v2-frontend.md`](body-composition/cambios-composicion-corporal-v2-frontend.md) | Cambios API v2: procedencia de datos y revisión de cálculos. |
| [`pdf-composicion-corporal.md`](body-composition/pdf-composicion-corporal.md) | PDF del informe de composición corporal. |
| [`measurements_and_gender.md`](body-composition/measurements_and_gender.md) | Nuevas mediciones y género del paciente. |

### Menús y nutrición — [`menus/`](menus/README.md)

| Documento | Contenido |
|---|---|
| [`menuTemplateUpload.md`](menus/menuTemplateUpload.md) | Subida de PDF/imagen para crear plantillas. |
| [`menu-template-upload-frontend-guide.md`](menus/menu-template-upload-frontend-guide.md) | Guía frontend de subida de plantillas con IA. |
| [`menu-template-upload-changes.md`](menus/menu-template-upload-changes.md) | Cambios backend de la subida de plantillas con Gemini. |
| [`menu-update-endpoint.md`](menus/menu-update-endpoint.md) | Edición parcial de menús. |
| [`meal-update-endpoint.md`](menus/meal-update-endpoint.md) | Edición de platos. |
| [`menuTemplateMeals.md`](menus/menuTemplateMeals.md) | CRUD de platos dentro de plantillas. |
| [`menu-pdf-and-tenant-contact.md`](menus/menu-pdf-and-tenant-contact.md) | PDF de menú y datos de contacto del centro. |
| [`sse-real-time-menu-frontend.md`](menus/sse-real-time-menu-frontend.md) | Actualización del menú en tiempo real por SSE. |
| [`menus-estructurados-bedca-frontend.md`](menus/menus-estructurados-bedca-frontend.md) | Menús estructurados con catálogo BEDCA. |

### IA y automatización — [`ai/`](ai/README.md)

| Documento | Contenido |
|---|---|
| [`ai-shopping-list.md`](ai/ai-shopping-list.md) | Generación de lista de la compra con Gemini. |
| [`categorias-lista-compra-supermercados.md`](ai/categorias-lista-compra-supermercados.md) | Categorías y secciones por supermercado. |

### Notificaciones — [`notifications/`](notifications/README.md)

| Documento | Contenido |
|---|---|
| [`sse-notificaciones-frontend.md`](notifications/sse-notificaciones-frontend.md) | Notificaciones en tiempo real por SSE. |
| [`chat-frontend.md`](chat-frontend.md) | Contrato del chat 1:1: REST, SSE, adjuntos y push. |
| [`mascota-frontend.md`](mascota-frontend.md) | Contrato de la mascota: sesiones, consentimiento, tools y acciones pendientes. |
| [`assistant-frontend.md`](assistant-frontend.md) | Contrato del asistente de nutricionista: pantallas, `uiActions` y `pendingAction`. |
| [`assistant-tools-backend.md`](assistant-tools-backend.md) | Tools que faltan en el backend: horarios del centro y el resto del catálogo, con el formato del `preview`. |
| [`assistant-backend-peticion.md`](assistant-backend-peticion.md) | Peticiones de protocolo al backend: streaming SSE, tipos de `uiAction`, pantallas y reanudación de sesión. |
| [`assistant-agendar-403-backend-peticion.md`](assistant-agendar-403-backend-peticion.md) | Petición al backend: agendar por NutrIA da 403 `error.permission_denied` desde el panel principal, incluso siendo el nutricionista asignado. |
| [`mascota-catalogo-backend-peticion.md`](mascota-catalogo-backend-peticion.md) | Petición al backend: registrar `naranja`, `pina` y `melon` en el catálogo de mascotas (el `PUT /look` las rechaza con 422). |
| [`mascota-catalogo-ampliacion-backend-peticion.md`](mascota-catalogo-ampliacion-backend-peticion.md) | Petición al backend: conservar `brocoli`, `semilla` y `zanahoria` (enmienda), catálogo de siete mascotas y regla `/pets` ↔ `PUT /look`. |
| [`mascota-adjuntos-backend-peticion.md`](mascota-adjuntos-backend-peticion.md) | Petición al backend: adjuntos en la conversación del asistente (subida, lectura por el modelo, límites y retención). |
| [`mascota-adjuntos-preguntas-backend.md`](mascota-adjuntos-preguntas-backend.md) | Dos preguntas abiertas antes de implementar los adjuntos: `attachmentId` en el endpoint de streaming y qué borra los adjuntos al cerrar la sesión. |
| [`mascota-memoria-usuario-backend-peticion.md`](mascota-memoria-usuario-backend-peticion.md) | Petición al backend: preferencias de proactividad e hitos de primera vez por usuario. |
| [`mascot-improvement-plan.md`](mascot-improvement-plan.md) | Plan de mejoras de la mascota: brechas frente a alkimia-app y fases. |
| [`mascot-improvement-plan-detailed.md`](mascot-improvement-plan-detailed.md) | El mismo plan con ejemplos de código por fase. |

### Roadmap — [`roadmap/`](roadmap/README.md)

| Documento | Contenido |
|---|---|
| [`plan-mejoras/`](roadmap/plan-mejoras/README.md) | Plan de mejoras backend por fases. |
| [`plan-chat-mascota/`](roadmap/plan-chat-mascota/README.md) | Planes independientes de chat y mascota. |

---

## 3. Documentos transversales

- [`breaking-changes.md`](breaking-changes.md): cambios incompatibles que afectan a frontend web y app móvil. **Debe revisarse antes de cualquier despliegue.**
- [`architecture/history.md`](architecture/history.md): contexto histórico de cambios de modelo; útil para entender por qué algunas estructuras son como son.

---

## 4. Documentos obsoletos o candidatos a consolidar

Estos documentos siguen siendo válidos, pero conviene revisarlos o fusionarlos en el corto plazo:

| Documento | Situación | Acción sugerida |
|---|---|---|
| `body-composition/cambios-composicion-corporal-frontend.md` | Describe la v1 de los cambios de composición corporal. | Conservar como referencia histórica; la v2 es la guía vigente. |
| `body-composition/cambios-composicion-corporal-v2-frontend.md` | Guía vigente de la v2. | Mantener como fuente de verdad para frontend. |
| `menus/menuTemplateUpload.md` | Describe el endpoint original. | Puede fusionarse con `menu-template-upload-changes.md` y `menu-template-upload-frontend-guide.md`. |
| `menus/menu-template-upload-changes.md` | Cambios backend de la integración con Gemini. | Candidato a consolidar en un único doc de “subida de plantillas”. |
| `menus/menu-template-upload-frontend-guide.md` | Guía frontend de la misma funcionalidad. | Candidato a consolidar en un único doc de “subida de plantillas”. |
| `architecture/history.md` | Documento histórico con información parcialmente reemplazada por `body-composition/`. | Mantener como histórico o mover su contenido útil a los docs de dominio. |

---

## 5. Convenciones

- Los enlaces internos son **relativos** al archivo que los contiene.
- Cada carpeta tiene su propio `README.md` con el índice de su dominio.
- `breaking-changes.md` vive en la raíz porque afecta a todos los clientes.
- Los planes de futuro viven en `roadmap/` y no deben mezclarse con la documentación del sistema actual.
