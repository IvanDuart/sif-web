# Teléfono del paciente (`phone`) — nuevo campo

## Resumen

Se añade el campo **`phone`** (número de teléfono) a los datos del usuario/paciente. Es un campo **opcional** y **retrocompatible**: los endpoints existentes funcionan sin cambios y el campo se ignora si no se envía.

**El número de teléfono es un dato global del usuario**, no específico de un tenant (igual que email, nombre, fecha de nacimiento o altura). Se guarda en la tabla `app_user`.

---

## 1. Dónde se devuelve

### Lista de usuarios del tenant

`GET /tenant/{tenantId}/users` y `GET /tenant/{tenantId}/users/by-type/{userType}`

`TenantUserDto` ahora incluye `phone`:

```json
{
  "id": "uuid",
  "email": "paciente@example.com",
  "firstName": "María",
  "lastName": "García",
  "phone": "+34 600 123 456",
  "enabled": true,
  "birthDate": "1990-03-15",
  "age": 36,
  "heightCm": 165.0,
  "userType": "PATIENT",
  "roleCode": "USER",
  "roleName": "Paciente",
  "permissions": [],
  "lastMeasurement": null
}
```

### Detalle de usuario

`GET /tenant/{tenantId}/users/{userId}` — el `AppUser` devuelto incluye `phone`:

```json
{
  "id": "uuid",
  "email": "paciente@example.com",
  "firstName": "María",
  "lastName": "García",
  "birthDate": "1990-03-15",
  "heightCm": 165.0,
  "gender": "FEMALE",
  "age": 36,
  "phone": "+34 600 123 456",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

### Usuario logado

`GET /users/me` y `GET /tenant/{tenantId}/users/me` también incluyen `phone` en el `AppUser`.

---

## 2. Cómo se envía

### Actualizar usuario (STAFF/ADMIN)

`PUT /tenant/{tenantId}/users/{userId}` — nuevo campo opcional (semántica PATCH-like: si viene `null` o ausente, **no** se modifica):

```json
{
  "phone": "+34 600 123 456"
}
```

| Campo | Tipo | Validación |
|---|---|---|
| `phone` | `string` | máx. 30 caracteres, opcional |

### Invitar / crear usuario

`POST /tenant/{tenantId}/users/invite` — nuevo campo opcional para registrar el teléfono en la creación:

```json
{
  "email": "paciente@example.com",
  "firstName": "María",
  "lastName": "García",
  "roleCode": "USER",
  "phone": "+34 600 123 456"
}
```

- Si el email ya existe en el sistema, `phone` **actualiza** el perfil global del usuario existente.
- Si el usuario es nuevo, se crea con el teléfono indicado.

---

## 3. Formato recomendado

El backend **no valida** el formato (acepta cualquier string de hasta 30 caracteres). Se recomienda que el frontend envíe y muestre el número en un formato legible, por ejemplo con prefijo internacional: `+34 600 123 456`.

---

## 4. Notas técnicas

- La columna `phone` en `app_user` es `VARCHAR(30)`, `NULL` por defecto — los usuarios existentes quedan con `NULL` hasta que se actualicen.
- `phone` aparece en las vistas JSON `Public`, `List`, `Full` y `Me`.
- **Retrocompatible**: los clientes que no envíen `phone` no ven cambios en el comportamiento.

---

## 5. Archivos modificados

| Ruta | Cambio |
|---|---|
| `src/main/resources/db/migration/V28__add_user_phone.sql` | Nueva migración — columna `phone` en `app_user` |
| `src/main/java/.../models/entity/AppUser.java` | Nuevo campo `phone` |
| `src/main/java/.../models/dto/TenantUserDto.java` | Nuevo campo `phone` en respuesta de listas |
| `src/main/java/.../controller/dto/UpdateUserRequest.java` | Nuevo campo `phone` |
| `src/main/java/.../controller/dto/InviteUserRequest.java` | Nuevo campo `phone` |
| `src/main/java/.../controller/dto/CreateAppUserRequest.java` | Nuevo campo `phone` |
| `src/main/java/.../service/AppUserService.java` | Mapeo de `phone` en `save()` y `updateUser()` |
| `src/main/java/.../service/UserTenantRoleService.java` | Mapeo de `phone` en `inviteUser()` y `mapToTenantUserDto()` |
