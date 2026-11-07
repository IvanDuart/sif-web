# Mascota — ampliación del catálogo (y una enmienda a la petición anterior)

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** el contrato vigente en [`mascota-frontend.md`](mascota-frontend.md), §2 y §3.3.
> **Enmienda:** sustituye al §2 de [`mascota-catalogo-backend-peticion.md`](mascota-catalogo-backend-peticion.md) en un punto concreto — allí dijimos que `brocoli`, `semilla` y `zanahoria` podían retirarse. **Ya no: las queremos.**
> **Fecha:** 2026-11-01.
> **Por qué ahora:** el plan de mejoras de la mascota (`mascot-improvement-plan.md`) pide más personajes. Antes de dibujar ninguno hay que cerrar quién manda en el catálogo, porque hoy el dibujo y la fila van por su cuenta y el resultado es el 422 que ya conocemos.

---

## 1. Qué pasa

El catálogo lo sirve el backend (`GET /assistant/pets`) y lo valida el backend
(`PUT /assistant/look` → 422 `error.assistant_pet_not_found`), pero **el dibujo
vive en el frontend**. Cuando las dos listas no coinciden pasa una de dos cosas,
y las dos son malas:

- **Id dibujado sin fila:** el armario ofrece una mascota que no se puede
  guardar. Es el bug de ayer: eliges melón, recargas, vuelve la manzana.
- **Fila sin dibujo:** el backend acepta un id que el frontend no sabe pintar.
  Si además es el `defaultSkinId` de un centro, ese centro se queda sin mascota
  visible.

Al revisar el catálogo que sirve hoy el backend encontramos esto:

```json
[
  { "id": "brocoli",   "name": "Brócoli",   "category": "VEGETABLE", "order": 1 },
  { "id": "manzana",   "name": "Manzana",   "category": "FRUIT",     "order": 2 },
  { "id": "semilla",   "name": "Semilla",   "category": "SEED",      "order": 3 },
  { "id": "zanahoria", "name": "Zanahoria", "category": "VEGETABLE", "order": 4 }
]
```

En la petición de ayer dimos por muertas `brocoli`, `semilla` y `zanahoria`
porque el frontend no las dibujaba. Visto el plan de mejoras, es justo al revés:
**son tres personajes que el backend ya acepta y que sólo les falta el dibujo**,
que es trabajo nuestro y no bloquea a nadie. Pedir tres filas nuevas cuando ya
hay tres filas sin usar no tiene sentido.

Además encajan mejor con el producto que otra fruta más: una clínica de
nutrición con brócoli, zanahoria y semilla tiene más que contar que con cuatro
frutas.

---

## 2. Qué pedimos

### 2.1 No retiréis `brocoli`, `semilla` ni `zanahoria`

Es lo único urgente de este documento, porque la petición de ayer autorizaba
explícitamente a borrarlas. **Dejadlas como están**, con esos mismos ids
(`brocoli`, `semilla`, `zanahoria` — sin tildes y en minúscula, tal cual). El
frontend las va a dibujar.

Si ya se han retirado, hay que volver a darlas de alta con el id exacto.

### 2.2 Siguen faltando las tres de ayer

`naranja`, `pina` y `melon` continúan sin fila y el `PUT /look` las sigue
rechazando. Esa petición sigue viva tal cual está escrita.

### 2.3 El catálogo completo al que vamos

| `id` | `name` | `category` | `order` | Estado |
|---|---|---|---|---|
| `manzana` | Manzana | `FRUIT` | 1 | Existe y se dibuja. |
| `naranja` | Naranja | `FRUIT` | 2 | **Falta la fila.** Dibujo hecho. |
| `pina` | Piña | `FRUIT` | 3 | **Falta la fila.** Dibujo hecho. |
| `melon` | Melón | `FRUIT` | 4 | **Falta la fila.** Dibujo hecho. |
| `brocoli` | Brócoli | `VEGETABLE` | 5 | Fila existe. Dibujo pendiente (frontend). |
| `zanahoria` | Zanahoria | `VEGETABLE` | 6 | Fila existe. Dibujo pendiente (frontend). |
| `semilla` | Semilla | `SEED` | 7 | Fila existe. Dibujo pendiente (frontend). |

- Las siete soportan las mismas expresiones que ya declara el catálogo:
  `idle`, `listening`, `thinking`, `happy`, `confused`, `sleeping`.
- El único accesorio sigue siendo `orejas`.
- El `order` es una sugerencia: agrupa por categoría y deja delante las que ya
  están dibujadas. Si el backend prefiere otro, el frontend respeta el que venga.

### 2.4 Una regla para que esto no vuelva a pasar

Pedimos dejar escrito en el contrato que **`GET /assistant/pets` es la lista de
todo lo que `PUT /assistant/look` acepta**, sin excepciones en ninguno de los
dos sentidos:

- Si un id está en `/pets`, un `PUT /look` con ese id responde 200.
- Si un id no está en `/pets`, el armario no lo ofrece.

Con eso el frontend puede ofrecer sólo la intersección entre lo que sabe dibujar
y lo que el centro sirve, y el 422 por catálogo deja de ser alcanzable desde la
interfaz. Es la parte que cierra el problema de raíz; lo demás son filas.

Hace falta también que `/pets` lo pueda leer **cualquier rol que vea la
mascota**, no sólo quien administra el centro: si el nutricionista no puede leer
el catálogo, el armario se queda sin saber qué ofrecer y volvemos a adivinar.

### 2.5 Cómo se dan de alta los personajes nuevos

Para los que vengan después del plan de mejoras, el orden de trabajo que pedimos
es: **primero la fila, después el dibujo**. El frontend no publica una mascota en
el armario hasta que `GET /pets` la devuelve en algún entorno. A cambio, cuando
pidamos una nueva vendrá con el id, el nombre, la categoría y el `order` ya
decididos, como la tabla de arriba — una fila, nada más.

### 2.6 `defaultSkinId` de los centros

Cualquier tenant cuyo `defaultSkinId` apunte a un id que no esté en la tabla de
§2.3 hay que reapuntarlo a `manzana` en la misma migración. Hoy eso deja al
centro sin mascota visible hasta que el usuario elige una a mano.

---

## 3. Cómo se comprueba que está hecho

1. `GET /assistant/pets` devuelve los siete ids de §2.3 (o al menos los cuatro
   que ya existían más los tres de ayer, sin haber borrado ninguno).
2. Lo devuelve también autenticado como nutricionista, no sólo como administrador.
3. `PUT /assistant/look` responde 200 para **cada uno** de los siete ids.
4. `PUT /assistant/look` con `{"skinId":"kiwi"}` sigue respondiendo 422
   `error.assistant_pet_not_found`.
5. En la aplicación: elegir brócoli, recargar, y que siga el brócoli — también
   desde otro navegador con el mismo usuario.

---

## 4. Qué hace el frontend mientras tanto

- **Filtra el armario por `/pets`.** En cuanto §2.4 esté acordado, el armario
  ofrece sólo la intersección entre los dibujos que tiene y lo que el centro
  sirve. Mientras `/pets` no devuelva las tres de ayer, sus dibujos existen pero
  no se ofrecen: es preferible un armario más corto que uno que miente.
- **Dibuja `brocoli`, `zanahoria` y `semilla`**, que no dependen de nadie. Es la
  única parte de la Fase 1 del plan de mejoras que puede empezar hoy.
- Sigue en pie lo de ayer: el look elegido se guarda en `localStorage` con su
  fecha, el look remoto sólo manda si es más reciente, y el 422 avisa con
  `assistant.wardrobe_not_saved`.
