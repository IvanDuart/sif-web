# Menús, comidas y plantillas

Documentación del módulo de menús: plantillas, subida de archivos, edición de menús y platos, PDFs, actualización en tiempo real y menús estructurados con BEDCA.

## Documentos

| Documento | Contenido |
|---|---|
| [`menuTemplateUpload.md`](menuTemplateUpload.md) | Endpoint `POST /menu-template/upload` para crear plantillas desde PDF o imagen. |
| [`menu-template-upload-frontend-guide.md`](menu-template-upload-frontend-guide.md) | Guía frontend de la subida de plantillas con IA (Gemini). |
| [`menu-template-upload-changes.md`](menu-template-upload-changes.md) | Cambios backend de la integración con Gemini y validación de IA habilitada. |
| [`menu-update-endpoint.md`](menu-update-endpoint.md) | `PATCH /menu/{menuId}`: nombre y activación del menú. |
| [`meal-update-endpoint.md`](meal-update-endpoint.md) | `PUT /meal/{mealId}`: edición de la descripción del plato. |
| [`menuTemplateMeals.md`](menuTemplateMeals.md) | CRUD de platos individuales dentro de una plantilla. |
| [`menu-pdf-and-tenant-contact.md`](menu-pdf-and-tenant-contact.md) | PDF del menú, logo, datos de contacto y comidas fijas. |
| [`sse-real-time-menu-frontend.md`](sse-real-time-menu-frontend.md) | SSE para refrescar el menú cuando se edita. |
| [`menus-estructurados-bedca-frontend.md`](menus-estructurados-bedca-frontend.md) | Menús estructurados con catálogo BEDCA, buscador de alimentos, macros y `copy-day`. |

## Orden de lectura sugerido

1. **Para entender el módulo de menús:** `menus-estructurados-bedca-frontend.md` es la guía más completa del estado actual.
2. **Para plantillas:** `menuTemplateUpload.md` → `menuTemplateMeals.md`.
3. **Para edición puntual:** `menu-update-endpoint.md` y `meal-update-endpoint.md`.
4. **Para PDFs:** `menu-pdf-and-tenant-contact.md`.
5. **Para tiempo real:** `sse-real-time-menu-frontend.md`.

## Relaciones con otros dominios

- **IA:** la subida de plantillas con Gemini y la lista de la compra están en [`../ai/`](../ai/README.md).
- **Notificaciones/SSE:** el canal de menú comparte infraestructura con el de notificaciones. Ver [`../notifications/sse-notificaciones-frontend.md`](../notifications/sse-notificaciones-frontend.md).
- **Pacientes:** desayuno, almuerzo, merienda y observaciones del perfil se incluyen en el PDF del menú. Ver [`../patients/breakfast_snack.md`](../patients/breakfast_snack.md), [`../patients/lunch_meal.md`](../patients/lunch_meal.md) y [`../patients/observaciones_perfil.md`](../patients/observaciones_perfil.md).
- **Arquitectura:** los logos y binarios se almacenan en MinIO. Ver [`../architecture/minio-storage.md`](../architecture/minio-storage.md).

## Notas

- `menuTemplateUpload.md`, `menu-template-upload-changes.md` y `menu-template-upload-frontend-guide.md` cubren la misma funcionalidad desde ángulos distintos. Son **candidatos a consolidarse** en un único documento de “subida de plantillas”.
- El PDF de menú usa el logo de MinIO si existe y cae al `bytea` legacy si no.
