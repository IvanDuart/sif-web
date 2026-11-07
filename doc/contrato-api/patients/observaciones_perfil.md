# Observaciones del perfil del paciente

## 1. Resumen

Se añade el campo `observations` a la tabla `user_tenant_profile` para almacenar **observaciones libres** del profesional sobre el paciente, siguiendo el mismo patrón que `breakfast` (desayuno) y `snack` (merienda): texto libre sin límite de longitud (`TEXT`), sin histórico, sobrescrito en cada actualización del perfil.

Además, este valor ahora se incluye en la **generación del PDF del menú** como comida fija, **debajo de la Merienda** (es la última entrada del bloque de comidas fijas).

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
  "snack": "Yogur natural + fruta",
  "observations": "Paciente refiere intolerancia leve a la lactosa, revisar en próxima consulta"
}
```

### `PUT /tenant/{tenantId}/users/{userId}/profile`

Se puede enviar o no, es opcional como el resto de campos:

```json
{
  "observations": "Paciente refiere intolerancia leve a la lactosa, revisar en próxima consulta"
}
```

Si no se envía o se envía como `null`, se guarda como `null`.

---

## 3. Tabla de campos nuevos

| Campo | Tipo | Máx. longitud | Descripción |
|---|---|---|---|
| `observations` | `string` | Sin límite (`TEXT`) | Observaciones libres del profesional sobre el paciente |

> A diferencia de `lunch` (máximo 150 caracteres), `observations` **no tiene límite de longitud** — se comporta igual que `breakfast` y `snack` (columna `TEXT`, sin validación `@Size`). El frontend no necesita aplicar `maxLength` en el formulario.

---

## 4. PDF del menú

El endpoint de generación del PDF del menú ahora muestra las observaciones como última comida fija.

**Orden de las comidas fijas en el PDF:**

```
DESAYUNO:      <breakfast>
ALMUERZO:      <lunch>
MERIENDA:      <snack>
OBSERVACIONES: <observations>
```

Comportamiento:
- Si `observations` es `null` o está vacío/en blanco, **no** se dibuja la fila "OBSERVACIONES" en el PDF (igual que ocurre con el resto de comidas fijas).
- Las comidas del menú semanal (`Menu` → `Meal`) se muestran después de las comidas fijas, sin cambios.

---

## 5. Seguridad

No se crean nuevos permisos. Se aplican los mismos que para el resto del perfil:

| Permiso | Descripción |
|---|---|
| `VIEW_PATIENT_PROFILE` | Ver las observaciones |
| `MANAGE_PATIENT_PROFILE` | Editar las observaciones |

---

## 6. Notas técnicas

- **Sin historial**: el campo se sobrescribe con cada `PUT`, igual que el resto del perfil.
- **Sin validación de longitud**: columna `TEXT` en PostgreSQL, sin anotación `@Size` en `UpdateUserTenantProfileRequest` ni en la entidad.
- **PDF**: `MenuPdfService` lee `profile.getObservations()` y lo añade a un `LinkedHashMap` de comidas fijas con clave `"OBSERVACIONES"`, insertada **después** de `"MERIENDA"` — el orden de inserción del `LinkedHashMap` garantiza que se dibuje en último lugar.

---

## 7. Ficheros modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V41__add_observations_to_profile.sql` | Nuevo — añade columna `observations TEXT` a `user_tenant_profile` |
| `models/entity/UserTenantProfile.java` | Modificado — añade atributo `observations` (`@Column(columnDefinition = "TEXT")`) |
| `models/dto/UserTenantProfileDto.java` | Modificado — añade campo `observations` |
| `controller/dto/UpdateUserTenantProfileRequest.java` | Modificado — añade campo `observations` (sin validación) |
| `service/UserTenantProfileService.java` | Modificado — mapea `observations` en `toDto()` y `upsertProfile()` |
| `service/MenuPdfService.java` | Modificado — incluye `OBSERVACIONES` como última comida fija del PDF |
