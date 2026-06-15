# Endpoints CRUD — MealTemplate dentro de MenuTemplate

## Resumen

Nuevos endpoints para gestionar platos individuales (`MealTemplate`) dentro de una plantilla de menú (`MenuTemplate`), permitiendo edición incremental sin tener que recrear la plantilla completa.

**Permiso requerido:** `MANAGE_TEMPLATE`

**Propósito:** Que el frontend pueda tener una página de detalle navegable de plantilla con posibilidad de añadir, editar y eliminar platos uno a uno, igual que en el detalle de un menú real.

---

## Endpoints

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/tenant/{tenantId}/menu-template/{templateId}/meals` | `MANAGE_TEMPLATE` | Añadir un plato a la plantilla |
| `PUT` | `/tenant/{tenantId}/menu-template/{templateId}/meals/{mealId}` | `MANAGE_TEMPLATE` | Actualizar un plato existente |
| `DELETE` | `/tenant/{tenantId}/menu-template/{templateId}/meals/{mealId}` | `MANAGE_TEMPLATE` | Eliminar un plato de la plantilla |

---

## POST — Añadir plato

### Request body

```json
{
  "dayOfWeek": "MONDAY",
  "mealType": "LUNCH",
  "description": "Pechuga de pollo con arroz y verduras"
}
```

| Campo | Tipo | Validación |
|---|---|---|
| `dayOfWeek` | `string` (max 20) | `@NotBlank` |
| `mealType` | `string` (max 20) | `@NotBlank` |
| `description` | `string` | `@NotBlank` |

### Response

`201 Created` — Devuelve el `MealTemplate` creado con vista `@JsonView(JsonViews.Public.class)`:

```json
{
  "id": "uuid",
  "dayOfWeek": "MONDAY",
  "mealType": "LUNCH",
  "description": "Pechuga de pollo con arroz y verduras"
}
```

---

## PUT — Actualizar plato

### Request body

Mismo shape que POST:

```json
{
  "dayOfWeek": "TUESDAY",
  "mealType": "DINNER",
  "description": "Salmón con ensalada"
}
```

### Response

`200 OK` — Devuelve el `MealTemplate` actualizado (mismo shape que POST).

---

## DELETE — Eliminar plato

### Response

`204 No Content` — El plato se elimina de la plantilla.

---

## Códigos de respuesta

| Código | Descripción |
|---|---|
| `200 OK` | Plato actualizado correctamente (PUT) |
| `201 Created` | Plato creado correctamente (POST) |
| `204 No Content` | Plato eliminado correctamente (DELETE) |
| `400 Bad Request` | Error de validación (campos vacíos, too large) |
| `403 Forbidden` | El usuario autenticado no tiene permiso `MANAGE_TEMPLATE` en el tenant |
| `404 Not Found` | Template no encontrado, no pertenece al tenant, o el meal no pertenece al template |

---

## Ejemplos

### Añadir un plato a una plantilla

```bash
curl -X POST "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/menu-template/550e8400-e29b-41d4-a716-446655440000/meals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": "MONDAY",
    "mealType": "LUNCH",
    "description": "Pechuga de pollo con arroz y verduras"
  }'
```

### Editar un plato existente

```bash
curl -X PUT "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/menu-template/550e8400-e29b-41d4-a716-446655440000/meals/660e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": "MONDAY",
    "mealType": "LUNCH",
    "description": "Pollo al horno con patatas"
  }'
```

### Eliminar un plato

```bash
curl -X DELETE "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/menu-template/550e8400-e29b-41d4-a716-446655440000/meals/660e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Cambios en el código

### Archivos creados

- `src/main/java/com/carajillolabs/tusdietas/controller/dto/UpdateMealTemplateRequest.java`

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `MealTemplateRepository.java` | Nuevo método `findByIdAndMenuTemplateId(id, menuTemplateId)` |
| `MenuTemplateService.java` | Nuevos métodos `addMeal()`, `updateMeal()`, `deleteMeal()` |
| `MenuTemplateController.java` | Nuevos endpoints `POST .../meals`, `PUT .../meals/{mealId}`, `DELETE .../meals/{mealId}` |

---

## Notas técnicas

- **Validación cross-tenant**: Se verifica que el template pertenezca al tenant. Si no, se devuelve `404 TEMPLATE_NOT_FOUND` (sin exponer existencia entre tenants).
- **Pertenencia meal↔template**: Se verifica que el meal pertenezca al template mediante `findByIdAndMenuTemplateId`. Si no, `404 MEAL_NOT_FOUND`.
- **Cascade**: `MenuTemplate.mealTemplates` tiene `cascade = CascadeType.ALL, orphanRemoval = true`, por lo que al eliminar un `MealTemplate` con `delete()` se maneja correctamente.
- **No rompe nada**: Son endpoints aditivos. El `POST /menu-template` existente sigue funcionando para crear plantillas con platos embebidos.
