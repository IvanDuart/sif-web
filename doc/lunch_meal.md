# Almuerzo fijo del paciente

## 1. Resumen

Se añade el campo `lunch` a la tabla `user_tenant_profile` para almacenar el **almuerzo fijo** de cada paciente, siguiendo el mismo patrón que `breakfast` (desayuno) y `snack` (merienda). Es un valor **fijo** — no varía por semana ni requiere histórico. Se actualiza directamente en el perfil cuando el dietista lo necesita.

Además, este valor ahora se incluye en la **generación del PDF del menú** como comida fija, entre el desayuno y la merienda.

---

## 2. Endpoints

No se crean endpoints nuevos. El campo se gestiona a través de los endpoints existentes del perfil del paciente:

### `GET /tenant/{tenantId}/users/{userId}/profile`

El nuevo campo aparece en la respuesta:

```json
{
  "consultationReason": "Pérdida de peso",
  ...
  "breakfast": "Café con leche + tostada integral con aguacate",
  "lunch": "Ensalada de pollo + arroz integral",
  "snack": "Yogur natural + fruta"
}
```

### `PUT /tenant/{tenantId}/users/{userId}/profile`

Se puede enviar o no, es opcional como el resto de campos:

```json
{
  "lunch": "Ensalada de pollo + arroz integral"
}
```

Si no se envía o se envía como `null`, se guarda como `null`.

---

## 3. Tabla de campos nuevos

| Campo | Tipo | Máx. longitud | Descripción |
|---|---|---|---|
| `lunch` | `string` | 150 caracteres | Almuerzo fijo del paciente |

> **Importante**: a diferencia de `breakfast` y `snack` (que son `TEXT` sin límite), `lunch` tiene un **máximo de 150 caracteres**. Si el frontend envía un valor más largo, la API responde `400 Bad Request`. Se recomienda aplicar la misma validación (`maxLength: 150`) en los formularios del frontend.

---

## 4. PDF del menú

El endpoint de generación del PDF del menú (`GET /tenant/{tenantId}/menus/{menuId}/pdf`) ahora muestra el almuerzo como comida fija.

**Orden de las comidas fijas en el PDF:**

```
DESAYUNO:  <breakfast>
ALMUERZO:  <lunch>
MERIENDA:  <snack>
```

Comportamiento:
- Si `lunch` es `null` o está vacío, **no** se dibuja la fila "ALMUERZO" en el PDF (igual que ya ocurre con DESAYUNO y MERIENDA).
- Las comidas del menú semanal (`Menu` → `Meal` con `mealType = 'COMIDA'` / `'CENA'`) se muestran después de las comidas fijas, sin cambios.

---

## 5. Seguridad

No se crean nuevos permisos. Se aplican los mismos que para el resto del perfil:

| Permiso | Descripción |
|---|---|
| `VIEW_PATIENT_PROFILE` | Ver el almuerzo |
| `MANAGE_PATIENT_PROFILE` | Editar el almuerzo |

---

## 6. Notas técnicas

- **Sin historial**: el campo se sobrescribe con cada `PUT`, igual que el resto del perfil.
- **Validación**: `@Size(max = 150)` en la capa de validación (`UpdateUserTenantProfileRequest`) y `VARCHAR(150)` en PostgreSQL. El frontend debe respetar ese límite para evitar errores 400.
- **PDF**: `MenuPdfService` lee `profile.getLunch()` y lo añade a `fixedMeals` como clave `"ALMUERZO"` entre `"DESAYUNO"` y `"MERIENDA"`.
- **Compatibilidad con menús**: el almuerzo definido aquí convive con las comidas del menú semanal. El frontend debe decidir qué fuente mostrar según el contexto (vista de plan semanal vs. perfil del paciente).

---

## 7. Ficheros modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V30__add_lunch_to_profile.sql` | Nuevo — añade columna `lunch VARCHAR(150)` a `user_tenant_profile` |
| `models/entity/UserTenantProfile.java` | Modificado — añade atributo `lunch` con `@Size(max = 150)` y `@Column(length = 150)` |
| `models/dto/UserTenantProfileDto.java` | Modificado — añade campo `lunch` |
| `controller/dto/UpdateUserTenantProfileRequest.java` | Modificado — añade campo `lunch` con `@Size(max = 150)` |
| `service/UserTenantProfileService.java` | Modificado — mapea `lunch` en `toDto()` y `upsertProfile()` |
| `service/MenuPdfService.java` | Modificado — incluye `ALMUERZO` en las comidas fijas del PDF |
| `test/.../UserTenantProfileServiceTest.java` | Modificado — aserciones para `lunch` |