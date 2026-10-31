# Pacientes y perfil clínico

Documentación sobre el paciente dentro de un tenant: perfil médico, anamnesis, estado clínico, datos básicos, eventos y listados.

## Documentos

| Documento | Contenido |
|---|---|
| [`patient_profile.md`](patient_profile.md) | Perfil médico sensible (`user_tenant_profile`) y permisos asociados. |
| [`anamnesis_checklist_fields.md`](anamnesis_checklist_fields.md) | Checklist estructurado de 18 condiciones médicas con notas. |
| [`water_intake_and_anamnesis_config.md`](water_intake_and_anamnesis_config.md) | Seguimiento de consumo de agua y configuración de campos de anamnesis por tenant. |
| [`observaciones_perfil.md`](observaciones_perfil.md) | Campo de observaciones libres del profesional y su uso en el PDF del menú. |
| [`patient_phone.md`](patient_phone.md) | Campo `phone` global del usuario y su exposición en DTOs. |
| [`patient_events.md`](patient_events.md) | Eventos informativos del paciente en el calendario (bodas, viajes, operaciones…). |
| [`breakfast_snack.md`](breakfast_snack.md) | Desayuno y merienda fijos del paciente. |
| [`lunch_meal.md`](lunch_meal.md) | Almuerzo fijo del paciente. |
| [`clinical-status.md`](clinical-status.md) | Estado clínico (`ONBOARDING`, `ACTIVE`, `PAUSED`, `DISCHARGED`, `DROPPED_OUT`) y su historial. |
| [`listado_pacientes_frontend.md`](listado_pacientes_frontend.md) | Listado de pacientes: filtros, ordenación, operaciones masivas y exportación CSV. |

## Relaciones con otros dominios

- **Composición corporal:** las mediciones y el informe clínico están en [`../body-composition/`](../body-composition/README.md). El campo `gender` se documenta en [`../body-composition/measurements_and_gender.md`](../body-composition/measurements_and_gender.md).
- **Citas:** la relación con el nutricionista titular y el listado de la cartera están en [`../appointments/relacion_paciente_nutricionista.md`](../appointments/relacion_paciente_nutricionista.md).
- **Menús:** el desayuno, almuerzo, merienda y observaciones del perfil se renderizan en el PDF del menú. Ver [`../menus/menu-pdf-and-tenant-contact.md`](../menus/menu-pdf-and-tenant-contact.md).
- **Seguridad:** habilitar/deshabilitar usuarios y actualizar datos básicos está en [`../security/disable_user.md`](../security/disable_user.md) y [`../security/updateUser.md`](../security/updateUser.md).

## Notas

- El perfil clínico (`patient_profile.md`) es **por tenant**: un mismo usuario puede tener perfiles distintos en centros distintos.
- El estado clínico no revoca el acceso: solo limita la escritura. El acceso real lo controla `enabled`/`disabledAt`.
- Los campos de desayuno, almuerzo, merienda y observaciones son valores fijos del perfil, no forman parte del histórico de menús.
