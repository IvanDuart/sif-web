# Menús estructurados con BEDCA — guía de integración y UX

> **Para:** equipo de Frontend (app Flutter / clientes de la API)
> **Ámbito:** edición de menús y comidas, catálogo de alimentos, cálculo de macronutrientes
> **Migrations:** `V42__food_catalog_and_structured_meals.sql`, `V43__bedca_data.sql`
> **Estado:** implementado en backend. ⚠️ Las migraciones **aún no están aplicadas en ningún entorno**; coordinad la fecha antes de publicar la pantalla nueva.

---

## TL;DR (resumen ejecutivo)

| Cambio | Tipo | Impacto en frontend |
|---|---|---|
| `menu_creation_mode` en preferencias del tenant | ✅ Aditivo | Decide qué editor de comida pintar. Llega en el endpoint **público** de branding. |
| `items[]` en `Meal` y `MealTemplate` | ✅ Aditivo | Nueva lista de alimentos con gramaje. Vacía en los centros en modo texto. |
| `description` ahora **puede ser `null`** | ⚠️ Ojo | En la práctica el backend la sigue rellenando siempre, pero el modelo de Dart debe aceptar `null`. |
| `GET /food/search` | ✅ Nuevo | Buscador difuso: alimentos BEDCA + propios del centro + recetas. |
| `POST /food` | ✅ Nuevo | Crear un alimento propio sin salir del formulario. |
| `GET /menu/{id}/nutrition` | ✅ Nuevo | Totales de macros por comida, por día y del menú. |
| `POST /menu/{id}/copy-day` | ✅ Nuevo | Clonar un día completo en otro. |
| `PUT /meal/{id}` acepta `dayOfWeek` / `mealType` | ✅ Aditivo | Es el endpoint del *drag & drop*. |

> **Nada de esto rompe lo que ya existe.** Un cliente que siga enviando y leyendo sólo `description` funciona exactamente igual que hoy.

---

## 1. El objetivo, en una frase

Hasta ahora una comida era una frase suelta: *"Arroz con pollo y ensalada"*. El sistema no sabía
qué había dentro, así que no podía decir cuántas calorías tenía.

Ahora un centro puede elegir componer la comida **eligiendo alimentos de un catálogo con su
gramaje**, lo que permite mostrar calorías y macronutrientes en tiempo real. El centro que no
quiera eso sigue escribiendo texto libre, sin notar ningún cambio.

El objetivo de producto de la pantalla nueva es **velocidad de pautado**: el nutricionista tiene
al paciente delante y no puede pelearse con la interfaz. Todo lo que sigue está orientado a eso.

---

## 2. Qué modo tiene el centro

`GET /api/tenant/{tenantId}/branding` — **público, sin autenticación**, el mismo que ya usáis
para pintar el logo y el color antes del login.

```jsonc
{
  "name": "Clínica Ejemplo",
  "primaryColor": "#005ac2",
  "defaultLanguage": "es-ES",
  "logoUrl": "/api/tenant/…/branding/logo",
  "logoPdfUrl": "/api/tenant/…/branding/logo-pdf",
  "address": "Calle Ejemplo 1",
  "phone": "600000000",
  "aiEnabled": false,
  "menuCreationMode": "BEDCA"        // ← NUEVO: "MANUAL" | "BEDCA"
}
```

| Valor | Editor a pintar |
|---|---|
| `"MANUAL"` (por defecto) | El de siempre: un `TextField` multilínea para `description`. |
| `"BEDCA"` | El editor nuevo de alimentos + gramos descrito en la sección 4. |

**Cachead el valor** junto al resto del branding; no hace falta pedirlo en cada pantalla.

> El centro cambia el modo desde `PUT /api/tenant/{tenantId}/branding/preferences`
> (requiere `MANAGE_TENANT_BRANDING`). ⚠️ **Ese endpoint reemplaza el documento de preferencias
> entero, no hace merge**: si construís esa pantalla, leed las preferencias, modificad el campo
> y reenviadlas completas, o el resto de flags quedarán a `null`.

---

## 3. El contrato de una comida (idéntico en los dos modos)

Ésta es la pieza clave: **no hay dos DTOs**. `description` e `items` conviven en el mismo objeto,
en `POST` y en `PUT`.

### Request

```jsonc
// POST /api/tenant/{tenantId}/meal          (menuId obligatorio)
// PUT  /api/tenant/{tenantId}/meal/{mealId} (todos los campos opcionales)
{
  "menuId": "8f14e45f-…",           // sólo en POST
  "dayOfWeek": "LUNES",
  "mealType": "COMIDA",
  "description": "Arroz con pollo",  // modo MANUAL
  "items": [                          // modo BEDCA
    { "foodId": "5c089028-…", "quantityG": 80,  "notes": null,      "sortOrder": 0 },
    { "foodId": "a1b2c3d4-…", "quantityG": 120, "notes": "sin sal", "sortOrder": 1 }
  ]
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `dayOfWeek` | `string(20)` | Texto libre. La convención existente es `LUNES`…`DOMINGO`. **No cambiéis los valores que ya usáis.** |
| `mealType` | `string(20)` | Texto libre. La convención existente es `COMIDA` / `CENA` (desayuno y merienda viven en el perfil del paciente). |
| `description` | `string` \| `null` | Obligatoria **si no** mandáis `items`. |
| `items[].foodId` | `uuid` | Del buscador. Debe ser visible para el centro (BEDCA o propio). |
| `items[].quantityG` | `decimal(8,2)` | **> 0**. Gramos de porción comestible (lo que va al plato). |
| `items[].notes` | `string` \| `null` | Opcional. Se renderiza entre paréntesis. |
| `items[].sortOrder` | `integer` \| `null` | Si va `null`, el servidor usa la posición en el array. |

### Reglas que aplica el servidor

1. Si llegan `items`, se persisten **y `description` se rellena sola** con el texto renderizado:
   `"Arroz integral, hervido 80 g · Pollo, pechuga, plancha 120 g (sin sal)"`.
2. Si no llegan `items`, `description` es obligatoria.
3. Sin ninguna de las dos → **`400`**.
4. En un `PUT`, **`items` reemplaza la lista completa**: lo que no mandéis se borra.
5. El modo del centro **no bloquea** el guardado. Un centro que pasa a `BEDCA` puede seguir
   editando en texto los menús que ya tenía.

> **Por qué `description` se sigue rellenando:** de ella dependen el PDF del menú, la lista de la
> compra con IA y las versiones antiguas de la app. **No la mandéis vosotros cuando mandéis
> `items`** — el servidor la sobrescribe igualmente y vuestro texto se perdería.

**El separador entre ítems es `" · "` (espacio, punto medio U+00B7, espacio)**, no la coma. Es
deliberado: los nombres de BEDCA ya contienen comas (*"Pollo, pechuga, plancha"*), así que unir
con comas daría un texto en el que no se ve dónde acaba un alimento. Si en algún sitio mostráis
la `description` de una comida creada en modo BEDCA (por ejemplo en una app en modo `MANUAL`, o
en un listado compacto), contad con ese separador — y **no intentéis parsearla** para recuperar
los alimentos: para eso está `items`.

### Response

`POST` y `PUT` devuelven la comida en vista `Public`; `GET /meal/{id}` y `GET /meal/menu/{menuId}`
la devuelven en vista `Full` (mismos campos más metadatos del alimento):

```jsonc
{
  "id": "7d3a…",
  "dayOfWeek": "LUNES",
  "mealType": "COMIDA",
  "description": "Arroz integral, hervido 80 g · Pollo, pechuga, plancha 120 g (sin sal)",
  "items": [
    {
      "id": "e91b…",
      "quantityG": 80.00,
      "notes": null,
      "sortOrder": 0,
      "food": { "id": "5c089028-…", "source": "BEDCA", "name": "Arroz integral, hervido", "foodGroup": null }
    }
  ]
}
```

- `items` viene **ordenado por `sortOrder`**.
- En modo `MANUAL`, `items` es `[]`.
- El objeto `food` anidado **no trae los nutrientes** (sería demasiado peso al listar un menú).
  Para pintar macros usad `GET /menu/{id}/nutrition` (sección 6).
- En vista `Full` el `food` incluye además `bedcaId`, `nameEn`, `ediblePortion`, `origin` y
  `createdAt`. Ignoradlos salvo que os hagan falta.

---

## 4. La pantalla de edición (modo BEDCA)

### 4.1 El flujo de teclado, que es el requisito principal

Una comida es una **tabla de filas editables**. El ciclo completo de añadir un ingrediente debe
poder hacerse **sin tocar el ratón**:

```
┌─────────────────────────────────────────────────────────┐
│  COMIDA — Lunes                              264 kcal   │
├─────────────────────────────────────────────────────────┤
│  ⠿  Arroz integral, hervido      80 g   ⌫               │
│  ⠿  Pollo, pechuga, plancha     120 g   ⌫               │
│  ⠿  [arrz█                    ] [    ]                  │  ← fila en edición
│     ┌───────────────────────────────────────┐           │
│     │ Arroz                        386 kcal │ ←resaltado │
│     │ Arroz, hervido               392 kcal │           │
│     │ Arroz integral, crudo        384 kcal │           │
│     │ Arroz integral, hervido      112 kcal │           │
│     │ Arroz con leche               92 kcal │           │
│     │ ──────────────────────────────────────│           │
│     │ 🧾 Ensalada de la casa       (receta) │           │
│     │ ＋ Crear "arrz" como alimento…        │           │
│     └───────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

| Tecla | Comportamiento exigido |
|---|---|
| *(escribir)* | Dispara la búsqueda con **debounce de ~250 ms**. Cancelad la petición en vuelo al teclear de nuevo. |
| `↑` / `↓` | Mueve el resaltado por la lista de sugerencias. |
| `Enter` | Selecciona la sugerencia resaltada y **mueve el foco al campo de gramos**. |
| `Tab` | Igual que `Enter` (selecciona y avanza). |
| `Enter` *(en gramos)* | Confirma la fila, **crea una fila vacía debajo y deja el foco en su buscador**. |
| `Esc` | Cierra las sugerencias sin seleccionar. Segunda pulsación: descarta la fila en edición. |
| `⌫` *(en un buscador vacío)* | Borra la fila y devuelve el foco a la anterior. |

**Lo que no se debe hacer:** abrir un diálogo modal para elegir el alimento, ni obligar a pulsar
un botón "Añadir" entre fila y fila. Cada modal rompe el ciclo de teclado y es justo lo que esta
funcionalidad trata de evitar.

### 4.2 Guardado

**No guardéis fila a fila.** Mantened la lista en estado local y mandad **un solo `PUT`** con el
array completo cuando la comida pierde el foco, o con un *debounce* de ~1,5 s. Recordad que el
`PUT` reemplaza toda la lista, así que siempre debe ir entera.

Mostrad un indicador discreto de "guardando / guardado" en la cabecera de la comida. Nada de
*snackbars* por cada cambio.

---

## 5. Buscador de alimentos

```
GET /api/tenant/{tenantId}/food/search?q=arrz
```
Permiso: `VIEW_MENU`. Devuelve **dos listas en una sola llamada**.

```jsonc
{
  "foods": [
    {
      "id": "5c089028-…",
      "source": "BEDCA",                  // "BEDCA" | "TENANT"
      "name": "Arroz integral, hervido",  // ← nombres reales de BEDCA, ver nota abajo
      "foodGroup": null,
      "ediblePortion": 1.0000,
      "nutrients": {                       // ← por 100 g
        "ENERC_KCAL": 111.5679,
        "ENERC": 466.8000,                // kJ — no lo mostréis
        "PROT": 2.6000,
        "FAT": 0.9000,
        "CHO": 22.9000,
        "FIBT": 1.8000
      }
    }
  ],
  "recipes": [
    {
      "id": "b7c1…",
      "name": "Plantilla verano",          // nombre de la plantilla de origen
      "dayOfWeek": "LUNES",
      "mealType": "COMIDA",
      "description": "Lechuga 100 g · Tomate 80 g",
      "items": [
        { "foodId": "…", "name": "Lechuga", "quantityG": 100.00, "notes": null, "sortOrder": 0 },
        { "foodId": "…", "name": "Tomate",  "quantityG": 80.00,  "notes": null, "sortOrder": 1 }
      ]
    }
  ]
}
```

### Comportamiento

- **Búsqueda difusa**: tolera erratas y acentos. `arrz` → *Arroz*, `platano` → *Plátano*.
  No hace falta que normalicéis nada en el cliente.
- Máximo **20 alimentos** y **10 recetas**. No hay paginación: si no aparece, que afine la búsqueda.
- Si `q` viene vacío, devuelve listas vacías. **No lancéis la búsqueda con menos de 2 caracteres.**

### Cómo pintarlo

- Marcad visualmente los alimentos `"source": "TENANT"` (una etiqueta tipo *"Propio"*): son los que
  ha creado el centro y los que pueden tener datos incompletos.
- Mostrad las **recetas en un grupo aparte, debajo de los alimentos**, con un icono distinto. Elegir
  una receta **no** añade una fila: **expande sus `items` como N filas**, que el nutricionista puede
  ajustar después.
- Mostrad las kcal/100 g en cada sugerencia: es lo que permite elegir sin abrir nada.
- `foodGroup` viene `null` en la mayoría de alimentos de BEDCA (sólo 182 de 957 lo traen) y está en
  inglés (`"Grains and grain-based products"`). **Agrupad por él sólo si tiene valor** y meted el
  resto en "Otros" — o no agrupéis.

> **Los nombres de BEDCA son descriptivos y largos**, con el estado de cocción incluido:
> `"Arroz integral, crudo"`, `"Arroz integral, hervido"`, `"Pollo, pechuga, con piel, crudo"`,
> `"Pollo, pechuga, plancha"`. No existe un simple *"Arroz blanco"*. Dos consecuencias de UX:
> 1. **No truncéis el nombre** en la lista de sugerencias: la parte que distingue un alimento de
>    otro (`crudo` vs `hervido`) está al final. Si no cabe, usad dos líneas.
> 2. La diferencia nutricional entre variantes es enorme (arroz integral: **384 kcal/100 g** crudo
>    frente a **112 kcal/100 g** hervido). Mostrar las kcal en cada sugerencia no es decorativo:
>    es lo que evita que el nutricionista elija la variante equivocada.

---

## 6. Macronutrientes: dónde se calculan

**Regla: mientras el nutricionista edita, calculáis vosotros. Al mostrar un menú guardado, preguntáis al servidor.**

### 6.1 En el cliente, en vivo

El buscador ya os devolvió los `nutrients` **por 100 g**. Guardadlos junto a la fila y recalculad
en cada pulsación, sin ir a la red:

```dart
double total(List<MealItemRow> rows, String code) => rows.fold(
  0.0,
  (sum, r) => sum + (r.food.nutrients[code] ?? 0) * r.quantityG / 100,
);
```

No hay que aplicar `ediblePortion`: los valores de BEDCA son por 100 g de porción comestible y
`quantityG` es peso comestible, así que la cuenta es directa.

### 6.2 En el servidor, como fuente de verdad

```
GET /api/tenant/{tenantId}/menu/{menuId}/nutrition
```
Permiso: `VIEW_MENU` o ser el dueño del menú (el paciente puede consultarlo).

```jsonc
{
  "menuId": "8f14e45f-…",
  "meals": [
    { "mealId": "7d3a…", "dayOfWeek": "LUNES", "mealType": "COMIDA",
      "nutrients": { "ENERC_KCAL": 263.69, "PROT": 28.72, "FAT": 8.16, "CHO": 18.32 } }
  ],
  "days":  { "LUNES": { "ENERC_KCAL": 1850.30, "PROT": 95.10 } },
  "total": { "ENERC_KCAL": 12950.80, "PROT": 665.70 },
  "incompleteItems": 0
}
```

> Esos números de `meals[0]` son los de la comida de ejemplo (80 g de *Arroz integral, hervido*
> + 120 g de *Pollo, pechuga, plancha*) y podéis reproducirlos con la fórmula de arriba:
> `112,5679 × 0,8 + 145,0287 × 1,2 = 263,69 kcal`. Si vuestro cálculo local no cuadra con este
> endpoint, el error está en el cliente.

- Usadlo al **abrir** un menú y tras **guardar**, no en cada tecla.
- **`incompleteItems`**: número de ítems cuyo alimento no tiene kcal registradas. Si es `> 0`,
  **avisad en la interfaz** (*"N ingredientes sin datos nutricionales; los totales están incompletos"*).
  Sin ese aviso, un alimento propio a medio rellenar hace que el menú parezca correcto cuando no lo es.
- `nutrients` incluye **todos** los nutrientes con dato, no sólo los macros. Filtrad por los códigos
  que vayáis a pintar.

### 6.3 Códigos de nutriente que os interesan

```
GET /api/tenant/{tenantId}/food/nutrient
```
Devuelve el catálogo completo (48 entradas) con `code`, `name`, `unit` y `nutrientGroup`.
Pedidlo **una vez** al arrancar y cachéadlo: es lo que os da las etiquetas y unidades sin
hardcodearlas.

Los más relevantes:

| Código | Nombre | Unidad |
|---|---|---|
| `ENERC_KCAL` | Energía | **kcal** ← el que debéis mostrar |
| `ENERC` | Energía | kJ (así lo publica BEDCA; no lo mostréis) |
| `PROT` | Proteína | g |
| `FAT` | Grasa total | g |
| `FASAT` | Grasas saturadas | g |
| `CHO` | Hidratos de carbono | g |
| `SUGAR` | Azúcares | g |
| `FIBT` | Fibra | g |
| `NA` | Sodio | mg |
| `CHORL` | Colesterol | mg |

Grupos (`nutrientGroup`) para organizar una vista de detalle: `Proximales`, `Hidratos de Carbono`,
`Grasas`, `Vitaminas`, `Minerales`.

> ⚠️ **Mostrad siempre `ENERC_KCAL`, nunca `ENERC`.** Confundirlos multiplica las calorías por 4,184.

---

## 7. Alimento propio (*escape hatch*)

Cuando el alimento no está en BEDCA, el nutricionista debe poder crearlo **sin perder lo que
llevaba escrito en la comida**.

```
POST /api/tenant/{tenantId}/food
```
Permiso: `MANAGE_MEAL`.

```jsonc
{
  "name": "Pan de mi panadería",
  "foodGroup": "Cereales",              // opcional, texto libre
  "nutrients": {
    "ENERC_KCAL": 265,                  // OBLIGATORIO
    "PROT": 9.0,                        // opcionales
    "FAT": 3.2,
    "CHO": 49.0
  }
}
```

Devuelve un `FoodDto` **con la misma forma que los del buscador**, para que lo insertéis
directamente en la fila que estaba en edición.

### Flujo de UX exigido

1. Cuando la búsqueda no encuentra nada (o siempre, al final de la lista), mostrad
   **`＋ Crear "<lo tecleado>" como alimento`**.
2. Al elegirlo, abrid un **panel inline o una hoja inferior**, nunca una pantalla nueva:
   el nombre viene precargado con lo tecleado, foco en el campo de kcal.
3. Al guardar, **volved a la misma fila** con el alimento ya seleccionado y el foco en gramos.
   El resto de la comida no se ha tocado.

### Validaciones

| Situación | Respuesta | Qué mostrar |
|---|---|---|
| Sin `ENERC_KCAL` | `400` | *"Introduce las calorías por 100 g"*, foco en ese campo. |
| Nombre ya existente en el centro | `409` | *"Ya tienes un alimento con ese nombre"* + ofrecer usar el existente. |
| Código de nutriente desconocido | `400` | Bug vuestro: usad los `code` de `/food/nutrient`. |

> **Pedid kcal, insistid en los macros.** Son opcionales en la API para no frenar la captura, pero
> un alimento sin proteína/grasa/hidratos hace que esos totales salgan bajos sin avisar. Marcad el
> alimento como incompleto en la lista y ofreced completarlo más tarde.

---

## 8. Operaciones masivas

### 8.1 Mover una comida (drag & drop)

No hay endpoint nuevo: es el `PUT` de siempre con los campos de posición.

```jsonc
// PUT /api/tenant/{tenantId}/meal/{mealId}
{ "dayOfWeek": "MIERCOLES", "mealType": "CENA" }
```

Omitid `description` e `items`: al no mandarlos, no se tocan.

> ⚠️ **El backend no impide que dos comidas caigan en el mismo hueco** (no hay restricción de
> unicidad en la tabla). Si soltáis sobre una casilla ocupada, decidid vosotros el gesto:
> **intercambiar** (dos `PUT`) es lo esperable; **apilar** es válido pero debéis pintarlo como tal.
> No asumáis que el servidor lo va a resolver.

### 8.2 Clonar un día completo

```
POST /api/tenant/{tenantId}/menu/{menuId}/copy-day
```
Permiso: `MANAGE_MEAL`.

```jsonc
{ "from": "LUNES", "to": "MIERCOLES", "overwrite": true }
```

- `overwrite: true` **borra** lo que hubiera en el día destino; `false` (o ausente) **añade**.
- Devuelve el array de comidas creadas → repintad sólo ese día, sin recargar el menú.
- Copiar un día sobre sí mismo devuelve `400`.

**UX:** el destino con contenido debe pedir confirmación explícita antes de mandar
`overwrite: true` (*"El miércoles ya tiene 2 comidas. ¿Reemplazarlas?"*). Es destructivo y no
tiene deshacer en el servidor.

### 8.3 Reordenar ingredientes

No hay endpoint: reordenad el array en local y mandad el `PUT` con los `sortOrder` recalculados.

---

## 9. Errores

Todos los errores llegan con el formato estándar de la API y **mensaje ya traducido** al idioma
del usuario:

```jsonc
{ "error": "Una comida necesita una descripción o al menos un alimento" }
```

| Código | Cuándo | Qué hacer |
|---|---|---|
| `400` | Comida sin `description` ni `items`; alimento sin kcal; `quantityG` ≤ 0; clonar un día sobre sí mismo | Mostrar el mensaje junto al campo culpable, no en un diálogo global. |
| `403` | Falta el permiso (`MANAGE_MEAL`, `VIEW_MENU`…) | Ocultad de entrada las acciones que el rol no tiene. |
| `404` | El `foodId` no existe **o pertenece a otro centro** | Refrescad el buscador; probablemente el alimento se borró. |
| `409` | Alimento propio con nombre duplicado | Ofrecer el existente. |

---

## 10. Checklist de implementación

**Imprescindible**

- [ ] Leer `menuCreationMode` del branding y enrutar al editor correspondiente.
- [ ] Modelo de Dart: `description` **nullable**, `items` con valor por defecto `[]`.
- [ ] Editor de filas con el ciclo de teclado completo de la sección 4.1.
- [ ] Buscador con debounce de ~250 ms y cancelación de la petición anterior.
- [ ] Guardado con un único `PUT` y la lista **completa** de `items`.
- [ ] Mostrar `ENERC_KCAL`, nunca `ENERC`.
- [ ] Recalcular macros en local mientras se edita.
- [ ] Avisar cuando `incompleteItems > 0`.
- [ ] Crear alimento propio sin perder el estado del formulario.
- [ ] Confirmación antes de `copy-day` con `overwrite: true`.

**Recomendable**

- [ ] Cachear `/food/nutrient` al arrancar, para etiquetas y unidades.
- [ ] Distintivo visual para los alimentos `source: "TENANT"`.
- [ ] Barra de macros (P/G/HC) con el reparto porcentual de la comida.
- [ ] Totales por día en la vista semanal (de `days` del endpoint de nutrición).

**Comprobaciones de no-regresión**

- [ ] Un centro en `MANUAL` funciona exactamente igual que antes del cambio.
- [ ] Un menú creado en modo `BEDCA` se ve correctamente en el PDF (`GET /menu/{id}/pdf`).
- [ ] Un menú antiguo, sin `items`, se sigue pudiendo editar en un centro que ya está en `BEDCA`.

---

## 11. Preguntas que os vais a hacer

**¿Puedo mandar `description` e `items` a la vez?**
Sí, pero si hay `items` la `description` que mandéis se descarta y se regenera. La única
combinación útil es mandar `items: []` + `description: "texto"` para devolver una comida al
modo texto.

**¿Cómo convierto una comida de texto a estructurada?**
Un `PUT` con los `items`. La `description` anterior se sustituye por la renderizada. No hay
conversión automática del texto a alimentos.

**¿Se pueden usar alimentos propios de otro centro?**
No. El buscador sólo devuelve BEDCA + los del centro, y el servidor lo revalida al guardar
(`404` si se intenta).

**¿Qué pasa si el centro cambia de `BEDCA` a `MANUAL`?**
Nada se pierde: los `items` siguen en la base de datos y la `description` renderizada sigue ahí.
El editor de texto mostrará ese texto. Si el nutricionista lo edita a mano, esa comida deja de
tener macros correctas (el texto y los ítems dejan de coincidir).

**¿Las plantillas de menú soportan lo mismo?**
Sí, con el mismo contrato de `items` en `POST /menu-template/{id}/meals` y `PUT .../meals/{mealId}`.
Al instanciar una plantilla, los alimentos se arrastran al menú real.

---

## 12. Datos del catálogo, para calibrar expectativas

| Dato | Valor |
|---|---|
| Alimentos BEDCA | **957** |
| Nutrientes | **48** (47 de BEDCA + `ENERC_KCAL` derivado) |
| Valores nutricionales | ~30.150 |
| Base de los valores | por **100 g de porción comestible** |
| Alimentos con grupo (`foodGroup`) | 182 de 957 — el resto viene `null` |

**957 alimentos es un catálogo pequeño.** Es la base de datos oficial española y cubre alimentos
genéricos, no marcas comerciales. Contad con que el nutricionista usará el alta de alimento propio
a menudo: ese flujo no es un caso excepcional, es parte del uso normal. Diseñadlo como tal.
