# Plan — Adaptar el copiloto de alkimia a sif-web

> **Origen:** `alkimia-app/src/core/copilot/` (React 19 + assistant-ui + AG-UI). Son unos 170 ficheros y 14 000 líneas sin contar tests.
> **Destino:** `src/app/features/assistant/` (Angular 21, signals, Taiga UI) y el backend Spring Boot del asistente (`AssistantConversationService`, Gemini).
> **Decisiones tomadas (noviembre de 2026):**
> 1. **Herramientas en el cliente.** El modelo llama a herramientas que se ejecutan en el navegador y recibe su resultado en el mismo turno, como en alkimia. Este modelo sustituye al de `uiActions` sin respuesta de vuelta.
> 2. **Alcance:** capacidades del agente, barra inferior, vida y encanto, y guardar con confirmación.
> 3. **Enfoque:** adaptar, no copiar. alkimia es una plataforma genérica de agentes, y sif-web gestiona una clínica de nutrición donde la seriedad pesa más.
>
> **Backend (2026-11-07):** las fases B0–B3 están hechas en `tus-dietas` (`develop`, commit `b2f7b1a`, todavía sin push). La B4, la retirada de `uiActions`, sigue pendiente. El contrato está en `tus-dietas/doc/assistant/assistant-frontend.md` §3.2 y `mascota-frontend.md` §1.1, y lo que cambia respecto a este plan está en el §6.
>
> Este documento sustituye a `doc/mascot-improvement-plan*.md`. Esos planes partían de un sif-web anterior: las notas con acciones, los tips, la ayuda al atascarse en un formulario, los logros y las skins ya están hechos.

---

## 1. Dónde estamos

### 1.1 Lo que sif-web ya tiene, en su mayoría portado de alkimia

| Pieza | sif-web | Origen en alkimia |
|---|---|---|
| Orbe, skins (frutas y verduras), caras, contornos y wardrobe | `components/mascot-orb.*`, `mascot/skins/*`, `components/mascot-wardrobe.*` | `mascot/MascotOrb.tsx`, `skins/*`, `Wardrobe.tsx` |
| Moods y notas con acciones | `mascot/mascot-mood.service.ts`, la nota en `mascot-launcher.ts` | `mascotMood.ts`, `MascotNote.tsx` |
| Vida propia y detectores | `mascot/mascot-life.service.ts`, `lifeDetectors.ts` | `useMascotLife.ts`, `lifeDetectors.ts` |
| Movimiento | `mascot/agentMotion.ts`, `motionCore.ts` | iguales |
| Logros, tips y ayuda al atascarse | `mascot-milestones.service.ts`, `mascot-tips.service.ts`, `stuck-form-offer.service.ts` | `achievements.ts`, `mascotTips.ts`, `useStuckFormOffer.ts` |
| Rellenado animado de formularios | `mascot/fill/` (`descriptor.ts`, `animated-fill.ts`, 15 surfaces) | `descriptor.ts`, `animatedFill.ts` |
| Turno con streaming, adjuntos, consentimiento y detener | `mascot-state.service.ts` | `CopilotHost.tsx`, `MascotBubble.tsx` |

### 1.2 La diferencia de fondo: quién ejecuta y quién se entera

```
sif-web hoy                                   alkimia
───────────                                   ───────
usuario → backend → Gemini                    usuario → engine → LLM
          Gemini llama tools DE SERVIDOR               LLM llama tools DE NAVEGADOR
          ← turno + uiActions + pendingAction          ← tool-call fill_patient_profile {...}
navegador ejecuta uiActions                   navegador rellena, mide lo que se escribió
          (sin respuesta de vuelta)                     → tool-result {written, rejected}
pendingAction → tarjeta → confirm                       ← LLM sigue: «falta la fecha, ¿cuál?»
```

En sif-web el modelo **nunca sabe** si un `HIGHLIGHT` encontró el campo, si el formulario aceptó un valor o si la persona guardó. En alkimia cada acción termina con un resultado (`{written, rejected, saved, pressed, reason}`) que el modelo lee antes de seguir. Esa diferencia es lo que permite pedirle tareas de varios pasos.

### 1.3 Lo que falta, por bloque

**Capacidades del agente**
- `fill_<form>` con resultado: qué se escribió y qué se rechazó.
- `edit_<form>`: edición de una parte de un texto, con `textEdit.ts` (append, prepend, insert_after, insert_before, replace y delete).
- `open_<opener>`: abrir un formulario.
- `point_at`: señalar un elemento.
- `show_around`: un tour de hasta 6 paradas.
- `press`: pulsar un control tras confirmación.
- `ask_user`: preguntar con opciones y esperar la respuesta.
- `navigate`: ir a otra pantalla.
- Acciones propias que declara cada pantalla (`copilotActions.ts`).
- El contexto de pantalla, con un presupuesto de 22 000 caracteres (`pageContext.ts`).
- Un límite de 30 pasos por petición (`copilotSteps.ts`).
- Las filas insertadas en cascada (`insertReveal.ts`).
- La marca de «escrito por la mascota» en campos y filas (`writtenMark`, `CopilotRowMark`).
- Las imágenes del mensaje que el modelo puede volcar en un formulario (`copilotImages.ts`).
- El velo de transición al cambiar de ruta (`CopilotRouteVeil.tsx`, `transitionStore.ts`).
- La versión de pantalla (`useScreenVersion.ts`) y la espera a que el formulario se registre (`waitForSurface`).

**Guardar con confirmación**
- `save_<form>` (`copilotSave.ts`): la mascota va al botón Guardar del formulario y pregunta. Solo pulsa si se responde que sí, y después vigila si el formulario se cerró o mostró un error.
- Si la persona pulsa Guardar por su cuenta, eso cuenta como respuesta (`onPersonSave`, `savedByPerson`).

**Barra inferior** (`mascot/bar/*`)
- Una barra persistente en lugar del panel flotante.
- Una línea de estado con prioridad: `confirm`, `choice`, `paused`, `acting`, `thinking` y `reply` (`stripKind.ts`).
- Una bandeja de lectura que divide las respuestas largas en secciones numeradas (`readingDoc.ts`, `BarTray.tsx`).
- Una cola de mensajes escritos mientras la mascota trabaja, con «Hacer ahora» (`BarQueue.tsx`, `mascotStore.queued`).
- Pausar y reanudar la animación (`cursorStore.ts`, `whenResumed`).
- La vista del turno (`turn.ts`): petición, lo que dice ahora, lo que anunció, lo nuevo y el contador de pasos.

**Vida y encanto**
- Modo héroe (`mascotHero.ts`, `heroMotion.ts`, `useHeroSecret.ts`, `skins/heroes.ts`).
- La mascota sigue a la persona entre pantallas (`mascotFollow.ts`).
- Su colocación evita tapar lo que importa (`placement.ts`, `useToastClearance`).
- Primeros pasos (`firstSteps.ts`).
- Easter eggs desde la consola y la paloma (`useMascotSecrets.ts`, `MascotPigeon.tsx`).
- Personalidades por skin (`skins/personalities.tsx`).
- El velo «llama a la puerta» (`mascotKnock.ts`). En sif-web no se aplica, porque no hay hub de aplicaciones.

---

## 2. Arquitectura objetivo

### 2.1 El bucle de herramientas en el cliente

```
Angular                         Backend (Spring)                    Gemini
───────                         ────────────────                    ──────
POST /sessions/{id}/runs  ───►  arma el prompt
  { content, attachmentId,      + tools servidor (search_patients…)
    clientTools: [schemas],     + clientTools del navegador  ───►   function_call
    pageContext }                                                    fill_patient_profile
                          ◄───  SSE: event: client_tool
                                 { runId, callId, name, args }
                                 (el run queda SUSPENDIDO)
ejecuta en el DOM
(rellena, señala, pregunta…)
POST /runs/{runId}/tool-results ►  reanuda el run con
  { callId, result }               function_response  ───────────►  sigue
                          ◄───  SSE: delta… / client_tool… / done
```

- **El navegador declara sus herramientas en cada turno** (`clientTools`), igual que en alkimia, donde cada surface montada produce sus `fill_`, `edit_`, `save_` y `open_`. Así el modelo solo ve lo que existe en la pantalla actual. El backend no mantiene ningún catálogo del frontend.
- **Las herramientas de servidor se quedan donde están**: búsquedas, lecturas y `create_*` con `pendingAction`. Durante una fase conviven las dos vías. Cuando una tarea tiene formulario en pantalla, el modelo debe preferir `fill_` + `save_`. La tarjeta `pendingAction` queda para lo que no tiene formulario.
- **Suspender y reanudar**: el run se guarda en el servidor, en memoria o en Redis, con un TTL de unos 5 minutos. Si el navegador no devuelve el resultado a tiempo, el run se cierra con `tool_timeout` y el modelo lo explica.
- **Seguridad**: una herramienta de cliente nunca escribe en el backend por sí misma. Escribe en un formulario o pulsa un botón, y la petición HTTP la hace la página con los permisos y guards de siempre. `mascotWritesInterceptor` sigue observando esas peticiones.

### 2.2 Piezas Angular nuevas

| Pieza | Responsabilidad | Equivalente en alkimia |
|---|---|---|
| `copilot/tool-registry.service.ts` | Construye `clientTools` (JSON Schema) a partir de las surfaces, openers y actions registradas, y despacha cada `client_tool` a su `run`. | `CopilotToolsBridge.tsx` |
| `copilot/tools/*.run.ts` | Una función pura más una dependencia del DOM por herramienta: `fill`, `edit`, `save`, `open`, `point`, `tour`, `press`, `ask`, `navigate` y `action`. | `copilotTools.ts`, `copilotSave.ts`, `copilotPress.ts`, `copilotAsk.ts`, `copilotActions.ts` |
| `copilot/page-context.ts` | Construye el contexto: ruta, formularios abiertos con sus valores (nunca recortados) y extras por pantalla (recortables, con `trimmed`). | `pageContext.ts` |
| `copilot/step-limiter.ts` | Permite como máximo 30 herramientas por petición y se reinicia con cada mensaje. | `copilotSteps.ts` |
| `copilot/text-edit.ts` | Ediciones quirúrgicas de texto (puro, portable tal cual). | `textEdit.ts` |
| `copilot/pointing.ts` | `data-mascot-point`, `resolvePointable`, `isDangerous`. | `pointing.ts` |
| `copilot/cursor.service.ts` | Pausar y reanudar el trabajo de la mascota (`whenResumed`). | `cursorStore.ts` |
| `bar/*` | La barra inferior: estado, entrada, bandeja y cola. | `mascot/bar/*` |

La API del registro de surfaces (`MascotFillService`) se amplía en lugar de duplicarse:
- `registerOpener(id, description, open)`.
- `registerAction(id, description, fields, confirm?, run)`.
- `surface.save?: { button: selector | 'auto' }`.

Los atributos del DOM siguen el prefijo actual: `data-mascot-field`, `data-mascot-point`, `data-mascot-submit` y `data-mascot-new`.

### 2.3 Traducción de dependencias de React

| alkimia | sif-web |
|---|---|
| `zustand` (`mascotStore`, `copilotStore`, `cursorStore`, `transitionStore`) | Servicios `providedIn: 'root'` con `signal`/`computed` |
| `@assistant-ui/react` (`useAssistantTool`, `makeActionPart`, `AgentChat`) | `ToolRegistryService` + el SSE propio de `assistant.api.ts` (ya existe `scanFrames`/`parseFrame`) |
| `@ag-ui/client` `HttpAgent` | El bucle SSE de `MascotStateService.streamTurn`, ampliado con `client_tool` |
| `react-markdown` + `remark-gfm` | `mascot-rich-text` (ampliar con títulos y listas para la bandeja) |
| `react-hook-form` en surfaces | `FormGroup` (ya resuelto en `descriptor.ts`) |
| `react-router-dom` | `Router` + `surfaces/routes.ts` |
| Radix dialogs (focus trap) | Diálogos de Taiga. Hay que comprobar que la barra sigue siendo usable con un `tui-dialog` abierto, como hace `CopilotDock.tsx` con Radix. |

---

## 3. Fases

Las estimaciones son orientativas: **F** = frontend, **B** = backend.

### Fase 0 — Contrato y base técnica (F 1 sem · B 2 sem)

**Backend**
- `POST /assistant/sessions/{id}/runs` (SSE), que acepta `clientTools` y `pageContext`.
- El evento SSE `client_tool { runId, callId, name, args }` suspende el run.
- `POST /assistant/runs/{runId}/tool-results { callId, result }` lo reanuda.
- Un TTL y el error `tool_timeout`.
- Un límite de 30 herramientas de cliente por run, como red de seguridad junto al del cliente.
- El system prompt describe las herramientas de cliente y la regla de no decir que algo está hecho sin un resultado que lo confirme.
- Telemetría: el resultado de cada herramienta (`ok`, `rejected`, `declined`, `gone`), como hace `copilotTelemetry.ts`.

**Frontend**
- `ToolRegistryService`, `StepLimiter` y `page-context.ts`.
- El nuevo caso `client_tool` en `streamTurn`.
- `stop()` también cancela el run en el backend (`DELETE /runs/{runId}`).

**Contrato**
- Documentarlo en `doc/assistant-frontend.md` (`assistant-contract`) y en `doc/mascota-frontend.md` (`mascota-contract`).

**Hecho cuando:** una herramienta de prueba (`echo`) va y vuelve en el mismo turno, y el modelo responde con su resultado.

### Fase 1 — Formularios con resultado (F 2 sem · B 0,5 sem)

- Las 15 surfaces actuales se exponen como `fill_<id>`, cada una con su JSON Schema derivado del descriptor (`toJsonSchema`).
  - El resultado incluye `written`, `rejected` (con su motivo) y `missing_required`.
  - Antes de escribir se vuelve a leer la surface montada, porque puede haberse desmontado.
- `open_<id>` sustituye a `OPEN_DIALOG`, esperando hasta 3 s a que el formulario se registre.
- `navigate` sustituye a `NAVIGATE`. Usa la lista blanca de `routes.ts` y responde cuando la pantalla ya se ha montado, con una espera de entre 250 ms y 2 s.
- `edit_<id>` sirve para textos largos: notas de cita, observaciones, anamnesis y descripción de plantilla.
- `pageContext` incluye los valores actuales de los formularios abiertos, para que `edit_` copie el fragmento exacto.
- `pendingAction` se mantiene para las escrituras sin formulario en pantalla.
- Se retiran `HIGHLIGHT` y `OPEN_DIALOG` del backend cuando el frontend antiguo ya no exista.

**Hecho cuando** la mascota hace esto sin tarjeta de confirmar:
> «Crea una cita para Ana el martes a las 10 y anota que trae analítica»

1. Navega.
2. Abre el diálogo.
3. Rellena.
4. Ve que falta el tipo de cita.
5. Pregunta por él (con la fase 2).

### Fase 2 — Señalar, preguntar y pulsar (F 2 sem · B 0,5 sem)

- **`ask_user`** muestra de 2 a 6 opciones cortas en la burbuja o barra. La mascota se queda donde estaba con la mirada de espera, y el turno espera la respuesta. Si la persona pulsa Guardar en el formulario, eso también cuenta como respuesta.
- **`point_at`** señala un elemento con el cursor de la mascota. Solo vale para elementos marcados con `data-mascot-point` o para campos de una surface.
- **`show_around`** hace un tour de hasta 6 paradas, de 2,6 s cada una, y se puede pausar.
- **`press`** pide confirmación antes de pulsar. El modelo aporta la `question` y el verbo del botón de «Sí, …», y la puerta está en el código, no en el prompt.
  - Solo se pueden pulsar controles con `data-mascot-point`.
  - Si `isDangerous` (borrar, descartar o cancelar), la tarjeta lo advierte.
  - Si la aplicación abre su propio diálogo de confirmación, la mascota **no** lo pulsa. Devuelve `opened_dialog` y esa confirmación queda en manos de la persona.
- **Acciones propias por pantalla** (`registerAction`). Ejemplos: «marcar cita como realizada», «duplicar menú» y «activar recordatorios».
- **Marcado:** añadir `data-mascot-point` a los controles útiles de agenda, ficha de paciente, menús y ajustes. Hoy solo hay 13 `data-mascot-field` en tres pantallas.

### Fase 3 — Guardar con confirmación (F 1,5 sem · B 0,5 sem)

**Cambio de producto.** Hoy `PRODUCT.md` y `assistant-module` dicen «el usuario siempre confirma y guarda». La nueva regla es: **la mascota puede pulsar Guardar solo después de un «sí» explícito en su propia tarjeta**. El backend sigue validando, y los permisos y guards no cambian. Hay que actualizar los dos specs.

- **`save_<id>`** (`copilotSave.ts`):
  1. Busca el botón con `data-mascot-submit="<id>"`, o con heurística dentro del formulario o del diálogo.
  2. Señala el botón y pregunta, con un resumen de lo que se va a guardar.
  3. Pulsa solo si la respuesta es sí.
  4. Vigila durante 4 s si el diálogo se cerró, si apareció un error o si el botón quedó deshabilitado sin `aria-busy`.
  5. Responde `{ saved, errors[] }`.
- **`onPersonSave`**: si la persona pulsa Guardar mientras se le pregunta, eso es un «sí» ya ejecutado.
- **Exclusiones**: no hay `save_` en formularios sensibles. La lista inicial es el estado clínico, la baja de un paciente y la configuración de facturación y precios. Se marcan en el descriptor con `noSave: true`.
- **Tests**: el botón no se pulsa sin confirmación, no se atraviesan diálogos de confirmación y no hay `save_` donde se marcó `noSave`.

### Fase 4 — Barra inferior (F 3 sem)

La barra sustituye al panel flotante. Su diseño se valida antes con un mockup HTML en `.thinkrail/context/mockups/`.

- **Barra:** se ancla abajo y en el centro, encima de la `bottom-nav` en móvil. La mascota se acopla en su extremo izquierdo, lo que mantiene la regla de una sola mascota.
- **Línea de estado (`stripKind`):** prioridad `confirm` > `choice` > `paused` > `acting` > `thinking` > `reply`. Muestra «Paso n» con el contador de herramientas. Las tarjetas de `ask_user`, `press` y `save_` viven aquí.
- **Entrada:** acepta adjuntos y soltar archivos sobre la mascota, conserva los borradores que dejan tips y ofertas, y sustituye el envío por «Detener» mientras trabaja.
- **Bandeja de lectura:** las respuestas largas, a partir de unos 120 palabras o con títulos, se abren en una bandeja con secciones numeradas (`readingDoc`). El historial completo pasa a ser una vista secundaria de la bandeja.
- **Cola:** lo que se escribe mientras la mascota trabaja se pone en cola, se puede quitar y tiene la opción «Hacer ahora», que corta y envía.
- **Pausa:** «Pausar» detiene la animación y las herramientas en la siguiente frontera (`whenResumed`). Reanudar continúa el run.
- **Diálogos de Taiga:** la barra debe seguir siendo usable con un diálogo abierto, sin caer en la trampa de foco.

### Fase 5 — Vida y encanto (F 2 sem)

- **Seguir entre pantallas** (`mascotFollow`): al cambiar de sección mira la entrada del menú, se agacha y salta cuando la página entra. Respeta `prefers-reduced-motion`.
- **Velo de ruta** (`CopilotRouteVeil`): cuando `navigate` cambia de pantalla, un fundido corto (`COVER_MS`/`REVEAL_MS`) para que no parezca un salto.
- **Colocación** (`placement.ts`, `useToastClearance`): no tapa toasts, diálogos ni el campo en el que trabaja.
- **Filas en cascada** (`insertReveal`) y la marca de «escrito por la mascota» (`writtenMark`) en los campos y filas que ha tocado, hasta que la persona los edita.
- **Primeros pasos** (`firstSteps`): la primera vez, tres ofertas concretas de la clínica: crear una cita, registrar una medición y generar un menú. Cada una escribe el borrador y no lo envía.
- **Modo héroe** (easter egg): un disfraz por skin y un efecto de poder. Debe ser discreto y desactivable desde preferencias.
- **Secretos de consola** (`window.nuti.*`) y la paloma: solo en entornos no productivos o tras una preferencia, porque la seriedad clínica pesa más.
- **Personalidades por skin**: reacciones diferenciadas en `blush`/`angry`/`cheer`.
- **Descartados:** «llama a la puerta» (`mascotKnock`) y `go_to_app`, porque sif-web no tiene hub de aplicaciones. Tampoco se porta el dictado por voz de `AgentChat`; queda pendiente para una fase futura.

### Fase 6 — Retirada del modelo antiguo (F 0,5 sem · B 0,5 sem)

- Se quitan `uiActions` (`NAVIGATE`, `OPEN_DIALOG`, `HIGHLIGHT`; `TOAST` puede quedarse como evento SSE) y el panel flotante.
- Se revisan las `pendingAction` que ya tengan surface. La tarjeta de confirmar solo se queda donde no hay formulario.
- Se actualizan los specs (`assistant-module`, `assistant-contract`, `mascota-contract`, `PRODUCT.md`) y se marca este plan como hecho.

---

## 4. Calendario resumido

| Fase | Frontend | Backend | Depende de |
|---|---|---|---|
| 0 Contrato y base | 1 sem | 2 sem | — |
| 1 Formularios con resultado | 2 sem | 0,5 sem | 0 |
| 2 Señalar, preguntar y pulsar | 2 sem | 0,5 sem | 1 |
| 3 Guardar con confirmación | 1,5 sem | 0,5 sem | 2 (usa la tarjeta de `ask`/`press`) |
| 4 Barra inferior | 3 sem | — | 2; puede empezar en paralelo a la 3 |
| 5 Vida y encanto | 2 sem | — | 4 (la colocación depende de la barra) |
| 6 Retirada | 0,5 sem | 0,5 sem | 1–5 |
| **Total** | **≈ 12 sem** | **≈ 4 sem** | |

---

## 5. Riesgos y decisiones abiertas

1. **El estado del run en el backend.** Suspender un run que espera al navegador exige guardarlo. Si hay varias instancias de backend, hace falta Redis o sesiones pegajosas. Se decide en la fase 0.
2. **El coste de los tokens.** Las herramientas de cliente y el `pageContext` (hasta 22 000 caracteres) se envían en cada turno, y Gemini cobra por entrada. Hay que medirlo en la fase 0 y bajar el presupuesto si hace falta.
3. **Guardar con confirmación cambia una regla de producto.** Necesita aprobación explícita del responsable de producto antes de la fase 3, y una lista cerrada de los formularios excluidos.
4. **Marcar el DOM.** El valor de `point_at`, `press` y `show_around` depende de cuántos controles se marquen. Sin ese marcado las herramientas existen, pero no encuentran nada. Hay que repartir el trabajo por feature.
5. **Accesibilidad.** La barra, las tarjetas y la cola necesitan foco gestionado, `aria-live` y teclado completo. Las animaciones deben respetar `prefers-reduced-motion`, como ya hace el orbe.
6. **Pacientes.** Hoy el asistente es solo para staff (`roleAllowed`). Este plan no lo abre a pacientes.

---

## 6. Lo que fija el backend (contrato B0–B3)

El backend ya está implementado. Donde contradice a las secciones anteriores, manda esto.

**Transporte**
- **No hay endpoint `/runs` nuevo.** `clientTools` y `pageContext` viajan en el cuerpo de `POST .../messages/stream`. El endpoint bloqueante los ignora, así que sin streaming no hay herramientas.
- **Eventos SSE:** `delta`, `tool`, `client_tool { runId, callId, name, args }`, `ping` (cada 20 s; hay que ignorarlo), `done`, `stopped { runId }` y `error`. El `runId` llega por primera vez con el primer `client_tool`.
- **Resultado:** `POST .../assistant/runs/{runId}/tool-results { callId, result }`. Las respuestas posibles son:
  - `202`: la continuación llega por el SSE abierto.
  - `204`: el resultado llegó duplicado o tarde y se ignora.
  - `404`: el run no existe o caducó.
  - Un `result` de más de 16 KB se recorta.
- **Detener:** `DELETE .../assistant/runs/{runId}` (`204`) y después llega `stopped`. Cerrar el SSE tiene el mismo efecto.
  - Para `MascotStateService.stop()`: si ya hay `runId`, hace `DELETE`; si aún no lo hay, basta con cerrar el SSE, que es lo que hace hoy.
- **Turno colgado:** `GET /sessions/latest` puede traer `pendingRunId`. Hay que hacerle `DELETE` antes de enviar otro mensaje, porque no se puede reconectar a un turno en curso.

**Catálogo (`ClientToolValidator`).** Lo que no cumple estas reglas se descarta **sin aviso**:
- Prefijos permitidos: `fill_`, `edit_`, `open_`, `save_` y `action_`. Nombres sueltos permitidos: `point_at`, `show_around`, `press`, `ask_user`, `navigate` y `echo` (sonda para la fase 0).
- **Formato del nombre `^[a-z][a-z0-9_]{2,48}$`: no admite guiones.** Los ids actuales de las surfaces (`patient-profile`, `appointment-type`, `menu-rename`…) hay que traducirlos a `_` tanto en el nombre de la herramienta como en `pageContext.forms[].id`.
- Como mucho 40 herramientas por turno.
- **El esquema no puede pasar de 2 KB serializado.** Hay que medirlo con `measurement` (23 campos) y con `patient-profile`: quizá haya que acortar las descripciones o partir el formulario.
- La descripción tiene como mucho 300 caracteres en una sola línea.
- El esquema admite 3 niveles de anidamiento, 60 propiedades por objeto y solo los tipos `object`, `string`, `number`, `integer`, `boolean`, `array`, `enum`, `items`, `required` y `description`.
- Una herramienta que se llame como una de servidor se descarta.
- **Tras `navigate`, el resultado lleva los `clientTools` de la pantalla nueva** (`{ ok, route, clientTools }`).

**pageContext:** `{ route, title, forms: [{ id, title, values }], extras }`.
- Presupuesto de 22 000 caracteres. Primero se recortan los `extras` y después los `forms`, que también tienen tope.
- Un valor de más de 4 000 caracteres se corta.

**Plazos** (los decide el backend según el nombre):
- 60 s para las herramientas mecánicas.
- 15 min para `ask_user`, `press` y `save_`.
- 20 min para el turno completo.
- Al vencer, el modelo recibe `{ ok:false, reason:"tool_timeout" }` y el turno continúa.

**Límites del turno**
- 30 pasos de cliente por turno; al pasarlos el modelo recibe `step_budget_exhausted`.
- La misma llamada con los mismos argumentos tres veces seguidas corta el turno (`repeated_call`).
- La cuota diaria ahora también cuenta tokens: `429 error.assistant_quota_exceeded`.

**Confirmaciones (B2) — cambia la fase 1 y la 3**
- **`confirm_action`** es una herramienta de cliente que **no se declara**: el backend la emite cuando propone una escritura de servidor.
  - Llega con `args { actionId, toolName, summary, question, idempotencyKey, expiresAt, preview[] }`.
  - Se contesta con `{ confirmed: true|false }`.
  - El turno **no se corta**: el modelo lee el desenlace y continúa.
  - La tarjeta `mascot-action-card` pasa a ser la vista de esta herramienta.
  - `/confirm` y `/reject` siguen existiendo y despiertan al turno, con `answeredBy: "card"`.
- **`save_` no tiene lista de exclusiones**, por decisión de producto. Sobra lo de `noSave` de la fase 3. La regla de oro de `mascota-frontend.md` ya dice: «ninguna escritura sin un sí explícito de la persona».
- **Cabecera `X-Assistant-Write: <sessionId>`** en toda escritura (`POST`/`PUT`/`PATCH`/`DELETE`) originada por una herramienta de la mascota. Solo sirve para trazabilidad.
  - Encaja en un interceptor HTTP que la añada mientras se ejecuta un `fill_`, `save_`, `press` o `action_`.
  - `mascotWritesInterceptor` ya observa esas peticiones.

**Historial (B3)**
- Solo dejan fila `fill_`, `edit_`, `save_`, `action_` y `press`, y sin valores: solo el desenlace y los nombres de los campos.
- A partir de 10 pasos, se agrupan en `client_steps_summary`.
- El panel tiene que saber pintar esas filas o filtrarlas.

**Pendiente en el backend:** la B4 (quitar `NAVIGATE`, `OPEN_DIALOG` y `HIGHLIGHT`; `TOAST` se queda). Se hace cuando el frontend termine la fase 6.

---

## 7. Referencias

- alkimia: `src/core/copilot/` (en especial `CopilotToolsBridge.tsx`, `copilotTools.ts`, `copilotSave.ts`, `copilotPress.ts`, `copilotAsk.ts`, `pageContext.ts`, `copilotSteps.ts`, `textEdit.ts`, `insertReveal.ts`, `mascot/bar/*`, `mascot/mascotStore.ts`, `mascot/turn.ts`, `mascot/readingDoc.ts`, `mascot/mascotFollow.ts`, `mascot/placement.ts`, `mascot/mascotHero.ts`). Los ADR que se citan (0087, 0089, 0100) no están en ese repositorio.
- sif-web: `src/app/features/assistant/SPEC.md` (`assistant-module`), `doc/assistant-frontend.md` (`assistant-contract`), `doc/mascota-frontend.md` (`mascota-contract`), `doc/roadmap/plan-chat-mascota/plan-mascota.md`.
