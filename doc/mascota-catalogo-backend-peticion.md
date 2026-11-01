# Mascota — el catálogo de mascotas del backend no coincide con el del frontend

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** el contrato vigente en [`mascota-frontend.md`](mascota-frontend.md), §3.3 y §4.
> **Fecha:** 2026-11-01.
> **Síntoma para quien lo sufre:** eliges otra mascota, la ves puesta, recargas el
> navegador y vuelve la manzana. En cada sesión, y en cada dispositivo.

Es una petición corta y de una sola cosa: **registrar tres mascotas** en el
catálogo del backend. No hay nada que diseñar ni que negociar en el protocolo;
el contrato ya está escrito y el frontend ya lo habla.

---

## 1. Qué pasa

El armario de la mascota ofrece cuatro: manzana, naranja, piña y melón. Al
confirmar, el frontend guarda el look como manda el contrato:

```http
PUT /api/tenant/{tenantId}/assistant/look
Content-Type: application/json

{ "skinId": "melon", "accessories": [] }
```

Y el backend lo rechaza:

```json
{
  "status": 422,
  "title": "Unprocessable Content",
  "code": "error.assistant_pet_not_found",
  "detail": "Mascota predefinida no encontrada"
}
```

Porque el catálogo que sirve el propio backend es otro:

```http
GET /api/tenant/{tenantId}/assistant/pets
```

```json
[
  { "id": "brocoli",   "name": "Brócoli",   "category": "VEGETABLE", "order": 1 },
  { "id": "manzana",   "name": "Manzana",   "category": "FRUIT",     "order": 2 },
  { "id": "semilla",   "name": "Semilla",   "category": "SEED",      "order": 3 },
  { "id": "zanahoria", "name": "Zanahoria", "category": "VEGETABLE", "order": 4 }
]
```

De las cuatro que dibuja el frontend solo existe `manzana`. Las otras tres dan
422, no se guarda nada, y al recargar el `GET /look` devuelve el último valor
que sí entró —`manzana`— y se lleva por delante la elección. De ahí que "siempre
vuelva la manzana": es la única que el backend acepta.

`brocoli`, `semilla` y `zanahoria` parecen una semilla de datos anterior a que
se cerrara el catálogo de las cuatro frutas. El frontend no tiene dibujo para
ellas: si alguien las eligiera, se quedaría sin mascota.

---

## 2. Lo que pedimos

Que el catálogo de mascotas predefinidas contenga **estos cuatro ids**, que son
los que el frontend sabe dibujar:

| `id` | `name` | `category` | `order` | `supports.accessories` |
|---|---|---|---|---|
| `manzana` | Manzana | `FRUIT` | 1 | `["orejas"]` |
| `naranja` | Naranja | `FRUIT` | 2 | `["orejas"]` |
| `pina` | Piña | `FRUIT` | 3 | `["orejas"]` |
| `melon` | Melón | `FRUIT` | 4 | `["orejas"]` |

Detalles que importan:

- **`pina` va sin eñe.** El id es ASCII (`pina`), el nombre visible lleva la
  eñe (`Piña`). El frontend valida contra el id.
- Las cuatro soportan las mismas expresiones que ya declara el catálogo actual:
  `idle`, `listening`, `thinking`, `happy`, `confused`, `sleeping`.
- El único accesorio es `orejas`.
- `brocoli`, `semilla` y `zanahoria` **pueden retirarse**: el frontend no las
  dibuja. Si es más cómodo dejarlas, que no sea en `allowedSkinIds` ni como
  `defaultSkinId` de ningún centro.
- Si algún tenant tiene hoy `defaultSkinId` apuntando a una mascota que se
  retire, hay que reapuntarlo a `manzana` en la misma migración.

Nada más. El `PUT /look` ya funciona para `manzana`, así que la validación y la
escritura están bien; lo único que falta son las filas.

---

## 3. Cómo se comprueba que está hecho

1. `GET /assistant/pets` devuelve los cuatro ids de la tabla de arriba.
2. `PUT /assistant/look` con `{"skinId":"melon","accessories":["orejas"]}`
   responde 200 y devuelve lo guardado.
3. `GET /assistant/look` justo después devuelve `melon` con un `updatedAt`
   nuevo.
4. En la aplicación: elegir melón, recargar, y que siga el melón — también al
   entrar desde otro navegador con el mismo usuario.

El punto 4 es el que da por cerrada la petición: sin backend, el frontend llega
hasta el 3 solo dentro del mismo navegador.

---

## 4. Qué hace el frontend mientras tanto

Ya está en `master`, no hace falta esperar al backend para que la mascota deje
de volverse manzana en el mismo navegador:

- El look elegido se guarda en `localStorage` **con la fecha** de la elección, y
  el look remoto solo se aplica si es **más reciente** que esa fecha. Así un
  `manzana` viejo del servidor no pisa lo que acabas de elegir, y el día que el
  backend acepte guardados de verdad, el look remoto vuelve a mandar por sí solo
  —incluido el que venga de otro dispositivo— sin tocar nada.
- El 422 deja de ser mudo: se avisa con "No se ha podido guardar en tu centro:
  la mascota se queda puesta solo en este navegador"
  (`assistant.wardrobe_not_saved`).

Lo que **no** puede hacer el frontend es sincronizar entre dispositivos ni
sobrevivir a un borrado de datos del navegador. Eso depende de esta petición.

Archivos: `src/app/features/assistant/mascot/skins/storage.ts`,
`src/app/features/assistant/mascot/mascot-look.service.ts`,
`src/app/features/assistant/mascot/mascot-look.persistence.spec.ts`.
