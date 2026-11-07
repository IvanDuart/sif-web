# Gestión del Estado del Paciente — Habilitar/Deshabilitar Usuarios

## Resumen

Se ha implementado un nuevo endpoint `PATCH /tenant/{tenantId}/users/{userId}/status` que permite a los roles autorizados habilitar y deshabilitar usuarios en un tenant. Esto deshabilita tanto el acceso en la base de datos como en Keycloak, impidiendo que el usuario pueda iniciar sesión o realizar llamadas.

Adicionalmente, se han ampliado los permisos del rol **NUTRITIONIST** para que pueda gestionar completamente el ciclo de vida de los pacientes (invitar, editar y deshabilitar), pero **sin permiso para eliminarlos** (acción reservada para el `ADMIN`).

---

## Nuevo Endpoint

| Método | Ruta | Permiso requerido |
|---|---|---|
| `PATCH` | `/tenant/{tenantId}/users/{userId}/status` | `DISABLE_USER` |

### Query Parameters

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `enabled` | `boolean` | Sí | `true` para habilitar, `false` para deshabilitar. |

### Response

`200 OK` — Devuelve el `AppUser` modificado con vista `@JsonView(JsonViews.Full.class)`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "paciente@example.com",
  "firstName": "Ana",
  "lastName": "Gómez",
  "birthDate": "1995-08-25",
  "heightCm": 165.0,
  "createdAt": "2026-02-10T12:00:00Z",
  "disabledAt": "2026-08-12T21:30:00Z",
  "enabled": false,
  "menus": []
}
```

---

## Códigos de Respuesta

| Código | Descripción |
|---|---|
| `200 OK` | Estado actualizado correctamente en BD y Keycloak. |
| `400 Bad Request` | Falta el parámetro obligatorio `enabled`. |
| `403 Forbidden` | El usuario autenticado no tiene permiso `DISABLE_USER` en el tenant. |
| `404 Not Found` | Usuario no encontrado o no pertenece al tenant. |
| `409 Conflict` | Conflicto de negocio (e.g. se intenta deshabilitar al único administrador del tenant). |

### Ejemplo de Error 409 (Único administrador)
```json
{
  "error": "Cannot disable only admin"
}
```

---

## Cambios en Roles y Permisos (Frontend Impact)

Para el equipo de Frontend, es fundamental tener en cuenta los siguientes cambios de autorización en la visualización de la lista de pacientes y sus acciones:

| Operación | Endpoint | Permiso requerido | ADMIN | NUTRITIONIST |
|---|---|---|:---:|:---:|
| **Invitar/Crear** | `POST /users/invite` | `INVITE_USER` | ✅ | ✅ *(Nuevo)* |
| **Editar Datos** | `PUT /users/{userId}` | `MANAGE_USER` | ✅ | ✅ *(Nuevo)* |
| **Habilitar/Deshabilitar** | `PATCH /users/{userId}/status` | `DISABLE_USER` | ✅ *(Nuevo)* | ✅ *(Nuevo)* |
| **Revocar/Eliminar** | `DELETE /users/{userId}` | `MANAGE_USER` | ✅ | ❌ *(Sin acceso)* |

> **Nota:** El nutricionista **no puede revocar el acceso (borrar)** a los pacientes. Por tanto, el botón de "Eliminar/Revocar" no debe mostrarse a los usuarios con rol de Nutricionista en el panel. En su lugar, deben usar el botón de "Deshabilitar/Habilitar".

---

## Ejemplos de Integración (cURL)

### Deshabilitar un paciente
```bash
curl -X PATCH "http://localhost:8081/api/tenant/00000000-0000-0000-0000-000000000001/users/550e8400-e29b-41d4-a716-446655440000/status?enabled=false" \
  -H "Authorization: Bearer $TOKEN"
```

### Habilitar un paciente
```bash
curl -X PATCH "http://localhost:8081/api/tenant/00000000-0000-0000-0000-000000000001/users/550e8400-e29b-41d4-a716-446655440000/status?enabled=true" \
  -H "Authorization: Bearer $TOKEN"
```
