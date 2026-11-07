# Cambios API — Composición corporal v2 (procedencia de datos y revisión de cálculos)

> **Para:** equipo de Frontend (app Flutter / clientes de la API)
> **Ámbito:** `bodyCompositionReport` en todos los endpoints de mediciones y en el perfil del paciente
> **Migrations:** ninguna. No hay cambios de esquema.
> **Documento anterior:** [`cambios-composicion-corporal-frontend.md`](cambios-composicion-corporal-frontend.md)

---

## Por qué este cambio

El informe rellenaba en silencio los huecos que dejaba el nutricionista: estimaba la grasa visceral con una fórmula de cintura/altura, copiaba el % de grasa global a los cinco segmentos, y derivaba los rangos de masa libre de grasa por dos métodos distintos según hubiera masa ósea o no. El resultado era un informe donde **no se distinguía lo medido de lo inventado**, con saltos imposibles en la evolución del paciente (grasa visceral de 19 a 8 en tres semanas sin que cambiase la cintura) y alertas clínicas de asimetría sobre datos que nunca se midieron.

Ahora cada valor del informe **declara de dónde sale**, y lo que no se puede saber viene `null` en lugar de estimado.

---

## TL;DR (resumen ejecutivo)

| Cambio | Tipo | Impacto en frontend |
|---|---|---|
| `bodyFatClassification`: **`OBESE` ya no existe**, se llama `OVERWEIGHT` | ⚠️ **BREAKING** | Si hay un `switch`/`enum` sobre este valor, un `OBESE` dejará de llegar y `OVERWEIGHT` es nuevo. |
| Etiquetas de `localizedBodyFatClassification` renombradas | ⚠️ **BREAKING** si se comparan textos | "Obesidad 1" → "Obesidad grado I"; "Normo" → "Normal". No comparar por texto. |
| **`symmetry` reestructurado**: compara % de grasa *y* masa magra por separado | ⚠️ **BREAKING** | `diffKg` / `diffPct` ya no existen. Ver §2. |
| **`symmetry` puede venir `null`** (y `upperLimbs` / `lowerLimbs` por separado) | ⚠️ **BREAKING** | Acceder sin comprobar `null` **revienta**. |
| **`segmentalAnalysis` puede venir vacío `{}`** o con menos de 5 claves | ⚠️ **BREAKING** | No asumir que existen las 5 zonas. |
| `visceralFatLevel` ya **no se estima** | ⚠️ Cambio de comportamiento | Donde antes llegaba un número estimado, ahora llega `null`. |
| Rangos de referencia de masa libre de grasa y agua: **valores distintos** | ⚠️ Cambio de valores | Mismo contrato, pero las barras/umbrales se mueven. |
| `global.visceralFatSource` + `visceralFatCarriedFrom` | ✅ Aditivo | Procedencia del VFL. |
| `global.boneComposition.source` + `carriedFrom` | ✅ Aditivo | Procedencia de la masa ósea. |
| `segmentalAnalysis.*.totalMassSource` | ✅ Aditivo | Si la masa del segmento está medida o repartida. |
| **Reglas de representación** del análisis segmental | 📐 Guía | Cuatro fallos ya detectados al pintar esta pantalla. Ver §8. |

**Nada cambia en los requests.** Todos los campos de `POST /measurements` siguen igual y siguen siendo opcionales.

---

## 1. Procedencia: el enum `MeasurementSource`

Aparece en tres sitios nuevos del informe. Valores posibles:

| Valor | Significado | Cómo pintarlo |
|---|---|---|
| `MEASURED` | Medido en esta toma, por la báscula o tecleado por el nutricionista. | Normal. |
| `CARRIED_FORWARD` | **Último valor conocido del paciente**, heredado de una medición anterior porque esta no lo traía. | Atenuado / icono de "heredado" + fecha de origen en el tooltip. |
| `ESTIMATED` | Derivado por reparto anatómico (solo en `totalMassSource` de los segmentos). | Atenuado. |
| `NOT_AVAILABLE` | No hay dato y no se inventa. El valor asociado es `null`. | Guion o "sin datos". |

### 1.1. Grasa visceral

```jsonc
"global": {
  "visceralFatLevel": 8,
  "visceralFatSource": "CARRIED_FORWARD",
  "visceralFatCarriedFrom": "2026-10-09T10:07:00Z"   // null si viene del perfil o si es MEASURED
}
```

### 1.2. Masa ósea

```jsonc
"global": {
  "boneComposition": {
    "boneMassKg": 4.00,
    "boneMassPctOfWeight": 4.0,
    "evaluation": "NORMAL",
    "localizedDescription": "Masa ósea dentro de rangos normales",
    "source": "CARRIED_FORWARD",      // ← nuevo
    "carriedFrom": "2026-10-09T10:07:00Z"  // ← nuevo
  }
}
```

`carriedFrom` es `null` cuando el valor se hereda del **perfil del paciente** (`UserTenantProfile.boneMassKg`), que no guarda la fecha de la lectura.

### 1.3. Cómo se resuelve el arrastre

Para masa ósea y grasa visceral, por este orden:

1. El valor de la propia medición → `MEASURED`.
2. La medición **anterior más reciente** que sí lo tenga, buscando hacia atrás por `measuredAt` → `CARRIED_FORWARD` + fecha.
3. Solo para masa ósea: el perfil del paciente → `CARRIED_FORWARD` sin fecha.
4. Nada → `NOT_AVAILABLE` y valor `null`.

El arrastre va **hacia delante en el tiempo**: una medición de febrero no hereda un valor de octubre. Si el paciente nunca tuvo el dato antes de esa fecha, llega `null`.

> ⚠️ El campo `visceralFatLevel` **de la raíz de `BodyMeasurementDto`** sigue siendo el dato crudo de la fila (`null` donde no se midió). El que lleva el arrastre es el de `bodyCompositionReport.global`. Si la pantalla lee el de la raíz, verá `null` donde el informe muestra un valor.

---

## 2. `symmetry`: dos comparaciones distintas (BREAKING)

El bloque se ha reestructurado. Antes exponía una sola comparación —`diffKg` / `diffPct` de masa magra— y solo aparecía si la báscula daba la masa de cada segmento. Ahora distingue dos cosas con requisitos distintos:

| Comparación | Requiere | Campos |
|---|---|---|
| **% de grasa**, en *puntos porcentuales* | Solo el `fatPct` de ambos lados | `rightFatPct`, `leftFatPct`, `fatPctDiffPoints`, `fatPctAlert` |
| **Masa magra**, en kg y % | La masa medida (`totalMassSource == MEASURED`) en **ambos** lados | `leanMassComparable`, `rightLeanMassKg`, `leftLeanMassKg`, `leanMassDiffKg`, `leanMassDiffPct`, `leanMassAlert` |

`asymmetricAlert` es el OR de las dos alertas, y `localizedObservation` nombra la magnitud que disparó cada una, para que no se atribuya a la masa magra una diferencia que es solo de grasa.

**Cuando `leanMassComparable` es `false`, los cinco campos de masa magra son `null`.** Comparar masa magra con masas repartidas por factor anatómico no tiene sentido: ambos lados pesan lo mismo por construcción y la diferencia sería la del % de grasa reescalada.

```jsonc
// Con % de grasa en ambos lados pero SIN masa medida — el caso habitual
"symmetry": {
  "upperLimbs": {
    "extremityType": "Extremidades Superiores (Brazos)",
    "rightFatPct": 29.9,
    "leftFatPct": 31.5,
    "fatPctDiffPoints": 1.6,
    "fatPctAlert": false,
    "leanMassComparable": false,
    "rightLeanMassKg": null, "leftLeanMassKg": null,
    "leanMassDiffKg": null,  "leanMassDiffPct": null,
    "leanMassAlert": false,
    "asymmetricAlert": false,
    "localizedObservation": "Simetría normal dentro del margen clínico"
  },
  "lowerLimbs": {
    "extremityType": "Extremidades Inferiores (Piernas)",
    "rightFatPct": 20.0,
    "leftFatPct": 8.8,
    "fatPctDiffPoints": 11.2,
    "fatPctAlert": true,
    "leanMassComparable": false,
    "rightLeanMassKg": null, "leftLeanMassKg": null,
    "leanMassDiffKg": null,  "leanMassDiffPct": null,
    "leanMassAlert": false,
    "asymmetricAlert": true,
    "localizedObservation": "Diferencia de grasa (11.2 puntos) supera el umbral clínico de 5.0 puntos"
  },
  "thresholdPct": 5.0,
  "fatPctThresholdPoints": 5.0,
  "hasAnyAsymmetryAlert": true
}
```

### 2.1. Cuándo sigue siendo `null`

`symmetry` es `null` si **ningún** par tiene `fatPct` en los dos lados, y `upperLimbs` / `lowerLimbs` son `null` individualmente si ese par concreto no lo tiene. Sigue habiendo que comprobar `null` en tres niveles.

```dart
final symmetry = report.symmetry;
if (symmetry == null) {
  return const SinDatosSimetria();   // "Requiere % de grasa por segmento"
}
final arms = symmetry.upperLimbs;    // puede seguir siendo null
if (arms != null && !arms.leanMassComparable) {
  // pintar solo la fila de grasa; la de masa magra no aplica
}
```

### 2.2. Umbrales

- `fatPctThresholdPoints` (por defecto **5.0 puntos porcentuales**) para la grasa.
- `thresholdPct` (por defecto **5.0 %**) para la masa magra, como antes.

El umbral de grasa es de **cribado, no un estándar clínico publicado**: en bioimpedancia la diferencia contralateral habitual se mueve en 2-3 puntos, así que 5 marca lo que merece una segunda lectura (incluido un posible error de medición) sin inundar de alertas. Está en `BodyCompositionCalculatorService.DEFAULT_FAT_PCT_ASYMMETRY_THRESHOLD_POINTS`; decidnos si lo queréis en otro valor.

## 3. `segmentalAnalysis` puede estar vacío o incompleto (BREAKING)

Antes, un segmento sin `fatPct` propio heredaba el `bodyFatPct` global. Eso producía cinco zonas con el mismo número, indistinguibles de una medición segmental real:

```jsonc
// ANTES — todo 28.8, que es el % global: no se midió ningún segmento
"segmentalAnalysis": {
  "TRUNK":     { "fatPct": 28.8, "...": "..." },
  "RIGHT_ARM": { "fatPct": 28.8, "...": "..." },
  "LEFT_ARM":  { "fatPct": 28.8, "...": "..." },
  "RIGHT_LEG": { "fatPct": 28.8, "...": "..." },
  "LEFT_LEG":  { "fatPct": 28.8, "...": "..." }
}

// AHORA — ningún segmento medido
"segmentalAnalysis": {}
```

Solo aparecen las zonas con `fatPct` propio. Puede haber 0, 1, 2… hasta 5 claves. Iterar sobre lo que venga, no sobre `BodySegment.values`.

### 3.1. `totalMassSource` por segmento

```jsonc
"TRUNK": {
  "segment": "TRUNK",
  "localizedSegmentName": "Tronco / Torso",
  "fatPct": 25.1,
  "totalMassKg": 50.25,
  "fatMassKg": 12.61,
  "leanMassKg": 37.64,
  "totalMassSource": "ESTIMATED"   // ← nuevo: la masa sale del reparto anatómico, no de la báscula
}
```

- `MEASURED`: la báscula reportó `trunkMassKg` / `rightArmMassKg` / … para esa zona.
- `ESTIMATED`: `totalMassKg` = peso corporal × factor anatómico del segmento.

### 3.2. Los segmentos no suman el peso total

Los factores de reparto cubren el **92 %** del peso (tronco 50 %, cada brazo 5 %, cada pierna 16 %). El 8 % restante es cabeza y cuello, que no se reparte. Consecuencia:

```
Σ totalMassKg segmentos ≈ 0.92 × peso        (ej.: 92.65 kg sobre 100.7 kg)
Σ fatMassKg  segmentos  <  global.fatMassKg  (ej.: 26.68 kg frente a 29.00 kg)
```

**No cuadrar las columnas con los totales globales.** Si la pantalla muestra una suma, o se etiqueta como "extremidades y tronco (92 % del peso)" o se omite.

---

## 4. `bodyFatClassification`: nuevo tramo de sobrepeso (BREAKING)

El primer tramo por exceso se llamaba `OBESE` ("Obesidad") y el siguiente `OBESE_CLASS_I` ("Obesidad 1"), de modo que *"Obesidad"* era **menos grave** que *"Obesidad 1"*. Además etiquetaba como obesidad un 22 % de grasa en varón, contradiciendo el `bmiClassification` del mismo informe, que decía "Sobrepeso".

| Condición (sobre el máximo saludable `max`) | Antes | **Ahora** | Descripción (es) |
|---|---|---|---|
| `bodyFatPct < min` | `LOW` | `LOW` | Bajo |
| `min ≤ bodyFatPct ≤ max` | `NORMAL` | `NORMAL` | **Normal** (antes "Normo") |
| `max < x ≤ max + 5` | ~~`OBESE`~~ | **`OVERWEIGHT`** | **Sobrepeso** |
| `max + 5 < x ≤ max + 10` | `OBESE_CLASS_I` | `OBESE_CLASS_I` | **Obesidad grado I** (antes "Obesidad 1") |
| `max + 10 < x ≤ max + 15` | `OBESE_CLASS_II` | `OBESE_CLASS_II` | **Obesidad grado II** |
| `x > max + 15` | `OBESE_CLASS_III` | `OBESE_CLASS_III` | **Obesidad grado III** |

Ejemplo real: un varón de 31 años con 22.2 % de grasa pasa de `OBESE` ("Obesidad") a `OVERWEIGHT` ("Sobrepeso").

> **Compatibilidad de informes cacheados:** el backend sigue leyendo el valor `OBESE` de los informes ya guardados en `user_tenant_profile.body_composition_report` y lo mapea a `OVERWEIGHT` al deserializar. Por eso no hizo falta migración. La API **nunca** vuelve a emitir `OBESE`.

> Si el enum de Dart está generado con `@JsonValue`, añadir `OVERWEIGHT` y dejar un *fallback* para valores desconocidos, para que un enum nuevo no rompa el parseo.

---

## 5. La grasa visceral ya no se estima

Se ha eliminado la estimación `VFL = round((cintura/altura − 0.40) × 100)`. No corresponde a ningún estándar (ni Tanita ni Omron), ignoraba peso, sexo y edad, y sobre todo **se mezclaba con los valores reales en la misma serie temporal**.

Efecto sobre un paciente real (misma cintura de 111 cm en las tres últimas visitas):

| Fecha | VFL introducido | Antes (informe) | **Ahora (informe)** |
|---|---|---|---|
| 2026-02-07 | — | 18 *(estimado)* | `null` · `NOT_AVAILABLE` |
| 2026-09-15 | — | 19 *(estimado)* | `null` · `NOT_AVAILABLE` |
| 2026-10-06 | **8** | 8 | `8` · `MEASURED` |
| 2026-10-09 | **8** | 8 | `8` · `MEASURED` |

La gráfica de grasa visceral pasa de mostrar un descenso imposible de 19 a 8 en tres semanas, a mostrar dos puntos reales. **Las series deben saltar los `null`, no interpolarlos ni pintarlos como 0.**

---

## 6. Rangos de referencia: la masa ósea ya no los mueve

`referenceRanges.fatFreeMassMinKg` / `MaxKg` (y los de agua, que se derivan de ellos) se calculaban por dos métodos incompatibles según hubiera masa ósea o no. Para el mismo paciente con 100 g de diferencia de peso daban rangos separados por 28 kg, y el máximo de masa magra (90.9 kg) superaba el peso máximo saludable (87.1 kg): un objetivo imposible.

Ahora hay **un solo método**, derivado del peso normal y del % de grasa saludable:

```
fatFreeMassMinKg = normalWeightMinKg × (1 − fatMassPctMax/100)
fatFreeMassMaxKg = normalWeightMaxKg × (1 − fatMassPctMin/100)
waterMassMinKg   = fatFreeMassMinKg × 0.62
waterMassMaxKg   = fatFreeMassMaxKg × 0.70
```

| Varón 31 a., 187 cm | Antes (con masa ósea 4.0) | Antes (sin masa ósea) | **Ahora (siempre)** |
|---|---|---|---|
| Masa libre de grasa | 80.0 – 90.9 kg | 51.8 – 80.1 kg | **51.8 – 80.1 kg** |
| Agua corporal | 49.6 – 63.6 kg | 32.1 – 56.1 kg | **32.1 – 56.1 kg** |

El contrato no cambia, pero **los valores sí**: cualquier barra de progreso, umbral o color basado en estos rangos se moverá, y el mismo paciente puede pasar de "por debajo del rango" a "dentro del rango" sin haber cambiado de peso. La masa ósea se sigue evaluando aparte, en `referenceRanges.boneMassMinKg` / `MaxKg` y en `global.boneComposition`.

---

## 7. Ejemplo completo: antes / después

Mismo registro (varón, 31 a., 187 cm, 100.7 kg, 28.8 % grasa, VFL 8, masa ósea 4.0, **sin datos segmentales**):

```jsonc
// ───────── ANTES ─────────
{
  "global": {
    "bodyFatClassification": "OBESE_CLASS_I",
    "localizedBodyFatClassification": "Obesidad 1",
    "visceralFatLevel": 8,
    "boneComposition": { "boneMassKg": 4, "evaluation": "NORMAL" }
  },
  "segmentalAnalysis": {
    "TRUNK":     { "fatPct": 28.8, "totalMassKg": 50.35, "leanMassKg": 35.85 },
    "RIGHT_ARM": { "fatPct": 28.8, "totalMassKg": 5.04,  "leanMassKg": 3.59  },
    "LEFT_ARM":  { "fatPct": 28.8, "totalMassKg": 5.04,  "leanMassKg": 3.59  },
    "RIGHT_LEG": { "fatPct": 28.8, "totalMassKg": 16.11, "leanMassKg": 11.47 },
    "LEFT_LEG":  { "fatPct": 28.8, "totalMassKg": 16.11, "leanMassKg": 11.47 }
  },
  "symmetry": {
    "upperLimbs": { "diffPct": 0, "asymmetricAlert": false,
                    "localizedObservation": "Simetría normal dentro del margen clínico" },
    "lowerLimbs": { "diffPct": 0, "asymmetricAlert": false, "...": "..." },
    "thresholdPct": 5,
    "hasAnyAsymmetryAlert": false
  },
  "referenceRanges": { "fatFreeMassMinKg": 80.0, "fatFreeMassMaxKg": 90.9,
                       "waterMassMinKg": 49.6,  "waterMassMaxKg": 63.6 }
}

// ───────── AHORA ─────────
{
  "global": {
    "bodyFatClassification": "OBESE_CLASS_I",
    "localizedBodyFatClassification": "Obesidad grado I",
    "visceralFatLevel": 8,
    "visceralFatSource": "MEASURED",
    "visceralFatCarriedFrom": null,
    "boneComposition": {
      "boneMassKg": 4,
      "evaluation": "NORMAL",
      "source": "MEASURED",
      "carriedFrom": null
    }
  },
  "segmentalAnalysis": {},
  "symmetry": null,   // sin % de grasa por segmento no hay nada que comparar
  "referenceRanges": { "fatFreeMassMinKg": 51.8, "fatFreeMassMaxKg": 80.1,
                       "waterMassMinKg": 32.1,  "waterMassMaxKg": 56.1 }
}
```

---

## 8. Reglas de representación del análisis segmental

Esta sección recoge cuatro fallos detectados en la primera integración de la pantalla «Análisis segmental». Los datos de la API eran correctos; lo que fallaba era cómo se pintaban.

### 8.1. Una sola magnitud por barra

**El fallo:** la longitud de la barra estaba escalada por los **kg**, mientras el número destacado era el **%**. Con esto:

| Fila | Número mostrado | Barra | `leanMassKg` |
|---|---|---|---|
| Tronco | 68.5 % — el más **bajo** | **llena** | 34.25 |
| Brazo Derecho | 70.1 % | ~10 % | 3.50 |
| Pierna Izquierda | 91.2 % — el más **alto** | ~43 % | 14.59 |

La barra y el número cuentan historias opuestas en la misma fila.

**La regla:** si la barra representa kg, el valor destacado es kg y el % va como dato secundario (o al revés), pero nunca una magnitud en la barra y otra en el número.

### 8.2. No derivar un «% de masa magra»

El backend **no envía** ningún porcentaje de masa magra. Si se calcula como `100 − fatPct` se obtiene el complemento exacto del dato de la otra pestaña: las dos vistas acaban mostrando el mismo número dos veces.

Y además **invierte la lectura clínica**: la pierna con 8.8 % de grasa —la lectura anómala que dispara la alerta— aparece como «91.2 % de masa magra», el valor más alto de la tabla. El segmento sospechoso parece el mejor del cuerpo.

Para la vista de masa magra, usar `leanMassKg` y dejar el porcentaje fuera.

### 8.3. La alerta del par se pinta en todas las vistas

**El fallo:** en la pestaña de grasa las piernas salían en rojo con «Asimetría 11.2 p.»; al cambiar a masa magra pasaban a gris con «Magra no comparable». Mismo paciente y mismo dato, dos veredictos opuestos, y el hallazgo desaparecía al cambiar de pestaña.

Ocurre al mapear `leanMassComparable: false` a «sin comparación» y dejar que eso sustituya al estado del par.

**La regla:** son dos ejes independientes.

| Dato | Qué significa | Dónde se pinta |
|---|---|---|
| `symmetry.<par>.fatPctAlert` | Hay asimetría de grasa en ese par | En **todas** las vistas del par |
| `leanMassComparable: false` | *Esta métrica concreta* no se puede comparar | Solo en la fila de masa magra |

Que la masa magra no sea comparable no anula la alerta de grasa: la silencia solo para la masa magra.

### 8.4. Los porcentajes no son comparables entre segmentos

Cada `fatPct` lo es respecto a la masa de **su** segmento: el 70.1 % del brazo es sobre 5 kg y el 68.5 % del tronco sobre 50 kg. Pintarlos como barras de la misma escala invita a compararlos, y esa comparación no significa nada.

Los porcentajes solo son comparables **entre lados del mismo par** (derecha contra izquierda), que es exactamente lo que hace `symmetry`.

### 8.5. El texto de cabecera debe distinguir qué se midió

Un subtítulo del tipo *«según lo medido por la báscula»* contradice la etiqueta «Estimada» de cada fila. Los **porcentajes** sí proceden de la medición; los **kg** de las zonas marcadas como estimadas salen del reparto anatómico (§3.1 y §3.2).

### 8.6. Una comprobación rápida de los datos

Si el nutricionista detecta que «no cuadra», conviene contrastar el global con los segmentos antes de buscar un error de la API:

```
Σ grasa segmental = 15.75 + 1.50 + 1.58 + 3.20 + 1.41 = 23.44 kg sobre 92 kg → 25.5 %
Global bodyFatPct = 28 % → 28.00 kg
```

Una diferencia así no es un fallo de cálculo —el backend multiplica los porcentajes que recibe— sino una señal de que las lecturas segmentales y la global no concuerdan: báscula sin calibrar, o una lectura segmental mala. En este ejemplo, el 8.8 % de la pierna izquierda es justo lo que la alerta de asimetría está señalando.

---

## 9. Checklist de integración

- [ ] `symmetry`, `symmetry.upperLimbs` y `symmetry.lowerLimbs` tratados como anulables.
- [ ] Sustituidos `diffKg` / `diffPct` por `fatPctDiffPoints` y `leanMassDiffKg` / `leanMassDiffPct`.
- [ ] Cuando `leanMassComparable == false` se oculta **solo la fila de masa magra** (sus campos son `null`), no el estado del par.
- [ ] La diferencia de grasa se muestra en **puntos porcentuales**, no en `%` de variación.
- [ ] `segmentalAnalysis` iterado sobre las claves presentes, nunca sobre las 5 fijas. Estado vacío contemplado.
- [ ] Enum de clasificación de grasa: añadido `OVERWEIGHT`, retirado `OBESE`, con *fallback* para valores desconocidos.
- [ ] Nada compara `localizedBodyFatClassification` por texto.
- [ ] Series temporales de grasa visceral: los `null` se saltan, no se pintan como 0 ni se interpolan.
- [ ] Valores con `source == "CARRIED_FORWARD"` diferenciados visualmente, con `carriedFrom` en el tooltip (y texto alternativo cuando es `null`, es decir, cuando viene del perfil).
- [ ] `totalMassSource == "ESTIMATED"` diferenciado del medido en la tabla segmental.
- [ ] Revisado si alguna pantalla lee `visceralFatLevel` de la raíz del DTO en lugar del informe.
- [ ] Barras y umbrales de masa libre de grasa / agua revisados con los rangos nuevos.
- [ ] Ninguna pantalla suma los segmentos y los compara con el peso o la grasa total.
- [ ] Cada barra del análisis segmental usa la misma magnitud que su número destacado (§8.1).
- [ ] No se deriva ningún «% de masa magra» a partir de `100 − fatPct` (§8.2).
- [ ] La alerta `fatPctAlert` del par se pinta también en la vista de masa magra (§8.3).
- [ ] Los textos de cabecera no afirman que los kg estén medidos cuando son estimados (§8.5).

---

## 10. Qué **no** ha cambiado

- Rutas, permisos y códigos de error: idénticos.
- Payload de `POST /measurements`: idéntico, mismos campos opcionales.
- `MeasurementHistoryDto` (`/measurements/evolution`): sin cambios, devuelve los valores crudos de cada fila sin informe ni arrastre.
- `bmi`, `bmiClassification`, `fatMassKg`, `fatFreeMassKg`, `waterMassKg`, `bodyFrame`, `boneMassMinKg` / `MaxKg`: misma fórmula y mismos valores.
- El PDF de composición corporal (`/measurements/pdf`) ya contemplaba los huecos y sigue funcionando; donde no hay datos imprime "Sin datos".
