# Asistente — peticiones de protocolo al backend

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** el contrato vigente en [`assistant-frontend.md`](assistant-frontend.md).
> **Fecha:** 2026-11-01.

**Esto no son tools.** El catálogo de herramientas —las 28 que hay y las que
faltan— está en [`assistant-tools-backend.md`](assistant-tools-backend.md) y
no se repite aquí. Lo de abajo es la **fontanería de la conversación**: cómo
viaja la respuesta, qué puede ordenarle el backend a la interfaz y qué pasa
cuando se confirma algo. Son huecos que el frontend no puede tapar solo, y que
aquel documento no cubre.

Va por prioridad.

---

## 1. Streaming de la respuesta (SSE)

**El problema.** `POST /assistant/sessions/{id}/messages` es una llamada
bloqueante. Mientras el modelo piensa —y más aún si encadena dos o tres
tools—, la mascota se queda muda tres o cuatro segundos con un "escribiendo…"
fijo. Es, con diferencia, lo que más resta a la sensación de que el asistente
está vivo, y ninguna tool nueva lo arregla.

**Lo que pedimos.** Una variante en streaming del mismo envío:

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages/stream
Accept: text/event-stream
Content-Type: application/json

{ "content": "Cambia la cita de Ana al jueves a las 10" }
```

Respuesta `text/event-stream`:

| `event` | `data` | Cuándo |
|---|---|---|
| `delta` | `{ "text": "trozo de texto" }` | N veces, según va generando |
| `tool` | `{ "name": "search_patients" }` | Al invocar una tool |
| `done` | `AssistantTurnResponse` completo | Una vez, al final |
| `error` | `{ "error": "...", "code": "error.…" }` | Si falla a mitad |

Notas:

- El evento `done` debe traer **el mismo objeto** que hoy devuelve el endpoint
  no-streaming (`assistantMessage`, `pendingAction`, `uiActions`). Así el
  frontend reutiliza tal cual la lógica de `uiActions` y de relleno de
  formularios: el streaming sólo cambia cómo se pinta el texto.
- El evento `tool` es opcional pero vale mucho: con él la mascota puede decir
  "estoy buscando a Ana…" en lugar de callarse. Basta el nombre; no queremos
  los argumentos.
- El endpoint actual **se queda**, como camino de respaldo si el stream se
  corta.
- Los mismos códigos de error de hoy (`error.assistant_session_closed`,
  `error.assistant_consent_required`, …), dentro del evento `error`.

> Ya hay SSE en el proyecto (`doc/notifications/`), así que la infraestructura
> no es nueva.

---

## 2. Completar §3.1: el `preview` de las tools de paciente

**El problema.** La sección §3.1 de `assistant-tools-backend.md` fija los
nombres de campo de horarios, asignaciones y festivos. Para las tools de
paciente —que **ya existen y ya se usan**— no hay nada escrito, pero el
relleno automático funciona con ellas: depende hoy de nombres que el backend
emite por costumbre. Un cambio de prompt los rompe **en silencio**: la mascota
dejaría de rellenar y caería a la tarjeta de confirmar sin que salte ningún
error, y nadie se enteraría hasta que un nutricionista lo notase.

**Lo que pedimos.** Que estos nombres pasen a ser contrato y se añadan a §3.1.
Son los que el frontend ya acepta: no pedimos cambiar nada, sólo fijarlo por
escrito.

### `create_measurement` (y `update_measurement`, cuando exista)

Todos numéricos, valor en texto (`"72,5 kg"` vale: se limpia y se parsea).

| Grupo | `field` |
|---|---|
| Composición | `weightKg`, `heightCm`, `bodyFatPct`, `muscleMassPct`, `bodyWaterPct`, `visceralFatLevel`, `boneMassKg` |
| Perímetros | `waistCm`, `chestCm`, `hipsCm`, `contourCm`, `armCm`, `wristCircumferenceCm` |
| Segmentos | `trunkFatPct`, `trunkMassKg`, `rightArmFatPct`, `rightArmMassKg`, `leftArmFatPct`, `leftArmMassKg`, `rightLegFatPct`, `rightLegMassKg`, `leftLegFatPct`, `leftLegMassKg` |
| Libre | `notes` (texto) |

Se aceptan alias en castellano (`peso`, `altura`, `grasa`, `cintura`…), pero
**preferimos el nombre canónico en inglés**: es el que no se va a mover.

El formulario reparte estos campos en cuatro pasos y sólo uno está en el DOM a
la vez; de eso se encarga el frontend. No hay que mandarlos en ningún orden
concreto.

### `create_appointment` / `reschedule_appointment`

| `field` | Formato |
|---|---|
| `patientId` | id **o nombre** del paciente |
| `nutritionistId` | id **o nombre** del profesional |
| `typeId` | id **o etiqueta** del tipo de cita |
| `date` | `YYYY-MM-DD` (también `DD/MM/YYYY`) |
| `time` | `HH:mm` |
| `notes` | texto libre |

Fecha y hora van **separadas**, porque el diálogo tiene dos campos. Un
`scheduledAt` único también se entiende (se parte en día y hora), pero es
preferible mandarlas aparte.

Los tres desplegables se resuelven por nombre contra las opciones que el
diálogo ya tiene cargadas, igual que `scheduleId`: **si el nombre es ambiguo
el campo se deja en blanco en lugar de adivinar**, y lo elige la persona.

### `update_anamnesis` / `update_profile`

Dieciocho antecedentes, cada uno con su interruptor y sus notas:

| Interruptor (`boolean`) | Notas (`text`) |
|---|---|
| `hasDiabetes` | `diabetesNotes` |
| `hasHypertension` | `hypertensionNotes` |
| `hasHeartDisease` | `heartDiseaseNotes` |
| `hasCholesterol` | `cholesterolNotes` |
| `hasAllergiesAsthma` | `allergiesAsthmaNotes` |
| `hasLiverDisease` | `liverDiseaseNotes` |
| `hasGallbladderDisease` | `gallbladderDiseaseNotes` |
| `hasKidneyDisease` | `kidneyDiseaseNotes` |
| `hasStomachDisease` | `stomachDiseaseNotes` |
| `hasUricAcidGout` | `uricAcidGoutNotes` |
| `hasCirculationIssues` | `circulationIssuesNotes` |
| `hasThyroidIssues` | `thyroidIssuesNotes` |
| `hasAnemia` | `anemiaNotes` |
| `hasConstipation` | `constipationNotes` |
| `hasMusculoskeletalIssues` | `musculoskeletalIssuesNotes` |
| `hasSurgeries` | `surgeriesNotes` |
| `hasMenstrualCycleIssues` | `menstrualCycleIssuesNotes` |
| `hasSleepIssues` | `sleepIssuesNotes` |

Los booleanos se mandan como texto: `"sí"`, `"true"`, `"1"` y variantes son
verdadero; cualquier otra cosa es falso.

### Nuestro lado ya está cerrado

Mientras llega la respuesta a esto, el frontend ha hecho lo que podía hacer
solo:

- **El contrato está fijado con tests.** `mascot/fill/surfaces/contract.spec.ts`
  prueba nombre a nombre todas las tablas de arriba, más las del §3.1 del doc
  de tools. Si renombramos un campo de un formulario, la prueba se cae: ya no
  nos lo podemos llevar por delante sin enterarnos.
- **El fallo silencioso ahora hace ruido.** `unmatchedPreview()` compara lo que
  manda el backend con lo que el formulario reconoce, y la mascota avisa por
  consola cuando llega un nombre que no entiende:

  ```
  [mascota] "create_measurement" → formulario "measurement": no reconoce
  ninguno de los campos del preview. Sin reconocer: pesoCorporal, alturaTotal.
  ```

  Así, si el día de mañana cambian los nombres en backend, se ve en la consola
  del navegador en vez de descubrirse porque un nutricionista nota que la
  mascota ha dejado de escribir.

Lo que no podemos hacer desde aquí es garantizar que los nombres no cambien:
eso es lo que pedimos, que pasen a estar escritos en §3.1.

---

## 3. Más tipos de `uiAction`

**El problema.** `AssistantUiActionDto.type` es un `string` abierto, pero el
único valor que el backend emite —y el único que el frontend atiende— es
`NAVIGATE`. Eso deja a la mascota sin poder hacer nada en pantalla salvo que
haya de por medio una escritura: **hoy sólo abre un formulario si antes llega
un `pendingAction`**.

**Lo que pedimos.** Tres tipos más. Ninguno escribe nada: son instrucciones de
interfaz.

```json
{ "type": "OPEN_DIALOG", "target": "measurement", "params": { "patientId": "uuid" } }
{ "type": "HIGHLIGHT",   "target": "weightKg" }
{ "type": "TOAST",       "params": { "severity": "info", "message": "Menú creado" } }
```

- **`OPEN_DIALOG`** — abre un formulario sin rellenarlo, para "ábreme el
  formulario de medidas de Ana, que lo relleno yo". Los `target` válidos son
  los formularios que el frontend ya sabe abrir: `measurement`, `appointment`,
  `schedule`, `schedule-assignment`, `holiday`.
- **`HIGHLIGHT`** — señala un campo mientras lo explica ("el perímetro de
  cintura es este de aquí"). El `target` es un nombre de campo de §2. Encaja
  con `explain_ui` (§15 del doc de tools): una cosa lo cuenta y la otra lo
  señala.
- **`TOAST`** — un aviso corto que no necesita el panel abierto.

Como hasta ahora, **cualquier `type` o `target` desconocido se ignora en
silencio**, así que se pueden ir añadiendo sin romper versiones viejas.

---

## 4. Completar `ALLOWED_SCREENS`

§4 del doc de tools añade las `SETTINGS_*`. Faltan estas, que son páginas que
existen en la aplicación y a las que la mascota no puede llevar:

| `screen` | Destino | `params` |
|---|---|---|
| `MENUS` | Listado de menús | `query` (opcional) |
| `SHOPPING_LIST` | Lista de la compra del paciente | `patientId` |
| `EVOLUTION` | Evolución del paciente | `patientId` |
| `REVENUE` | Ingresos | — |
| `STAFF` | Personal del centro | — |
| `SETTINGS_BRANDING` | Ajustes → Marca | — |

Es un cambio de dos lados: el frontend tiene que añadirlas a su tipo
`AssistantScreen` y el backend a `ALLOWED_SCREENS`. Decidnos cuáles entran y
las añadimos en el mismo momento.

---

## 5. Qué pasa después de confirmar

**El problema.** `POST /pending-actions/{id}/confirm` devuelve
`{ status, entityType, entityId, message }`. El `entityId` está ahí pero el
frontend no lo usa, porque no tiene forma de saber a qué pantalla corresponde:
tras crear un menú, la persona se queda donde estaba y tiene que ir a
buscarlo. `import_holidays` es el caso más visible — acaba sin que se vea el
resultado.

**Lo que pedimos.** Que la respuesta de `confirm` pueda traer `uiActions`, con
la misma forma que la de un mensaje:

```json
{
  "status": "CONFIRMED",
  "entityType": "MENU",
  "entityId": "uuid",
  "message": "Menú creado",
  "uiActions": [
    { "type": "NAVIGATE", "screen": "PATIENT_MENU", "params": { "patientId": "uuid" } }
  ]
}
```

Campo opcional: si no viene, todo sigue como hoy.

---

## 6. Reanudar la conversación

**El problema.** Cuando la sesión caduca o se cierra, el frontend la descarta
y la siguiente vez abre una nueva: se pierde el hilo entero. Para algo que se
usa a ratos a lo largo del día, es molesto.

**Lo que pedimos**, lo que sea más barato de las dos:

- `GET /assistant/sessions/latest?subjectUserId=…` — la última sesión viva de
  ese usuario, o `404` si no hay.
- O que `POST /assistant/sessions` acepte `"resume": true` y reutilice la
  sesión abierta en lugar de crear otra.

Con el historial que ya existe (`GET /sessions/{id}/messages`) nos basta para
repintar la conversación.

---

## Anexo — Lo que **no** hay que tocar

Para no duplicar trabajo, esto lo resuelve el frontend:

- **Abrir el formulario y escribir en él.** La mascota ya navega, abre la
  pestaña o el diálogo y teclea campo a campo. Lo único que necesita del
  backend son los nombres de campo de §2.
- **Traducir nombres a ids** en los desplegables (paciente, profesional, tipo
  de cita, jornada): lo hace el diálogo, que es quien tiene las opciones
  cargadas.
- **Filtrar los `suggestedPrompts`** según la pantalla: se hace en local.
- **Entrada por voz**, animaciones, vestuario y proactividad de la mascota.
- **Permisos de interfaz**: el frontend ya oculta lo que la persona no puede
  hacer. Lo que sí pedimos es que **las tools sigan validando en servidor**,
  como hacen las de configuración del centro con `MANAGE_TENANT`.

---

## Resumen

| | Petición | Coste | Qué desbloquea |
|---|---|---|---|
| **1** | Streaming SSE | Medio | La mascota deja de parecer colgada |
| **2** | `preview` de las tools de paciente en §3.1 | Bajo | Evita que el relleno se rompa sin avisar |
| **3** | `OPEN_DIALOG` / `HIGHLIGHT` / `TOAST` | Medio | La mascota actúa sin necesidad de una escritura |
| **4** | 6 pantallas en `ALLOWED_SCREENS` | Bajo | Navegación a menús, ingresos, personal… |
| **5** | `uiActions` en `confirm` | Bajo | Se ve el resultado de lo que se acaba de crear |
| **6** | Reanudar sesión | Bajo | No se pierde el hilo |

Si hay que elegir dos: **1 y 2**. El primero cambia cómo se siente el
asistente; el segundo evita que lo que ya funciona se rompa en silencio.

Y si hay que ordenar esto contra el catálogo de tools: **2 va antes que
cualquier tool nueva** (es media hora y protege lo que ya está hecho), y **1
va después del bloque de tools que estéis implementando ahora**, porque toca
el mismo servicio de conversación y es mejor no pisarse.
