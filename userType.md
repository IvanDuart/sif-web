# userType — Diferenciación de usuarios: STAFF vs PATIENT

## 1. Resumen

Se introduce un campo `userType` en `Role` que clasifica cada rol como `STAFF` (equipo) o `PATIENT` (paciente). El frontend recibe este campo en `TenantUserDto` y `TenantMembershipDto`, permitiendo distinguir entre nutricionistas/administradores y pacientes de forma declarativa, sin depender de códigos de rol concretos.

| Rol | userType |
|---|---|
| `ADMIN` | `STAFF` |
| `NUTRITIONIST` | `STAFF` |
| `USER` | `PATIENT` |

---

## 2. Migración SQL (V5)

```sql
ALTER TABLE role ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'PATIENT'
    CHECK (type IN ('STAFF', 'PATIENT'));
UPDATE role SET type = 'STAFF' WHERE code IN ('ADMIN', 'NUTRITIONIST');
UPDATE role SET type = 'PATIENT' WHERE code = 'USER';
```

---

## 3. Nuevo endpoint

### GET /tenant/{tenantId}/users/{userType}

Filtra los usuarios del tenant por tipo (`STAFF` o `PATIENT`).

**Permiso:** `VIEW_USER`

**Ejemplo:**

```bash
curl "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/users/STAFF" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `List<TenantUserDto>` (igual estructura que el endpoint `/users` existente, pero filtrado).

**Notas:**
- `userType` se escribe en mayúsculas: `STAFF` o `PATIENT`.
- El endpoint existente `GET /tenant/{tenantId}/users` sigue funcionando igual y devuelve todos los usuarios sin filtrar.

---

## 4. Cambios en DTOs

### TenantUserDto (response de `/users` y `/users/{userType}`)

Nuevo campo:

| Campo | Tipo | Ejemplo | Descripción |
|---|---|---|---|
| `userType` | `string` | `"STAFF"` o `"PATIENT"` | Clasificación del rol del usuario en este tenant |

### TenantMembershipDto (response de `/me`)

Nuevo campo:

| Campo | Tipo | Ejemplo | Descripción |
|---|---|---|---|
| `userType` | `string` | `"STAFF"` o `"PATIENT"` | Clasificación del rol en cada tenant del usuario |

---

## 5. Notas para el frontend

### Cómo usar `userType`

```typescript
// TypeScript (Angular/React)
interface TenantUser {
  id: string;
  email: string;
  // ...
  userType: 'STAFF' | 'PATIENT';
  // ...
}

// Para separar listas
if (user.userType === 'STAFF') {
  // mostrar en pestaña "Equipo"
} else {
  // mostrar en pestaña "Pacientes"
}
```

### Ventaja sobre comprobar `roleCode`

| Enfoque | Problema |
|---|---|
| `if (roleCode === 'ADMIN' \|\| roleCode === 'NUTRITIONIST')` | Si mañana se añade un rol `RECEPTIONIST`, hay que actualizar todos los frontends |
| `if (userType === 'STAFF')` | Basta con asignar `type = STAFF` al nuevo rol en BD. El frontend no cambia |

### Compatibilidad hacia atrás

- El endpoint `GET /tenant/{tenantId}/users` **no cambia** — sigue devolviendo todos los usuarios.
- Los roles existentes (`ADMIN`, `NUTRITIONIST`, `USER`) mantienen su código y nombre.
- Si el frontend no usa `userType`, los endpoints antiguos siguen funcionando exactamente igual.

### ¿Qué pasa si un rol no tiene `userType`?

No debería ocurrir por el `NOT NULL DEFAULT 'PATIENT'` en BD. Pero si ocurriera (p. ej. rol creado directamente sin migración), el valor por defecto es `PATIENT`.

### Formato de la respuesta de ejemplo

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "nutri@clinica.com",
    "firstName": "María",
    "lastName": "García",
    "enabled": true,
    "birthDate": "1985-03-22",
    "age": 41,
    "heightCm": 168.0,
    "userType": "STAFF",
    "roleCode": "NUTRITIONIST",
    "roleName": "Nutricionista",
    "permissions": ["VIEW_USER", "VIEW_MENU", "MANAGE_MENU", "MANAGE_TEMPLATE"],
    "lastMeasurement": null
  }
]
```

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "email": "paciente@email.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "enabled": true,
    "birthDate": "2000-05-12",
    "age": 26,
    "heightCm": 175.5,
    "userType": "PATIENT",
    "roleCode": "USER",
    "roleName": "Usuario",
    "permissions": ["VIEW_MENU"],
    "lastMeasurement": {
      "id": "...",
      "measuredAt": "2026-06-09T10:00:00Z",
      "weightKg": 78.5,
      "bmi": 25.6
    }
  }
]
```

### Rutas

| Ruta | Propósito |
|---|---|
| `GET /tenant/{tenantId}/users` | Todos los usuarios (sin filtro) |
| `GET /tenant/{tenantId}/users/STAFF` | Solo STAFF (ADMIN + NUTRITIONIST) |
| `GET /tenant/{tenantId}/users/PATIENT` | Solo PATIENT (USER) |
| `GET /me` | Usuario logado con sus memberships, cada una con `userType` |

---

## 6. Ficheros modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V5__role_type.sql` | Nuevo — añade columna `type` a `role` |
| `models/entity/RoleType.java` | Nuevo — enum `{ STAFF, PATIENT }` |
| `models/entity/Role.java` | + campo `type` con `@Enumerated` |
| `models/dto/TenantUserDto.java` | + campo `userType: RoleType` |
| `models/dto/TenantMembershipDto.java` | + campo `userType: RoleType` |
| `repository/UserTenantRoleRepository.java` | + `findByTenantIdAndRoleType()` |
| `service/UserTenantRoleService.java` | + `getUsersByTenantAndType()`, mapea `userType` en DTOs |
| `service/AppUserService.java` | Mapea `userType` en `TenantMembershipDto` |
| `controller/UserTenantRoleController.java` | + `GET /users/{userType}` con regex para evitar conflicto con `/{userId}` |
