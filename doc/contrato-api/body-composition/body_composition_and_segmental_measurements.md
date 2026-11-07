# Composición Corporal, Complexión Física, Análisis Segmental y Rangos de Referencia

> **Actualizado con la revisión de cálculos v2.** Los cambios con impacto en los clientes de la API
> (grasa visceral sin estimar, `symmetry` anulable, `segmentalAnalysis` incompleto, procedencia de
> los valores y nuevo tramo `OVERWEIGHT`) están resumidos para frontend en
> [`cambios-composicion-corporal-v2-frontend.md`](cambios-composicion-corporal-v2-frontend.md).

## Resumen

Se ha integrado en el backend de *Tus Dietas* un motor clínico de evaluación de bioimpedancia segmental (tipo Tanita / InBody), complexión física (índice de Grant), evaluación de masa ósea, análisis de asimetría lateral bilateral y **cálculo de rangos y valores de referencia clínicos personalizados** (peso normal, masa libre de grasa, % grasa corporal saludable, agua corporal y masa ósea esperada), con persistencia en el perfil clínico del usuario e internacionalización (i18n) completa en español e inglés.

---

## 1. Arquitectura de Datos y Persistencia

El modelo separa conceptualmente el **histórico de mediciones** temporales del **perfil clínico activo**:

1. **Histórico de Mediciones (`body_measurement`)**:
   - Almacena las lecturas periódicas del paciente (peso, % de grasa, % de agua, perímetros y las 12 métricas segmentales).
   - **Todos los campos segmentales son opcionales / anulables** (`nullable`), permitiendo registros manuales flexibles.
2. **Perfil del Paciente en el Tenant (`user_tenant_profile`)**:
   - Almacena datos clínicos específicos del tenant.
   - `boneMassKg` (numérico, precision 4, scale 2): Masa ósea del paciente (constante en adultos, editable en el perfil).
   - `bodyCompositionReport` (`JSONB`): Almacena el **último informe consolidado de composición corporal** calculado bajo demanda, accesible directamente al consultar el perfil.

---

## 2. Endpoints de la API

Todos los endpoints están prefijados por el contexto de la aplicación (`/api`) y requieren autenticación JWT.

### 2.1. Cálculo y Persistencia Bajo Demanda de Composición Corporal

Calcula el informe clínico utilizando los datos más recientes del paciente (última medición registrada en `body_measurement` + datos antropométricos de `app_user` + perfil de `user_tenant_profile`) y persiste el resultado en el perfil del usuario.

- **Método**: `POST`
- **Ruta**: `/api/tenant/{tenantId}/users/{userId}/measurements/calculate-composition`
- **Permiso Requerido**: `@hasAccess.withTenantPermission(#tenantId, 'MANAGE_USER')` (Staff / Nutricionista)
- **Respuesta (`200 OK`)**: Objeto `BodyCompositionReport` (ver estructura en Sección 4).
- **Errores posibles**:
  - `404 Not Found`: Si el usuario, tenant o la última medición no existen (`MEASUREMENT_NOT_FOUND`, `USER_NOT_FOUND`, `USER_NOT_IN_TENANT`).

---

### 2.2. Perfil Clínico del Paciente (`user_tenant_profile`)

#### Obtener Perfil del Paciente
- **Método**: `GET`
- **Ruta**: `/api/tenant/{tenantId}/users/{userId}/profile`
- **Permiso Requerido**: `VIEW_USER` o propio usuario (`withTenantPermissionOrSelf`)
- **Respuesta (`200 OK`)**: `UserTenantProfileDto` incluyendo `boneMassKg` y `bodyCompositionReport`.

#### Actualizar Perfil Clínico
- **Método**: `PUT`
- **Ruta**: `/api/tenant/{tenantId}/users/{userId}/profile`
- **Permiso Requerido**: `MANAGE_USER`
- **Payload (`UpdateUserTenantProfileRequest`)**: Incluye campos de anamnesis, notas clínicas y `boneMassKg`:
  ```json
  {
    "consultationReason": "Pérdida de grasa y tonificación",
    "diseases": "Ninguna",
    "boneMassKg": 2.85,
    "lunch": "Arroz con pollo y ensalada",
    "hasDiabetes": false
  }
  ```

---

### 2.3. Gestión de Mediciones (`body_measurement`)

#### Registrar Nueva Medición
- **Método**: `POST`
- **Ruta**: `/api/tenant/{tenantId}/users/{userId}/measurements`
- **Permiso Requerido**: `MANAGE_USER`
- **Payload (`CreateBodyMeasurementRequest`)**:
  ```json
  {
    "measuredAt": "2026-09-04T08:30:00Z",
    "weightKg": 75.5,
    "bodyFatPct": 18.0,
    "muscleMassPct": 38.0,
    "bodyWaterPct": 55.0,
    "visceralFatLevel": 12,
    "waistCm": 82.0,
    "wristCircumferenceCm": 17.5,
    "boneMassKg": 3.2,
    "trunkFatPct": 19.0,
    "trunkMassKg": 37.75,
    "rightArmFatPct": 15.0,
    "rightArmMassKg": 4.15,
    "leftArmFatPct": 15.5,
    "leftArmMassKg": 4.15,
    "rightLegFatPct": 17.0,
    "rightLegMassKg": 14.72,
    "leftLegFatPct": 17.2,
    "leftLegMassKg": 14.72,
    "notes": "Pesaje matutino en ayunas con Tanita RD-953"
  }
  ```

#### Obtener Última Medición
- **Método**: `GET`
- **Ruta**: `/api/tenant/{tenantId}/users/{userId}/measurements/latest`
- **Permiso Requerido**: `VIEW_USER` o propio usuario
- **Respuesta**: `200 OK` con `BodyMeasurementDto` (incluye `bmi` y `bodyCompositionReport` calculado si existen datos antropométricos mínimos) o `204 No Content` si no hay mediciones.

#### Listado Histórico Paginado
- **Método**: `GET`
- **Ruta**: `/api/tenant/{tenantId}/users/{userId}/measurements?page=0&size=20&sort=measuredAt,desc`
- **Permiso Requerido**: `VIEW_USER` o propio usuario

#### Gráficas de Evolución Temporal
- **Método**: `GET`
- **Ruta**: `/api/tenant/{tenantId}/users/{userId}/measurements/evolution`
- **Permiso Requerido**: `VIEW_USER` o propio usuario
- **Respuesta**: `MeasurementHistoryDto` con array `points` conteniendo todas las métricas segmentales e IMC para graficar.

---

## 3. Campos de Bioimpedancia y Segmentales

| Campo | Tipo | Unidad | Descripción |
|---|---|---|---|
| `muscleMassPct` | `number` (Decimal 4,1) | % | Porcentaje de masa muscular reportado por la báscula (opcional) |
| `visceralFatLevel` | `integer` | nivel (1-59) | Nivel de grasa visceral (VFL) reportado por la báscula (opcional) |
| `wristCircumferenceCm` | `number` (Decimal 4,1) | cm | Perímetro de muñeca (opcional, para índice de Grant) |
| `boneMassKg` | `number` (Decimal 4,2) | kg | Masa ósea estimada por bioimpedancia (opcional) |
| `trunkFatPct` | `number` (Decimal 4,1) | % | Porcentaje de grasa en tronco |
| `trunkMassKg` | `number` (Decimal 5,2) | kg | Masa total en tronco (opcional, fallback anatómico 50.0%) |
| `rightArmFatPct` | `number` (Decimal 4,1) | % | Porcentaje de grasa en brazo derecho |
| `rightArmMassKg` | `number` (Decimal 4,2) | kg | Masa total en brazo derecho (opcional, fallback anatómico 5.5%) |
| `leftArmFatPct` | `number` (Decimal 4,1) | % | Porcentaje de grasa en brazo izquierdo |
| `leftArmMassKg` | `number` (Decimal 4,2) | kg | Masa total en brazo izquierdo (opcional, fallback anatómico 5.5%) |
| `rightLegFatPct` | `number` (Decimal 4,1) | % | Porcentaje de grasa en pierna derecha |
| `rightLegMassKg` | `number` (Decimal 4,2) | kg | Masa total en pierna derecha (opcional, fallback anatómico 19.5%) |
| `leftLegFatPct` | `number` (Decimal 4,1) | % | Porcentaje de grasa en pierna izquierda |
| `leftLegMassKg` | `number` (Decimal 4,2) | kg | Masa total en pierna izquierda (opcional, fallback anatómico 19.5%) |

---

## 4. Estructura JSON del Reporte Clínico (`BodyCompositionReport`)

A continuación se muestra el esquema exacto devuelto por `POST .../calculate-composition`, en `user_tenant_profile.bodyCompositionReport` y en `body_measurement.bodyCompositionReport`.

> El ejemplo refleja el **caso completo**: báscula que reporta % de grasa *y* masa por segmento. Con ese dato los cinco segmentos salen `MEASURED` y el bloque `symmetry` es evaluable. Si la báscula no da la masa por segmento —lo habitual hoy—, `totalMassSource` será `ESTIMATED` y **`symmetry` será `null`**; y los segmentos sin % de grasa propio no aparecen, de modo que `segmentalAnalysis` puede llegar vacío (§5.9).

```json
{
  "patient": {
    "gender": "MALE",
    "ageYears": 35,
    "heightCm": 170.0,
    "weightKg": 75.5,
    "wristCircumferenceCm": 17.5,
    "waistCm": 82.0
  },
  "global": {
    "bmi": 26.1,
    "bmiClassification": "OVERWEIGHT",
    "localizedBmiClassification": "Sobrepeso",
    "bodyFatClassification": "NORMAL",
    "localizedBodyFatClassification": "Normal",
    "fatMassKg": 13.59,
    "fatFreeMassKg": 61.91,
    "waterMassKg": 41.53,
    "visceralFatLevel": 12,
    "visceralFatSource": "MEASURED",
    "visceralFatCarriedFrom": null,
    "boneComposition": {
      "boneMassKg": 3.20,
      "boneMassPctOfWeight": 4.24,
      "evaluation": "NORMAL",
      "localizedDescription": "Masa ósea adecuada para el rango de peso y sexo",
      "source": "CARRIED_FORWARD",
      "carriedFrom": "2026-08-15T16:37:00Z"
    }
  },
  "bodyFrame": {
    "rIndex": 9.71,
    "frame": "MEDIUM",
    "localizedDescription": "Complexión Media (Índice r: 9.71)"
  },
  "segmentalAnalysis": {
    "TRUNK": {
      "segment": "TRUNK",
      "localizedSegmentName": "Tronco",
      "fatPct": 19.0,
      "totalMassKg": 37.75,
      "fatMassKg": 7.17,
      "leanMassKg": 30.58,
      "totalMassSource": "MEASURED"
    },
    "RIGHT_ARM": {
      "segment": "RIGHT_ARM",
      "localizedSegmentName": "Brazo Derecho",
      "fatPct": 15.0,
      "totalMassKg": 4.15,
      "fatMassKg": 0.62,
      "leanMassKg": 3.53,
      "totalMassSource": "MEASURED"
    },
    "LEFT_ARM": {
      "segment": "LEFT_ARM",
      "localizedSegmentName": "Brazo Izquierdo",
      "fatPct": 15.5,
      "totalMassKg": 4.15,
      "fatMassKg": 0.64,
      "leanMassKg": 3.51,
      "totalMassSource": "MEASURED"
    },
    "RIGHT_LEG": {
      "segment": "RIGHT_LEG",
      "localizedSegmentName": "Pierna Derecha",
      "fatPct": 17.0,
      "totalMassKg": 14.72,
      "fatMassKg": 2.50,
      "leanMassKg": 12.22,
      "totalMassSource": "MEASURED"
    },
    "LEFT_LEG": {
      "segment": "LEFT_LEG",
      "localizedSegmentName": "Pierna Izquierda",
      "fatPct": 17.2,
      "totalMassKg": 14.72,
      "fatMassKg": 2.53,
      "leanMassKg": 12.19,
      "totalMassSource": "MEASURED"
    }
  },
  "symmetry": {
    "upperLimbs": {
      "extremityType": "Extremidades Superiores (Brazos)",
      "rightFatPct": 15.0,
      "leftFatPct": 15.5,
      "fatPctDiffPoints": 0.5,
      "fatPctAlert": false,
      "leanMassComparable": true,
      "rightLeanMassKg": 3.53,
      "leftLeanMassKg": 3.51,
      "leanMassDiffKg": 0.02,
      "leanMassDiffPct": 0.6,
      "leanMassAlert": false,
      "asymmetricAlert": false,
      "localizedObservation": "Simetría normal dentro del margen clínico"
    },
    "lowerLimbs": {
      "extremityType": "Extremidades Inferiores (Piernas)",
      "rightFatPct": 17.0,
      "leftFatPct": 17.2,
      "fatPctDiffPoints": 0.2,
      "fatPctAlert": false,
      "leanMassComparable": true,
      "rightLeanMassKg": 12.22,
      "leftLeanMassKg": 12.19,
      "leanMassDiffKg": 0.03,
      "leanMassDiffPct": 0.2,
      "leanMassAlert": false,
      "asymmetricAlert": false,
      "localizedObservation": "Simetría normal dentro del margen clínico"
    },
    "thresholdPct": 5.0,
    "fatPctThresholdPoints": 5.0,
    "hasAnyAsymmetryAlert": false
  },
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
  "calculatedAt": "2026-09-04T08:30:00Z"
}
```

---

## 5. Reglas Clínicas, Enums y Fallbacks

### 5.1. Complexión Física de Grant (`BodyFrame`)
Calculado mediante el índice $r = \frac{\text{Altura en cm}}{\text{Perímetro de muñeca en cm}}$:

| Frame (`enum`) | Hombres | Mujeres | Descripción |
|---|---|---|---|
| `SMALL` | $r > 10.4$ | $r > 10.9$ | Complexión Pequeña |
| `MEDIUM` | $9.6 \le r \le 10.4$ | $9.9 \le r \le 10.9$ | Complexión Media |
| `LARGE` | $r < 9.6$ | $r < 9.9$ | Complexión Grande |
| `UNKNOWN` | No aportado | No aportado | Muñeca no proporcionada |

### 5.2. Evaluación de Masa Ósea (`BoneMassEvaluation`)
Se evalúa en función del sexo biológico y rangos de peso corporal:

| Sexo | Rango de Peso | Rango Ref. Masa Ósea (kg) |
|---|---|---|
| **Mujeres** | $< 50\text{ kg}$ | $1.75 - 2.15\text{ kg}$ (Ref: ~1.95 kg) |
| **Mujeres** | $50 - 75\text{ kg}$ | $2.20 - 2.60\text{ kg}$ (Ref: ~2.40 kg) |
| **Mujeres** | $> 75\text{ kg}$ | $2.75 - 3.15\text{ kg}$ (Ref: ~2.95 kg) |
| **Hombres** | $< 65\text{ kg}$ | $2.45 - 2.85\text{ kg}$ (Ref: ~2.65 kg) |
| **Hombres** | $65 - 95\text{ kg}$ | $3.05 - 3.45\text{ kg}$ (Ref: ~3.25 kg) |
| **Hombres** | $> 95\text{ kg}$ | $3.45 - 3.95\text{ kg}$ (Ref: ~3.69 kg) |

Valores posibles de `evaluation`: `NORMAL`, `LOW`, `HIGH`, `NOT_EVALUATED`.

### 5.3. Fallback de Masa Total por Segmento Anatómico
Si la báscula segmental solo reporta porcentajes de grasa pero no las masas individuales por segmento (`trunkMassKg = null`, etc.), el motor aplica la distribución anatómica estándar respecto al peso total y marca ese segmento con `totalMassSource: ESTIMATED`:
- **Tronco**: $50\%$ del peso total.
- **Brazo Derecho**: $5\%$ del peso total.
- **Brazo Izquierdo**: $5\%$ del peso total.
- **Pierna Derecha**: $16\%$ del peso total.
- **Pierna Izquierda**: $16\%$ del peso total.

> Los factores suman el $92\%$: el $8\%$ restante es cabeza y cuello, que no se reparte. Por eso la suma de los segmentos **no iguala** ni el peso total ni `global.fatMassKg`. Los valores están en `BodySegment.defaultWeightRatio`.

### 5.4. Análisis de Simetría Lateral Bilateral
Compara **dos magnitudes distintas** entre extremidades contralaterales (ver §5.9 para los requisitos de cada una).

**1. Diferencia de % de grasa**, en puntos porcentuales. Disponible siempre que ambos lados tengan lectura:
$$\text{fatPctDiffPoints} = |\text{Grasa}\%_D - \text{Grasa}\%_I|$$
- Si supera `fatPctThresholdPoints` ($5.0$ puntos por defecto), se activa `fatPctAlert: true`.

**2. Diferencia de masa magra**, solo si la masa de ambos segmentos está medida (`leanMassComparable: true`):
$$\text{leanMassDiffPct} = \frac{|\text{Masa Magra}_D - \text{Masa Magra}_I|}{\max(\text{Masa Magra}_D, \text{Masa Magra}_I)} \times 100$$
- Si supera `thresholdPct` ($5.0\%$ por defecto), se activa `leanMassAlert: true`.

`asymmetricAlert` es el OR de ambas, y `hasAnyAsymmetryAlert` el OR de los dos pares. Alertan al nutricionista sobre posible atrofia, sobreuso unilateral, desbalance muscular — o un error de lectura de la báscula que conviene repetir.

### 5.5. Rangos de Referencia Clínicos Personalizados (`ReferenceRangesResult`)

El motor calcula 5 pares de valores de referencia (mínimo y máximo saludable) adaptados a la antropometría individual del paciente:

#### 1. Rango de Peso Normal (`normalWeightMinKg` - `normalWeightMaxKg`)
Basado en los límites de IMC normativo de la OMS ($18.5 - 24.9\text{ kg/m}^2$) para la altura del paciente y ajustado por el factor de complexión física de Grant:
- $\text{Base Min} = 18.5 \times (\text{Altura en m})^2$
- $\text{Base Max} = 24.9 \times (\text{Altura en m})^2$
- **Ajuste por Complexión**:
  - `SMALL` (Pequeña): factor $0.96$
  - `MEDIUM` / `UNKNOWN` (Media o no aportada): factor $1.00$
  - `LARGE` (Grande): factor $1.04$

*Ejemplo*: Varón de 187 cm, complexión media $\rightarrow$ $[18.5 \times 1.87^2, 24.9 \times 1.87^2] = [64.7\text{ kg}, 87.1\text{ kg}]$ (aprox. 65 a 87 kg).

#### 2. Rango de % Grasa Corporal Saludable (`fatMassPctMin` - `fatMassPctMax`)
Establecido según sexo biológico y grupo etario (estándares Gallagher / OMS / Tanita):

| Sexo | Edad | Rango % Grasa Saludable |
|---|---|---|
| **Hombres** | $< 40$ años | $8.0\% - 20.0\%$ |
| **Hombres** | $40 - 59$ años | $11.0\% - 22.0\%$ |
| **Hombres** | $\ge 60$ años | $13.0\% - 25.0\%$ |
| **Mujeres** | $< 40$ años | $21.0\% - 33.0\%$ |
| **Mujeres** | $40 - 59$ años | $23.0\% - 34.0\%$ |
| **Mujeres** | $\ge 60$ años | $24.0\% - 36.0\%$ |

#### 3. Rango de Masa Libre de Grasa (`fatFreeMassMinKg` - `fatFreeMassMaxKg`)
**Método único**, derivado del rango de peso normal y de los porcentajes límite de grasa:

$$\text{FFM Min} = \text{Peso Normal Min} \times (1 - \text{Grasa Max} / 100), \quad \text{FFM Max} = \text{Peso Normal Max} \times (1 - \text{Grasa Min} / 100)$$

*Ejemplo*: Varón de 187 cm (peso normal 64.7 - 87.1 kg, grasa 8.0 - 20.0%) $\rightarrow [64.7 \times 0.80, 87.1 \times 0.92] = [51.8\text{ kg}, 80.1\text{ kg}]$.

> La derivación alternativa desde la masa ósea del propio paciente ($\text{FFM} = \text{Masa Ósea} / 0.050$ a $/ 0.044$ en varones, $/ 0.055$ a $/ 0.045$ en mujeres) **se eliminó**. Era circular —deducía la masa magra *deseable* del mineral óseo *actual*, de modo que un paciente con poco hueso recibía un objetivo bajo—, incompatible con el rango de peso —daba un máximo de 90.9 kg frente a un peso máximo saludable de 87.1 kg— y hacía que el rango saltase casi 30 kg según el nutricionista hubiera tecleado o no la masa ósea ese día. La masa ósea se evalúa aparte, en `boneMassMinKg` / `boneMassMaxKg` y en `global.boneComposition`.

#### 4. Rango de Agua Corporal (`waterMassMinKg` - `waterMassMaxKg`)
Calculado a partir de la fracción de hidratación fisiológica estándar del tejido magro ($62\%$ a $70\%$ de la masa libre de grasa de referencia):
- $\text{Agua Min} = \text{fatFreeMassMinKg} \times 0.62$
- $\text{Agua Max} = \text{fatFreeMassMaxKg} \times 0.70$
*Ejemplo*: Para FFM de 51.8 - 80.1 kg $\rightarrow [51.8 \times 0.62, 80.1 \times 0.70] = [32.1\text{ kg}, 56.1\text{ kg}]$.

#### 5. Rango de Masa Ósea Esperada (`boneMassMinKg` - `boneMassMaxKg`)
Reutiliza los rangos normativos de bioimpedancia según el peso actual y sexo biológico:
- **Mujeres**: $<50\text{ kg} \rightarrow [1.95, 2.40\text{ kg}]$; $50-75\text{ kg} \rightarrow [2.40, 2.95\text{ kg}]$; $>75\text{ kg} \rightarrow [2.95, 3.60\text{ kg}]$
- **Hombres**: $<65\text{ kg} \rightarrow [2.65, 3.15\text{ kg}]$; $65-95\text{ kg} \rightarrow [3.15, 3.65\text{ kg}]$; $>95\text{ kg} \rightarrow [3.65, 4.50\text{ kg}]$

---

### 5.6. Clasificación del % de Grasa Corporal (`BodyFatClassification`)

Clasifica el `bodyFatPct` de la báscula frente al rango saludable personalizado (`fatMassPctMin` - `fatMassPctMax`, calculado por sexo y edad en §5.5.2). Los grados de obesidad se determinan de forma **incremental y fija** sobre el límite superior del rango saludable (`max`):

| Condición | `bodyFatClassification` | Descripción (es) |
|---|---|---|
| `bodyFatPct < min` | `LOW` | Bajo |
| `min ≤ bodyFatPct ≤ max` | `NORMAL` | Normal |
| `max < bodyFatPct ≤ max + 5` | `OVERWEIGHT` | Sobrepeso |
| `max + 5 < bodyFatPct ≤ max + 10` | `OBESE_CLASS_I` | Obesidad grado I |
| `max + 10 < bodyFatPct ≤ max + 15` | `OBESE_CLASS_II` | Obesidad grado II |
| `bodyFatPct > max + 15` | `OBESE_CLASS_III` | Obesidad grado III |

*Ejemplo*: Varón < 40 años (rango 8.0 - 20.0%): `18.2%` → `NORMAL`; `22.0%` → `OVERWEIGHT`; `27.0%` → `OBESE_CLASS_I`; `32.0%` → `OBESE_CLASS_II`; `40.0%` → `OBESE_CLASS_III`.

El primer tramo por exceso es **sobrepeso**, no obesidad: un exceso de hasta 5 puntos sobre el máximo saludable no es obesidad y etiquetarlo así contradecía el `bmiClassification` del mismo informe. El valor heredado `OBESE`, que ocupaba ese tramo, se sigue aceptando **al deserializar** informes cacheados y se mapea a `OVERWEIGHT`; la API nunca lo emite.

El resultado se expone en `global.bodyFatClassification` (código) y `global.localizedBodyFatClassification` (texto traducido). Si falta cualquier dato (grasa, mínimo o máximo), ambos son `null`.

### 5.7. Nivel de Grasa Visceral (`visceralFatLevel`)

Valor entero (1-59) reportado directamente por la báscula (VFL, *Visceral Fat Level*). Se persiste en `body_measurement.visceral_fat_level` y se propaga al reporte en `global.visceralFatLevel`. Es opcional. No dispone de clasificación clínica propia en esta versión.

**No se estima.** La estimación por ratio cintura/altura (`VFL = clamp(round((WHtR − 0.40) × 100), 1, 59)`) se eliminó: no corresponde a ningún estándar reconocido, ignora peso, sexo y edad, y al no distinguirse del valor medido producía saltos imposibles en la evolución del paciente.

Cuando la medición no trae el valor se hereda el último conocido del paciente (§5.8). Si tampoco lo hay, queda `null`.

### 5.8. Procedencia de los valores (`MeasurementSource`)

Masa ósea y grasa visceral no se recogen en todas las visitas. Cuando faltan se hereda el último valor conocido del paciente en lugar de dejar el informe sin evaluar, y el informe **declara de dónde sale cada valor** para que el arrastre no se confunda con una lectura del día.

| Valor | Significado |
|---|---|
| `MEASURED` | Medido en esta toma. |
| `CARRIED_FORWARD` | Heredado de una medición anterior del paciente (o de su perfil). |
| `ESTIMATED` | Derivado por reparto anatómico (solo en `totalMassSource` de los segmentos). |
| `NOT_AVAILABLE` | Sin dato; el valor asociado es `null`. |

Orden de resolución, para masa ósea y grasa visceral:

1. Valor de la propia medición → `MEASURED`.
2. Medición anterior más reciente que lo tenga, buscando hacia atrás por `measuredAt` → `CARRIED_FORWARD` + fecha de origen.
3. Solo masa ósea: `UserTenantProfile.boneMassKg` → `CARRIED_FORWARD` sin fecha (el perfil no la guarda).
4. Nada → `NOT_AVAILABLE`.

El arrastre va **hacia delante en el tiempo**: una medición no hereda valores de otra posterior.

Campos expuestos:

| Campo | Dónde |
|---|---|
| `visceralFatSource` / `visceralFatCarriedFrom` | `global` |
| `source` / `carriedFrom` | `global.boneComposition` |
| `totalMassSource` | cada entrada de `segmentalAnalysis` |

El histórico necesario se resuelve con **una sola consulta por petición** (`BodyMeasurementRepository.findCarryForwardHistory`), no una por medición, para que el listado paginado no degenere en N+1.

### 5.9. Segmentos y simetría: solo con datos reales

- Un segmento **sin `fatPct` propio se omite** de `segmentalAnalysis`, que puede llegar vacío o incompleto. Antes heredaba el `bodyFatPct` global, produciendo cinco zonas con el mismo número que aparentaban una medición segmental real.
- `totalMassSource` distingue la masa medida por la báscula (`MEASURED`) de la repartida por factor anatómico (`ESTIMATED`).
- **La simetría compara dos cosas distintas**, con requisitos distintos:
  - **% de grasa** (`rightFatPct`, `leftFatPct`, `fatPctDiffPoints`, `fatPctAlert`): basta con que ambos lados tengan lectura de porcentaje. Se expresa en *puntos porcentuales*. Una diferencia marcada entre lados es una señal clínica legítima, o un error de medición que conviene revisar.
  - **Masa magra** (`leanMassComparable`, `rightLeanMassKg`, `leftLeanMassKg`, `leanMassDiffKg`, `leanMassDiffPct`, `leanMassAlert`): solo si la masa de *ambos* segmentos está medida. Con masa repartida los dos lados pesan lo mismo por construcción, así que la diferencia sería solo la del % de grasa reescalada. Cuando no es comparable, esos campos son `null`.
  - `asymmetricAlert` es el OR de ambas alertas y `localizedObservation` nombra la magnitud que la disparó (`symmetry.alert_fat_pct`, `symmetry.alert`, `symmetry.alert_both` o `symmetry.normal`).
  - Umbrales: `fatPctThresholdPoints` (5.0 puntos por defecto, cribado pragmático, no estándar publicado) y `thresholdPct` (5.0 % para la masa magra).
- **`symmetry` es `null`** si ningún par tiene % de grasa en ambos lados. `upperLimbs` y `lowerLimbs` son anulables por separado.
- Los factores de reparto cubren el **92 %** del peso (tronco 50 %, brazos 5 % cada uno, piernas 16 % cada una); el 8 % restante es cabeza y cuello. Por eso la suma de los segmentos no iguala ni el peso total ni `global.fatMassKg`.

---

## 6. Internacionalización (i18n)

El informe se traduce automáticamente en función del campo `language` configurado en el usuario (`"es"` o `"en"`). Si el usuario no tiene idioma especificado, se utiliza español por defecto (`"es"`).

Las claves de mensajes traducen:
- Clasificaciones de IMC (`localizedBmiClassification`).
- Clasificaciones de % de grasa corporal (`localizedBodyFatClassification`, familias `body_fat.*`).
- Descripciones de complexión de Grant (`localizedDescription`).
- Diagnósticos de masa ósea (`localizedDescription`).
- Nombres de segmentos corporales (`localizedSegmentName`).
- Observaciones clínicas de simetría bilateral (`localizedObservation`).

