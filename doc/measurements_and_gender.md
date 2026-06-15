# Mediciones corporales y género — ampliación de datos

## Resumen

Se añaden dos bloques de funcionalidad:

1. **Género del paciente** — campo opcional en el perfil de usuario.
2. **Nuevas mediciones** — cintura, pecho, cadera, contorno, brazo y porcentaje de agua corporal, todas opcionales, con histórico igual que peso/IMC/bodyFat.

**Ninguno de los nuevos campos es obligatorio.** Todos son opcionales tanto en creación como en actualización.

---

## 1. Género (`gender`)

### Crear usuario

Nuevo campo opcional en `POST /tenant/{tenantId}/users` (o el endpoint de creación equivalente):

```json
{
  "email": "paciente@example.com",
  "firstName": "María",
  "lastName": "García",
  "birthDate": "1990-03-15",
  "heightCm": 165.0,
  "gender": "FEMALE"
}
```

### Actualizar usuario

Nuevo campo opcional en `PUT /tenant/{tenantId}/users/{userId}`:

```json
{
  "gender": "MALE"
}
```

### Valores permitidos

| Valor | Descripción |
|---|---|
| `"MALE"` | Hombre |
| `"FEMALE"` | Mujer |

Si no se envía o se envía `null`, el campo no se modifica (semántica PATCH-like).

---

## 2. Nuevas mediciones corporales

### Crear medición

Nuevos campos opcionales en `POST /tenant/{tenantId}/users/{userId}/measurements`:

```json
{
  "weightKg": 72.5,
  "bodyFatPct": 18.5,
  "muscleMassKg": 35.0,
  "waistCm": 80.0,
  "chestCm": 95.0,
  "hipsCm": 100.0,
  "contourCm": 88.0,
  "armCm": 32.0,
  "bodyWaterPct": 55.0,
  "measuredAt": "2026-06-15T10:30:00Z",
  "notes": "Medición matutina"
}
```

| Campo | Tipo | Validación |
|---|---|---|
| `waistCm` | `number` (Decimal 5,1) | `@PositiveOrZero` |
| `chestCm` | `number` (Decimal 5,1) | `@PositiveOrZero` |
| `hipsCm` | `number` (Decimal 5,1) | `@PositiveOrZero` |
| `contourCm` | `number` (Decimal 5,1) | `@PositiveOrZero` |
| `armCm` | `number` (Decimal 5,1) | `@PositiveOrZero` |
| `bodyWaterPct` | `number` (Decimal 4,1) | `@PositiveOrZero` |

### Obtener última medición

`GET /tenant/{tenantId}/users/{userId}/measurements/latest`

```json
{
  "id": "uuid",
  "measuredAt": "2026-06-15T10:30:00Z",
  "weightKg": 72.5,
  "bodyFatPct": 18.5,
  "muscleMassKg": 35.0,
  "waistCm": 80.0,
  "chestCm": 95.0,
  "hipsCm": 100.0,
  "contourCm": 88.0,
  "armCm": 32.0,
  "bodyWaterPct": 55.0,
  "bmi": 24.2,
  "notes": "Medición matutina",
  "recordedBy": "email del profesional",
  "createdAt": "2026-06-15T10:30:00Z"
}
```

### Histórico de mediciones

`GET /tenant/{tenantId}/users/{userId}/measurements/history`

```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "heightCm": 165.0,
  "points": [
    {
      "measuredAt": "2026-06-15T10:30:00Z",
      "weightKg": 72.5,
      "bodyFatPct": 18.5,
      "muscleMassKg": 35.0,
      "waistCm": 80.0,
      "chestCm": 95.0,
      "hipsCm": 100.0,
      "contourCm": 88.0,
      "armCm": 32.0,
      "bodyWaterPct": 55.0,
      "bmi": 24.2
    }
  ]
}
```

Los nuevos campos se devuelven siempre en la respuesta. Si una medición no registró alguno de ellos, vendrá como `null`.

---

## 3. Perfil del usuario — respuesta con gender

La respuesta de cualquier endpoint que devuelva un `AppUser` incluirá ahora el campo `gender`:

```json
{
  "id": "uuid",
  "email": "paciente@example.com",
  "firstName": "María",
  "lastName": "García",
  "birthDate": "1990-03-15",
  "heightCm": 165.0,
  "gender": "FEMALE",
  "age": 36
}
```

---

## 4. Notas técnicas

- **IMC no cambia**: la fórmula del IMC (`peso / altura²`) es independiente del género, no se ha modificado.
- **Todas las nuevas mediciones son opcionales**: la restricción `ck_bm_any_metric` a nivel de base de datos exige que al menos una métrica (nueva o existente) esté presente, pero permite que el resto sean `NULL`.
- **Género opcional**: la columna `gender` no tiene `NOT NULL`, los usuarios existentes quedan con `NULL` hasta que se actualicen.
- **Retrocompatible**: los endpoints existentes funcionan sin cambios; los nuevos campos simplemente se ignoran si no se envían.

---

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/main/resources/db/migration/V6__add_measurements_and_gender.sql` | Nueva migración Flyway |
| `src/main/java/.../models/entity/Gender.java` | Nuevo enum (`MALE`, `FEMALE`) |
| `src/main/java/.../models/entity/AppUser.java` | Nuevo campo `gender` |
| `src/main/java/.../models/entity/BodyMeasurement.java` | Nuevos campos: `waistCm`, `chestCm`, `hipsCm`, `contourCm`, `armCm`, `bodyWaterPct` |
| `src/main/java/.../controller/dto/CreateAppUserRequest.java` | Nuevo campo `gender` |
| `src/main/java/.../controller/dto/UpdateUserRequest.java` | Nuevo campo `gender` |
| `src/main/java/.../controller/dto/CreateBodyMeasurementRequest.java` | Nuevos campos: `waistCm`, `chestCm`, `hipsCm`, `contourCm`, `armCm`, `bodyWaterPct` |
| `src/main/java/.../models/dto/BodyMeasurementDto.java` | Nuevos campos en respuesta |
| `src/main/java/.../models/dto/MeasurementHistoryDto.java` | Nuevos campos en histórico |
| `src/main/java/.../service/AppUserService.java` | Mapeo de `gender` en `save()` y `updateUser()` |
| `src/main/java/.../service/BodyMeasurementService.java` | Mapeo de nuevas mediciones en `create()`, `mapToDto()`, `getEvolution()` |
