# Breaking Changes

## 1. Paginación — nuevo formato de respuesta

### ¿Qué cambió?

Se activó `VIA_DTO` en `@EnableSpringDataWebSupport`. Los endpoints que devuelven páginas ahora usan el formato `PagedModel` en lugar de `PageImpl`.

### Formato antiguo (PageImpl)

```json
{
  "content": [...],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 10,
    "sort": { "empty": false, "sorted": true, "unsorted": false },
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "last": false,
  "totalPages": 5,
  "totalElements": 42,
  "size": 10,
  "number": 0,
  "sort": { "empty": false, "sorted": true, "unsorted": false },
  "first": true,
  "numberOfElements": 10,
  "empty": false
}
```

### Formato nuevo (PagedModel / VIA_DTO)

```json
{
  "content": [...],
  "page": {
    "size": 10,
    "number": 0,
    "totalElements": 42,
    "totalPages": 5
  }
}
```

### Endpoints afectados

| Controlador | URL |
|---|---|
| `MenuController` | `GET /api/tenant/{tenantId}/menu?page=...` |
| `MenuTemplateController` | `GET /api/tenant/{tenantId}/menu-template?page=...` |
| `MealController` | `GET /api/tenant/{tenantId}/meal?page=...` |
| `TenantController` | `GET /api/tenants?page=...` |
| `BodyMeasurementController` | `GET /api/tenant/{tenantId}/users/{userId}/measurements?page=...` |

### Adaptación frontend

Reemplazar el parseo actual de `PageImpl` por uno que lea `content` + `page { size, number, totalElements, totalPages }`. Se recomienda un wrapper/helper centralizado.

---

## 2. Filtrado de usuarios por tipo — cambio de URL

### ¿Qué cambió?

Se eliminó la ambigüedad entre `GET /users/{userType}` y `GET /users/{userId}` moviendo el filtro por tipo a una ruta con prefijo.

### URL antigua (rota)

```
GET /api/tenant/{tenantId}/users/STAFF
GET /api/tenant/{tenantId}/users/PATIENT
```

### URL nueva

```
GET /api/tenant/{tenantId}/users/by-type/STAFF
GET /api/tenant/{tenantId}/users/by-type/PATIENT
```

### URL sin cambios

```
GET /api/tenant/{tenantId}/users                    → listar todos
GET /api/tenant/{tenantId}/users/{userId}            → usuario concreto
GET /api/tenant/{tenantId}/users/{userId}/role       → cambiar rol
DELETE /api/tenant/{tenantId}/users/{userId}         → revocar acceso
GET /api/tenant/{tenantId}/users/invite              → invitar
```

### ¿Por qué?

Spring MVC registraba ambas rutas como `/{variable}` y no podía discriminarlas, lanzando `Ambiguous handler methods mapped` (error 500) al intentar acceder a cualquiera de las dos.

---

## 3. Sin cambios

- `/users/me` y `/tenant/{tenantId}/users/me` mantienen su forma JSON (`memberships[]` con `tenantId`, `tenantName`, `userType`, `roleCode`, `permissions[]`).
- Todos los demás endpoints no listados arriba no fueron modificados.
