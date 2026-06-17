# Editar Plato (Meal)

Nuevo endpoint para editar la descripción de un plato asignado a un menú.

## PUT /api/tenant/{tenantId}/meal/{mealId}

Actualiza la descripción de un plato.

### Permiso Requerido
`MANAGE_MEAL`

### Request Body

```json
{
  "description": "Nueva descripción del plato"
}
```

### Response (200 OK)

```json
{
  "id": "uuid",
  "dayOfWeek": "LUNES",
  "mealType": "DESAYUNO",
  "description": "Nueva descripción del plato"
}
```

### Errores

| Status | Significado |
|--------|------------|
| 404    | El plato no existe o no pertenece al tenant |
| 400    | `description` vacío o no enviado |

### Notas

- Solo se puede modificar el campo `description`. El `dayOfWeek` y `mealType` permanecen inmutables.
- Sigue el mismo patrón que el resto de endpoints: `/api/tenant/{tenantId}/meal/{mealId}`.
- Si el plato no pertenece al tenant indicado, devuelve 404 (no 403) para no exponer información entre tenants.
