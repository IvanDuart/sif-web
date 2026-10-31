# IA y automatización

Documentación de las funcionalidades que usan inteligencia artificial, principalmente Google Gemini.

## Documentos

| Documento | Contenido |
|---|---|
| [`ai-shopping-list.md`](ai-shopping-list.md) | Generación de la lista de la compra a partir de un menú con Gemini. Endpoints, permisos y arquitectura. |
| [`categorias-lista-compra-supermercados.md`](categorias-lista-compra-supermercados.md) | Taxonomía de secciones por supermercado y reglas de ordenación para la app móvil. |

## Relaciones con otros dominios

- **Menús:** la subida de plantillas con Gemini se documenta en [`../menus/menu-template-upload-changes.md`](../menus/menu-template-upload-changes.md) y [`../menus/menu-template-upload-frontend-guide.md`](../menus/menu-template-upload-frontend-guide.md).
- **Arquitectura:** la clave de Gemini se guarda cifrada en las preferencias del tenant. Ver [`../architecture/`](../architecture/README.md) y [`breaking-changes.md`](../breaking-changes.md) (sección de clave Gemini write-only).
- **Seguridad:** la IA debe estar habilitada por tenant (`aiEnabled`) y la clave nunca se expone al cliente.

## Notas

- Toda llamada a Gemini se hace desde backend; el cliente nunca ve la API key.
- La lista de la compra **sobrescribe** la existente para el mismo menú y usuario.
- Los precios estimados son simulados, no proceden de una API real de precios.
