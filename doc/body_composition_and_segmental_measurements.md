# Composición Corporal, Complexión Física y Análisis Segmental

## Resumen

Se ha integrado en el backend de *Tus Dietas* un motor clínico de evaluación de bioimpedancia segmental (tipo Tanita / InBody), complexión física (índice de Grant), evaluación de masa ósea y análisis de asimetría lateral bilateral, con persistencia en el perfil clínico del usuario e internacionalización (i18n) completa en español e inglés.

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
    "muscleMassKg": 38.0,
    "bodyWaterPct": 55.0,
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

A continuación se muestra el esquema exacto devuelto por `POST .../calculate-composition`, en `user_tenant_profile.bodyCompositionReport` y en `body_measurement.bodyCompositionReport`:

```json
{
  "patient": {
    "gender": "MALE",
    "ageYears": 35,
    "heightCm": 170.0,
    "weightKg": 75.5,
    "wristCircumferenceCm": 17.5
  },
  "global": {
    "bmi": 26.1,
    "bmiClassification": "OVERWEIGHT",
    "localizedBmiClassification": "Sobrepeso",
    "fatMassKg": 13.59,
    "fatFreeMassKg": 61.91,
    "waterMassKg": 41.53,
    "boneComposition": {
      "boneMassKg": 3.20,
      "boneMassPctOfWeight": 4.24,
      "evaluation": "NORMAL",
      "localizedDescription": "Masa ósea adecuada para el rango de peso y sexo"
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
      "leanMassKg": 30.58
    },
    "RIGHT_ARM": {
      "segment": "RIGHT_ARM",
      "localizedSegmentName": "Brazo Derecho",
      "fatPct": 15.0,
      "totalMassKg": 4.15,
      "fatMassKg": 0.62,
      "leanMassKg": 3.53
    },
    "LEFT_ARM": {
      "segment": "LEFT_ARM",
      "localizedSegmentName": "Brazo Izquierdo",
      "fatPct": 15.5,
      "totalMassKg": 4.15,
      "fatMassKg": 0.64,
      "leanMassKg": 3.51
    },
    "RIGHT_LEG": {
      "segment": "RIGHT_LEG",
      "localizedSegmentName": "Pierna Derecha",
      "fatPct": 17.0,
      "totalMassKg": 14.72,
      "fatMassKg": 2.50,
      "leanMassKg": 12.22
    },
    "LEFT_LEG": {
      "segment": "LEFT_LEG",
      "localizedSegmentName": "Pierna Izquierda",
      "fatPct": 17.2,
      "totalMassKg": 14.72,
      "fatMassKg": 2.53,
      "leanMassKg": 12.19
    }
  },
  "symmetry": {
    "upperLimbs": {
      "extremityType": "Brazos (Extremidades Superiores)",
      "rightLeanMassKg": 3.53,
      "leftLeanMassKg": 3.51,
      "diffKg": 0.02,
      "diffPct": 0.57,
      "asymmetricAlert": false,
      "localizedObservation": "Brazos: Asimetría normal (0.6% de diferencia)"
    },
    "lowerLimbs": {
      "extremityType": "Piernas (Extremidades Inferiores)",
      "rightLeanMassKg": 12.22,
      "leftLeanMassKg": 12.19,
      "diffKg": 0.03,
      "diffPct": 0.25,
      "asymmetricAlert": false,
      "localizedObservation": "Piernas: Asimetría normal (0.2% de diferencia)"
    },
    "thresholdPct": 5.0,
    "hasAnyAsymmetryAlert": false
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
Si la báscula segmental solo reporta porcentajes de grasa pero no las masas individuales por segmento (`trunkMassKg = null`, etc.), el motor aplica la distribución anatómica estándar respecto al peso total:
- **Tronco**: $50.0\%$ del peso total.
- **Brazo Derecho**: $5.5\%$ del peso total.
- **Brazo Izquierdo**: $5.5\%$ del peso total.
- **Pierna Derecha**: $19.5\%$ del peso total.
- **Pierna Izquierda**: $19.5\%$ del peso total.

### 5.4. Análisis de Simetría Lateral Bilateral
Calcula la diferencia de masa magra entre extremidades contralaterales:
$$\text{diffPct} = \frac{|\text{Masa Magra D} - \text{Masa Magra I}|}{\max(\text{Masa Magra D}, \text{Masa Magra I})} \times 100$$
- Si $\text{diffPct} > 5.0\%$, se activa `asymmetricAlert: true` y `hasAnyAsymmetryAlert: true` para alertar al nutricionista sobre posible atrofia, sobreuso unilateral o desbalance muscular.

---

## 6. Internacionalización (i18n)

El informe se traduce automáticamente en función del campo `language` configurado en el usuario (`"es"` o `"en"`). Si el usuario no tiene idioma especificado, se utiliza español por defecto (`"es"`).

Las claves de mensajes traducen:
- Clasificaciones de IMC (`localizedBmiClassification`).
- Descripciones de complexión de Grant (`localizedDescription`).
- Diagnósticos de masa ósea (`localizedDescription`).
- Nombres de segmentos corporales (`localizedSegmentName`).
- Observaciones clínicas de simetría bilateral (`localizedObservation`).

