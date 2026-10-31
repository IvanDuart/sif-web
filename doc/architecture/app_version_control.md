# Control de Versión de la Aplicación Móvil (Flutter)

Este módulo permite controlar el versionado de la aplicación móvil (Flutter) y
decidir si una actualización es **obligatoria** o no para los usuarios finales.

A diferencia de una configuración estática en `application.yaml`, el control se
realiza desde una **tabla de base de datos**, de modo que un **administrador de
un tenant admin** (con rol `ADMIN`) pueda actualizar la versión directamente
desde el panel de administración sin tener que redesplegar la API.

## 1. Diseño de almacenamiento

Se creó la tabla `app_version`. Es **global** (no depende de un tenant).

| Columna            | Tipo                        | Descripción                                                                 | Valor por defecto     |
|--------------------|-----------------------------|-----------------------------------------------------------------------------|-----------------------|
| `id`               | `UUID`                      | Identificador único (autogenerado)                                          | `gen_random_uuid()`   |
| `latest_version`   | `VARCHAR(50)` NOT NULL      | Última versión publicada de la app (formato semver + build number)          | `'1.0.0+1'`           |
| `mandatory_update` | `BOOLEAN` NOT NULL          | Si `true`, la app debe actualizarse obligatoriamente para continuar         | `FALSE`               |
| `updated_by`       | `UUID` FK `app_user.id`     | Auditoría: último administrador que realizó el cambio                        | `NULL`                |
| `updated_at`       | `TIMESTAMP WITH TIME ZONE`  | Fecha de la última actualización                                             | `CURRENT_TIMESTAMP`   |

Se inserta un registro inicial por defecto con `latest_version = '1.0.0+1'` y
`mandatory_update = FALSE`.

## 2. Cambios de base de datos (Flyway)

Se ha creado la migración **`src/main/resources/db/migration/V24__create_app_version_table.sql`**
que realiza:

1. `CREATE TABLE IF NOT EXISTS app_version` con las columnas descritas.
2. `INSERT` del registro por defecto (`'1.0.0+1'`, `FALSE`).
3. Creación del permiso `MANAGE_APP_VERSION` en la tabla `permission`.
4. Asignación del permiso `MANAGE_APP_VERSION` al rol `ADMIN`.

## 3. Capas de código creadas / modificadas

Archivos **creados**:

- `src/main/java/com/carajillolabs/tusdietas/models/entity/AppVersion.java`
  — Entidad JPA que mapea la tabla `app_version`. Usa Lombok (`@Builder`,
  `@Getter/@Setter`) y audita `updated_at` automáticamente con
  `@PrePersist` / `@PreUpdate`. Valores por defecto `1.0.0+1` y
  `mandatoryUpdate = false`.
- `src/main/java/com/carajillolabs/tusdietas/repository/AppVersionRepository.java`
  — Repositorio Spring Data con búsqueda `findTopByOrderByUpdatedAtDesc()` para
  obtener el registro vigente.
- `src/main/java/com/carajillolabs/tusdietas/models/dto/AppVersionDto.java`
  — DTO de respuesta (`id`, `latestVersion`, `mandatoryUpdate`, `updatedAt`).
- `src/main/java/com/carajillolabs/tusdietas/controller/dto/UpdateAppVersionRequest.java`
  — DTO de petición con validación `@NotBlank` sobre `latestVersion`.
- `src/main/java/com/carajillolabs/tusdietas/service/AppVersionService.java`
  — Orquesta la lectura, creación y actualización del registro.
- `src/main/java/com/carajillolabs/tusdietas/controller/AppVersionController.java`
  — Controlador REST con los endpoints público y protegido.

Archivo **modificado**:

- `src/main/java/com/carajillolabs/tusdietas/config/SecurityConfig.java`
  — Se añadió `/api/v1/app/version` a la `WHITE_LIST` para permitir el acceso
  público al `GET`.

**Nota de seguridad:** no se modificó `HasAccess.java`. Se reutiliza el método
existente **`HasAccess.withSystemPermission(permiso)`**, que verifica que el
usuario autenticado pertenezca a un tenant con `admin_tenant = true` y que su
rol contenga el permiso solicitado.

## 4. Endpoints

### 4.1 `GET /api/v1/app/version` (público)

Consumido por la app de Flutter para conocer la versión actual y saber si debe
forzar la actualización.

- **Autenticación:** ninguna (está en la `WHITE_LIST`).
- **Response 200 (AppVersionDto):**

```json
{
  "id": "3f3a5c6e-90c1-4d2a-8b7f-2a5a7f0e5c01",
  "latestVersion": "1.0.0+1",
  "mandatoryUpdate": false,
  "updatedAt": "2026-08-03T12:00:00Z"
}
```

Ejemplo:

```text
GET https://api.tus-dietas.com/api/v1/app/version
```

### 4.2 `PUT /api/v1/app/version` (protegido)

Actualiza `latestVersion` y `mandatoryUpdate`.

- **Autenticación:** requiere token JWT de un usuario.
- **Permisos requeridos:** `@PreAuthorize("@hasAccess.withSystemPermission('MANAGE_APP_VERSION')")`.
  Esto exige que el usuario:
  1. Exista y esté habilitado.
  2. Tenga una membresía en un tenant con `admin_tenant = true`.
  3. Que en ese tenant, su rol tenga el permiso `MANAGE_APP_VERSION`
     (asignado al rol `ADMIN` en la migración V24).
- **Body (UpdateAppVersionRequest):**

```json
{
  "latestVersion": "1.1.0+2",
  "mandatoryUpdate": true
}
```

- **Response 200 (AppVersionDto):**

```json
{
  "id": "3f3a5c6e-90c1-4d2a-8b7f-2a5a7f0e5c01",
  "latestVersion": "1.1.0+2",
  "mandatoryUpdate": true,
  "updatedAt": "2026-08-03T13:00:00Z"
}
```

- **Errores:**
  - `401 Unauthorized` si no hay token.
  - `403 Forbidden` si el usuario no cumple los requisitos de permiso.
  - `400 Bad Request` si `latestVersion` es nulo o vacío.

## 5. Integración con la app Flutter

La app debe consultar `GET /api/v1/app/version` al iniciarse (o al entrar en
primer plano) y comparar la versión instalada contra `latestVersion`:

- Si `latestVersion` es **mayor** que la versión instalada y `mandatoryUpdate`
  es `true`, se debe bloquear el uso de la app y redirigir a la tienda
  (Play Store / App Store).
- Si la actualización **no** es obligatoria, se muestra una sugerencia
  opcional de actualizar.

Se recomienda comparar versiones con el formato `MAJOR.MINOR.PATCH+buildNumber`
usando un parser de semver.
