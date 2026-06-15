# Endpoint PUT — Actualizar perfil de usuario

## Resumen

Nuevo endpoint `PUT /tenant/{tenantId}/users/{userId}` que permite modificar los datos básicos del perfil de un usuario dentro de un tenant.

**Permiso requerido:** `MANAGE_USER`

**Propósito:** Que STAFF/ADMIN pueda actualizar nombre, apellidos, email, fecha de nacimiento y altura de los pacientes u otros usuarios del tenant.

---

## Endpoint

| Método | Ruta | Permiso |
|---|---|---|
| `PUT` | `/tenant/{tenantId}/users/{userId}` | `MANAGE_USER` |

### Request body

```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@example.com",
  "birthDate": "2000-05-12",
  "heightCm": 175.5
}
```

**Todos los campos son opcionales.** Si un campo viene `null` o ausente, no se modifica (semántica PATCH-like).

| Campo | Tipo | Validación |
|---|---|---|
| `firstName` | `string` (max 100) | — |
| `lastName` | `string` (max 100) | — |
| `email` | `string` | `@Email`, debe ser único en el sistema |
| `birthDate` | `string` (YYYY-MM-DD) | `@PastOrPresent` — no puede ser futura |
| `heightCm` | `number` (BigDecimal 5,1) | mínimo 30.0, máximo 275.0 |

### Response

`200 OK` — Devuelve el `AppUser` actualizado con vista `@JsonView(JsonViews.Full.class)`:

```json
{
  "id": "uuid",
  "email": "juan@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "birthDate": "2000-05-12",
  "heightCm": 175.5,
  "createdAt": "2026-01-15T10:00:00Z",
  "disabledAt": null,
  "menus": []
}
```

---

## Códigos de respuesta

| Código | Descripción |
|---|---|
| `200 OK` | Usuario actualizado correctamente |
| `400 Bad Request` | Error de validación (email inválido, altura fuera de rango, fecha futura, email duplicado) |
| `403 Forbidden` | El usuario autenticado no tiene permiso `MANAGE_USER` en el tenant |
| `404 Not Found` | Usuario no encontrado o no pertenece al tenant |

---

## Ejemplos

### Actualizar solo fecha de nacimiento y altura

```bash
curl -X PUT "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/users/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "birthDate": "1990-03-15",
    "heightCm": 180.0
  }'
```

### Actualizar email (debe ser único en el sistema)

```bash
curl -X PUT "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/users/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nuevo-email@example.com"
  }'
```

### Error: email ya en uso

```json
{
  "error": "Email already in use by another user"
}
```

### Error: fecha de nacimiento futura

```json
{
  "error": "updateUserRequest.birthDate: must be a date in the past or in the present"
}
```

---

## Cambios en el código

### Archivos creados

- `src/main/java/com/carajillolabs/tusdietas/controller/dto/UpdateUserRequest.java`

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `AppUserService.java` | Nuevo método `updateUser(UUID userId, UpdateUserRequest request)` |
| `UserTenantRoleController.java` | Nuevo endpoint `PUT /{userId}`, nuevo constructor con `AppUserService` |
| `ErrorResource.java` | Nuevo enum `EMAIL_ALREADY_IN_USE` |
| `README.md` | Documentado el nuevo endpoint |

---

## Notas técnicas

- La semántica es **PATCH-like**: cada campo se actualiza solo si es distinto de `null`.
- Si se intenta cambiar el email a uno ya en uso por **otro** usuario, se rechaza con `400 Bad Request`.
- Si el email no cambia (mismo valor, mismo usuario), no se realiza ninguna comprobación adicional.
- El endpoint verifica primero que el usuario pertenezca al tenant (`getUserInTenant`) antes de actualizar, evitando que un admin modifique usuarios de otros tenants que conozca por UUID.
