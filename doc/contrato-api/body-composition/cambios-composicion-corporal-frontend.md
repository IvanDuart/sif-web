# Cambios API — Composición corporal (masa muscular, grasa visceral y clasificación de % grasa)

> **Para:** equipo de Frontend (app Flutter / clientes de la API)
> **Ámbito:** endpoints de mediciones corporales y reporte de composición corporal
> **Migrations:** `V39__muscle_mass_to_percentage.sql`, `V40__add_visceral_fat_level.sql`

---

## TL;DR (resumen ejecutivo)

| Cambio | Tipo | Impacto en frontend |
|---|---|---|
| `muscleMassKg` → **`muscleMassPct`** | ⚠️ **BREAKING** | Renombrar el campo en request y response. Ahora es un **porcentaje** (ej. `42.5`), no kg. |
| **`visceralFatLevel`** (nuevo) | ✅ Aditivo | Campo opcional nuevo en request/response (entero 1-59). |
| **`bodyFatClassification`** + **`localizedBodyFatClassification`** (nuevos) en `global` del reporte | ✅ Aditivo | Nuevos campos dentro de `bodyCompositionReport.global`. |
| **`visceralFatLevel`** también en `global` del reporte | ✅ Aditivo | Se propaga el valor de la báscula al reporte. |

> **Nada de esto es obligatorio.** Todos los campos siguen siendo opcionales (la BD exige que haya al menos una métrica).

---

## 1. `muscleMassKg` → `muscleMassPct` (BREAKING CHANGE)

La masa muscular que reportan las básculas viene **en porcentaje**, no en kilogramos. El campo se renombró y cambió de unidad.

| Antes | Ahora |
|---|---|
| `muscleMassKg` (kg, Decimal 5,2) | `muscleMassPct` (% , Decimal 4,1) |

- **Unidad:** porcentaje de masa muscular (rango lógico `0.0` – `100.0`).
- **Precisión:** 1 decimal (ej. `38.0`, `42.5`).
- **Datos previos en kg:** se han **descartado** (quedan `NULL`). No hay conversión; las mediciones antiguas pierden este dato.
- **Endpoints afectados:** todos los que devuelven `BodyMeasurementDto` / `MeasurementHistoryDto.MeasurementPoint` y el request de creación.

### Ejemplo de request antes / después

```jsonc
// ANTES
{ "weightKg": 75.5, "bodyFatPct": 18.0, "muscleMassKg": 38.0 }

// AHORA
{ "weightKg": 75.5, "bodyFatPct": 18.0, "muscleMassPct": 38.0 }
```

---

## 2. `visceralFatLevel` (NUEVO)

Nivel de grasa visceral (**VFL**, *Visceral Fat Level*) que reportan las básculas (Tanita / InBody).

| Campo | Tipo | Rango | Obligatorio |
|---|---|---|---|
| `visceralFatLevel` | `integer` | `1` – `59` | No |

- Se acepta en `POST /tenant/{tenantId}/users/{userId}/measurements`.
- Se devuelve en `BodyMeasurementDto` (latest, list, y `tenant users`) y en `MeasurementHistoryDto.points[]`.
- Si se envía fuera de rango (0 o >59) y se solicita el reporte de composición, la API responde `400` con el mensaje `El nivel de grasa visceral debe estar entre 1 y 59 si se proporciona`.
- También se expone en el reporte de composición como `global.visceralFatLevel` (ver sección 3).

### Estimación automática (fallback)

Si la medición **no** trae `visceralFatLevel`, el backend lo **estima** a partir del ratio cintura/altura (**WHtR**), usando el `waistCm` de la misma medición y la altura del paciente:

```
WHtR = waistCm / heightCm
VFL  = clamp( round( (WHtR − 0.40) × 100 ), 1, 59 )
```

Ejemplos (altura 180 cm): cintura 90 → WHtR 0.50 → **VFL 10**; cintura 99 → **15**; cintura 108 → **20**.

- El valor estimado se expone **solo** dentro de `bodyCompositionReport.global.visceralFatLevel`.
- El campo crudo `BodyMeasurementDto.visceralFatLevel` sigue devolviendo `null` (no se persiste el valor estimado).
- Si tampoco hay `waistCm`, `global.visceralFatLevel` es `null`.
- No se distingue en la respuesta si el valor fue medido o estimado.
- **Prioridad:** si la báscula reportó un `visceralFatLevel`, ese valor siempre gana; la estimación solo aplica cuando viene vacío.

---

## 3. Clasificación del % de grasa corporal (NUEVO en el reporte)

Dentro de `bodyCompositionReport.global` se añaden dos campos que clasifican el `bodyFatPct` del paciente frente a su **rango saludable personalizado** (calculado por sexo y edad):

| Campo | Tipo | Descripción |
|---|---|---|
| `bodyFatClassification` | `string` (enum) | Código de la clasificación. |
| `localizedBodyFatClassification` | `string` | Texto traducido según `user.language` (`es` / `en`). |

### Valores posibles del enum

| `bodyFatClassification` | `localizedBodyFatClassification` (es) | `localizedBodyFatClassification` (en) |
|---|---|---|
| `LOW` | Bajo | Low |
| `NORMAL` | Normo | Normal |
| `OBESE` | Obesidad | Obese |
| `OBESE_CLASS_I` | Obesidad 1 | Obesity 1 |
| `OBESE_CLASS_II` | Obesidad 2 | Obesity 2 |
| `OBESE_CLASS_III` | Obesidad 3 | Obesity 3 |

### Regla de cálculo

Sea `[min, max]` el rango saludable de % de grasa para el **sexo y edad** del paciente (el mismo `fatMassPctMin` / `fatMassPctMax` que ya devuelve `referenceRanges`):

| Condición | Clasificación |
|---|---|
| `bodyFatPct < min` | `LOW` |
| `min ≤ bodyFatPct ≤ max` | `NORMAL` |
| `max < bodyFatPct ≤ max + 5` | `OBESE` |
| `max + 5 < bodyFatPct ≤ max + 10` | `OBESE_CLASS_I` |
| `max + 10 < bodyFatPct ≤ max + 15` | `OBESE_CLASS_II` |
| `bodyFatPct > max + 15` | `OBESE_CLASS_III` |

> Los incrementos (`+5`, `+10`, `+15`) son **fijos**. El punto de partida (`max`) es personalizado por sexo/edad, por lo que la misma grasa corporal puede clasificar distinto según el paciente.
>
> Si no hay datos suficientes (`bodyFatPct`, `min` o `max` nulos), ambos campos vienen `null`.

### Ejemplo (hombre < 40 años → rango saludable 8.0 – 20.0 %)

| `bodyFatPct` | `bodyFatClassification` |
|---|---|
| 5.0 | `LOW` |
| 15.0 | `NORMAL` |
| 22.0 | `OBESE` |
| 27.0 | `OBESE_CLASS_I` |
| 32.0 | `OBESE_CLASS_II` |
| 40.0 | `OBESE_CLASS_III` |

---

## 4. Ejemplo completo de response (`latest`)

```json
{
  "id": "9f1c...",
  "measuredAt": "2026-09-14T08:30:00Z",
  "weightKg": 82.5,
  "bodyFatPct": 18.2,
  "muscleMassPct": 42.5,
  "waistCm": 85.0,
  "chestCm": 100.0,
  "hipsCm": 98.0,
  "contourCm": 90.0,
  "armCm": 34.0,
  "bodyWaterPct": 58.5,
  "visceralFatLevel": 12,
  "wristCircumferenceCm": 17.5,
  "boneMassKg": 3.20,
  "trunkFatPct": 19.5,
  "trunkMassKg": 41.25,
  "rightArmFatPct": 15.0,
  "rightArmMassKg": 4.15,
  "leftArmFatPct": 15.2,
  "leftArmMassKg": 4.15,
  "rightLegFatPct": 17.0,
  "rightLegMassKg": 14.72,
  "leftLegFatPct": 17.2,
  "leftLegMassKg": 14.72,
  "bmi": 25.5,
  "bodyCompositionReport": {
    "patient": {
      "gender": "MALE",
      "ageYears": 34,
      "heightCm": 180.0,
      "weightKg": 82.5,
      "wristCircumferenceCm": 17.5
    },
    "global": {
      "bmi": 25.5,
      "bmiClassification": "OVERWEIGHT",
      "localizedBmiClassification": "Sobrepeso",
      "bodyFatClassification": "NORMAL",
      "localizedBodyFatClassification": "Normo",
      "fatMassKg": 15.02,
      "fatFreeMassKg": 67.48,
      "waterMassKg": 48.26,
      "visceralFatLevel": 12,
      "boneComposition": {
        "boneMassKg": 3.20,
        "boneMassPctOfWeight": 3.9,
        "evaluation": "NORMAL",
        "localizedDescription": "Masa ósea dentro de rangos normales"
      }
    },
    "bodyFrame": { "...": "..." },
    "segmentalAnalysis": { "...": "..." },
    "symmetry": { "...": "..." },
    "referenceRanges": {
      "normalWeightMinKg": 59.9,
      "normalWeightMaxKg": 80.7,
      "fatFreeMassMinKg": 64.0,
      "fatFreeMassMaxKg": 72.7,
      "fatMassPctMin": 8.0,
      "fatMassPctMax": 20.0,
      "waterMassMinKg": 39.7,
      "waterMassMaxKg": 50.9,
      "boneMassMinKg": 3.15,
      "boneMassMaxKg": 3.65
    },
    "language": "es",
    "calculatedAt": "2026-09-14T08:30:00Z"
  },
  "notes": "Pesaje matutino en ayunas",
  "recordedBy": "nutricionista@centro.com",
  "createdAt": "2026-09-14T08:30:00Z"
}
```

---

## 5. Endpoints afectados

| Método | Ruta | Cambio |
|---|---|---|
| `POST` | `/api/tenant/{tenantId}/users/{userId}/measurements` | Request: `muscleMassKg` → `muscleMassPct`; nuevo `visceralFatLevel`. Response: mismos campos. |
| `GET` | `/api/tenant/{tenantId}/users/{userId}/measurements/latest` | Response: `muscleMassPct`, `visceralFatLevel`; reporte con `bodyFatClassification`. |
| `GET` | `/api/tenant/{tenantId}/users/{userId}/measurements` | Igual que `latest` (paginado). |
| `GET` | `/api/tenant/{tenantId}/users/{userId}/measurements/evolution` | `points[]`: `muscleMassPct`, `visceralFatLevel` (sin reporte). |
| `POST` | `/api/tenant/{tenantId}/users/{userId}/measurements/calculate-composition` | Response `BodyCompositionReport` con `global.bodyFatClassification`, `global.localizedBodyFatClassification`, `global.visceralFatLevel`. |
| `GET` | `/api/tenant/{tenantId}/users/{userId}/profile` | `bodyCompositionReport` incluye los nuevos campos globales. |
| `GET` | `/api/tenant/{tenantId}/users` | El `lastMeasurement` embebido ahora usa `muscleMassPct` e incluye `visceralFatLevel`. |

---

## 6. Checklist de migración para frontend

- [ ] Renombrar en modelos/serializadores el campo `muscleMassKg` → `muscleMassPct` (request **y** response).
- [ ] Cambiar la etiqueta de UI de "Masa muscular (kg)" → "Masa muscular (%)" y ajustar el input (1 decimal, 0-100).
- [ ] Añadir input opcional "Grasa visceral (VFL)" con validación entera `1`–`59`.
- [ ] Añadir a la pantalla de composición la clasificación de grasa (`localizedBodyFatClassification`) y su código (`bodyFatClassification`) si se quiere colorear/badges.
- [ ] Mostrar `visceralFatLevel` del reporte (`global.visceralFatLevel`), teniendo en cuenta que puede venir **estimado por WHtR** aunque el campo crudo sea `null`.
- [ ] Manejar `null` en todos los campos nuevos.

---

## 7. Notas de compatibilidad

- **No se renombró** `fatFreeMassKg` ni `fatFreeMassMinKg` / `fatFreeMassMaxKg`: siguen representando la *masa libre de grasa* (peso − masa grasa) tal cual. (Pendiente futuro: relacionarlo con masa muscular.)
- El enum `bodyFatClassification` es independiente de `bmiClassification`; ambos coexisten en `global`.
- Los textos localizados se sirven según `user.language` (`es` por defecto, `en` si está configurado).
