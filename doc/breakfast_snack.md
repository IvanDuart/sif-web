# Desayuno y merienda fijos del paciente

## 1. Resumen

Se añaden los campos `breakfast` y `snack` a la tabla `user_tenant_profile` para almacenar el **desayuno** y la **merienda fijos** de cada paciente. A diferencia de las comidas (`Meal`) que pertenecen a un menú (`Menu`) con historial, estos valores **son fijos** — no varían por semana ni requieren histórico. Se actualizan directamente en el perfil cuando el dietista lo necesita.

---

## 2. Endpoints

No se crean endpoints nuevos. Los campos se gestionan a través de los endpoints existentes del perfil del paciente:

### `GET /tenant/{tenantId}/users/{userId}/profile`

Los nuevos campos aparecen en la respuesta:

```json
{
  "consultationReason": "Pérdida de peso",
  ...
  "breakfast": "Café con leche + tostada integral con aguacate",
  "snack": "Yogur natural + fruta"
}
```

### `PUT /tenant/{tenantId}/users/{userId}/profile`

Se pueden enviar o no, son opcionales como el resto de campos:

```json
{
  "breakfast": "Café con leche + tostada integral con aguacate",
  "snack": "Yogur natural + fruta"
}
```

Si no se envían o se envían como `null`, se guardan como `null`.

---

## 3. Tabla de campos nuevos

| Campo | Tipo | Descripción |
|---|---|---|
| `breakfast` | `string` | Desayuno fijo del paciente |
| `snack` | `string` | Merienda fija del paciente |

Ambos son de tipo `TEXT` en PostgreSQL, sin límite práctico de longitud.

---

## 4. Seguridad

No se crean nuevos permisos. Se aplican los mismos que para el resto del perfil:

| Permiso | Descripción |
|---|---|
| `VIEW_PATIENT_PROFILE` | Ver desayuno y merienda |
| `MANAGE_PATIENT_PROFILE` | Editar desayuno y merienda |

---

## 5. Notas técnicas

- **Sin historial**: estos campos se sobrescriben con cada `PUT`, igual que el resto del perfil. No hay tabla de histórico asociada.
- **Sin entidad separada**: al ser valores fijos por paciente, se almacenan directamente en `user_tenant_profile` en lugar de crear una entidad `Meal` vinculada a un `Menu`.
- **Compatibilidad con menús**: el desayuno y la merienda definidos aquí conviven con los del menú semanal (`Menu` → `Meal` con `mealType = 'BREAKFAST'` o `'SNACK'`). El frontend debe decidir qué fuente mostrar según el contexto (vista de plan semanal vs. perfil del paciente).

---

## 6. Ficheros modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V12__add_breakfast_snack_to_profile.sql` | Nuevo — añade columnas `breakfast` y `snack` a `user_tenant_profile` |
| `models/entity/UserTenantProfile.java` | Modificado — añade atributos `breakfast` y `snack` |
| `models/dto/UserTenantProfileDto.java` | Modificado — añade campos `breakfast` y `snack` |
| `controller/dto/UpdateUserTenantProfileRequest.java` | Modificado — añade campos `breakfast` y `snack` |
| `service/UserTenantProfileService.java` | Modificado — mapea `breakfast` y `snack` en `toDto()` y `upsertProfile()` |
