# Arquitectura y plataforma

Documentación transversal sobre cómo está montada la plataforma: creación de tenants, almacenamiento de objetos, versionado de la app y evolución del modelo de datos.

## Documentos

| Documento | Contenido |
|---|---|
| [`tenant-creation-workflow.md`](tenant-creation-workflow.md) | Quién puede crear un tenant y qué datos semilla se generan automáticamente (preferencias, admin, tipos de cita, horarios). |
| [`minio-storage.md`](minio-storage.md) | Almacenamiento de binarios privados en MinIO: configuración, `StorageService`, tabla `stored_file`, logos de tenant y migración legacy. |
| [`app_version_control.md`](app_version_control.md) | Control de versión de la app Flutter y actualización obligatoria desde base de datos. |
| [`history.md`](history.md) | Histórico de cambios del modelo de datos: perfil clínico, mediciones corporales y asignación de menús. |

## Relaciones con otros dominios

- **Citas:** la creación de tenants genera tipos de cita y horarios por defecto. Ver [`../appointments/appointment_types.md`](../appointments/appointment_types.md) y [`../appointments/horarios_centros.md`](../appointments/horarios_centros.md).
- **Menús y PDFs:** MinIO almacena logos y binarios usados por los PDFs de menú y composición corporal. Ver [`../menus/menu-pdf-and-tenant-contact.md`](../menus/menu-pdf-and-tenant-contact.md).
- **Pacientes:** la creación de tenants habilita los campos base de anamnesis. Ver [`../patients/water_intake_and_anamnesis_config.md`](../patients/water_intake_and_anamnesis_config.md).
- **Composición corporal:** `history.md` es el contexto histórico de los cambios que luego se detallan en [`../body-composition/`](../body-composition/README.md).

## Notas

- `history.md` es un documento **histórico**: parte de su contenido ha sido reemplazado por la documentación de composición corporal. Se mantiene como contexto de evolución del modelo.
