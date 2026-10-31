# Notificaciones y tiempo real

Documentación de los canales de aviso al usuario: push con OneSignal y SSE (Server-Sent Events).

## Documentos

| Documento | Contenido |
|---|---|
| [`sse-notificaciones-frontend.md`](sse-notificaciones-frontend.md) | Canal SSE de notificaciones del usuario (`GET /notifications/stream`): evento `connected`, evento `notification`, reconexión y checklist de integración. |

## Relaciones con otros dominios

- **Citas:** los eventos de cita (`APPOINTMENT_REQUESTED`, `APPOINTMENT_CREATED`, etc.) se generan en el módulo de citas. Ver [`../appointments/citas_pacientes_onesignal.md`](../appointments/citas_pacientes_onesignal.md).
- **Menús:** el SSE de menú (`GET /tenant/{tenantId}/menu/{menuId}/stream`) se documenta en [`../menus/sse-real-time-menu-frontend.md`](../menus/sse-real-time-menu-frontend.md). Comparte infraestructura y autenticación con este canal.
- **Seguridad:** la zona horaria e idioma del usuario determinan cómo se formatean los avisos. Ver [`../security/user_locale_sync.md`](../security/user_locale_sync.md).
- **Arquitectura:** los adjuntos y binarios relacionados con notificaciones se almacenan en MinIO. Ver [`../architecture/minio-storage.md`](../architecture/minio-storage.md).

## Notas

- El canal SSE es **efímero**: lo emitido con la web cerrada se pierde. No hay historial ni contador de no leídas.
- El push y el SSE comparten el mismo mapa `data` (`type`, `tenantId`, `entityId`, `startTime`, `noteType`).
- El registro de conexiones SSE es en memoria por nodo; escalar horizontalmente exigiría un bus distribuido.
