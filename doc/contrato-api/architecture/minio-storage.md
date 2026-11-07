# Almacenamiento de objetos con MinIO

MinIO es el almacén oficial de binarios privados del backend. Sustituye progresivamente los `bytea` de PostgreSQL para logos, PDFs, imágenes de recetas, adjuntos de chat y laboratorios.

## Configuración

Variables de entorno:

| Variable | Default | Descripción |
|---|---|---|
| `MINIO_ENDPOINT` | `http://localhost:9000` | Endpoint S3/MinIO |
| `MINIO_ACCESS_KEY` | `minioadmin` | Access key |
| `MINIO_SECRET_KEY` | `minioadmin` | Secret key |
| `MINIO_BUCKET` | `tus-dietas` | Bucket privado |
| `MINIO_PRESIGNED_TTL_SECONDS` | `900` | TTL de URLs firmadas |
| `MINIO_MIGRATE_LEGACY_LOGOS` | `true` | Migra logos `bytea` al arrancar |

El bucket se crea automáticamente si no existe, pero **nunca se hace público**.

## Servicio común

`StorageService` expone:

- `upload(tenantId, entityType, entityId, filename, bytes, contentType)` → guarda el objeto y un registro en `stored_file`.
- `presignedUrl(path)` → URL firmada temporal.
- `download(path)` → bytes para usos internos (PDFs).
- `delete(path)` / `delete(StoredFile)` → borrado del objeto y metadatos.

Rutas:

```text
{tenantId}/{entityType}/{entityId}/{uuid}-{filenameSeguro}
```

## Tabla `stored_file`

| Campo | Descripción |
|---|---|
| `id` | UUID |
| `tenant_id` | Centro propietario |
| `bucket` | Bucket de MinIO |
| `path` | Ruta interna del objeto |
| `content_type` | MIME type |
| `size_bytes` | Tamaño |
| `original_filename` | Nombre original saneado |
| `entity_type` | `TENANT_LOGO`, `TENANT_LOGO_PDF`, `CHAT_ATTACHMENT`, `ASSISTANT_MASCOT`, … |
| `entity_id` | ID de la entidad propietaria |
| `created_at` | Fecha de subida |

## Logos de tenant

`tenant` gana dos columnas:

- `tenant_logo_path`
- `tenant_logo_pdf_path`

Reglas:

1. Si existe `*_path`, el logo se sirve desde MinIO mediante `302` a una URL firmada.
2. Si no existe, se mantiene el fallback a `tenant_logo` / `tenant_logo_pdf` (`bytea`) para datos legacy.
3. Las nuevas subidas van a MinIO y dejan los `bytea` a `null`.
4. Los PDFs de menú y composición corporal descargan el logo desde MinIO si hay ruta; si no, usan el `bytea`.

## Migración legacy

`TenantLogoMigration` recorre los tenants al arrancar:

- Sube los logos `bytea` que aún no tengan ruta.
- Guarda la ruta y limpia el `bytea`.
- Si MinIO no está disponible, deja el `bytea` y reintenta en el siguiente arranque.

## Mascota del asistente

Los avatares SVG y las animaciones Lottie se guardan en el bucket común con:

```text
{tenantId}/assistant_mascot/{assistantMascotId}/{uuid}-{filenameSeguro}
```

- El SVG se sanea antes de subirse (sin scripts, eventos ni referencias externas).
- Las animaciones se validan como JSON Lottie.
- `assistant_mascot.avatar_stored_file_id` apunta al `stored_file` del avatar.
- `assistant_mascot.animations` guarda `{ "<nombre>": { "storedFileId": "<uuid>" } }`.
- Las mascotas predefinidas de `classpath:pets/*.svg` se copian a este prefijo
  cuando el nutricionista elige una; el SVG original no se modifica.
- Las URLs firmadas se generan al leer la configuración; nunca se exponen rutas internas.

## Endpoints afectados

- `GET /tenant/{tenantId}/branding/logo` → `302` a URL firmada o bytes legacy.
- `GET /tenant/{tenantId}/branding/logo-pdf` → `302` a URL firmada o bytes legacy.
- `PUT /tenant/{tenantId}/branding/logo` → sube a MinIO.
- `PUT /tenant/{tenantId}/branding/logo-pdf` → sube a MinIO.
- `PUT /tenant/{tenantId}/assistant/avatar` → sube el avatar SVG saneado.
- `PUT /tenant/{tenantId}/assistant/animations/{name}` → sube una animación Lottie.
- `DELETE /tenant/{tenantId}/assistant/animations/{name}` → borra una animación.
