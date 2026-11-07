# Asistente — retirar `uiActions` (fase B4)

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** el contrato vigente en [`assistant-frontend.md`](assistant-frontend.md) §4 y §5.
> **Estado: CERRADA (2026-11-07).** El backend aplicó los pasos 1 y 2 en la misma entrega, y
> el frontend el paso 3. El §6 queda como recordatorio de por qué el orden importaba.
> **Fecha:** 2026-11-07 (corregido el mismo día).

---

## 1. Qué pedimos

Que el backend deje de emitir tres de los cuatro tipos de `uiAction`, y que la propuesta de
escritura (`pendingAction`) deje de dar por supuesto que el navegador va a rellenar un
formulario por su cuenta.

| Qué | Qué pedimos | Por qué |
|---|---|---|
| `uiActions[].type = "NAVIGATE"` | Dejar de emitirlo | Lo hace el modelo con la herramienta de cliente `navigate`, **y recibe si salió bien** |
| `uiActions[].type = "OPEN_DIALOG"` | Dejar de emitirlo | Lo hace con `open_<id>`, que además devuelve el catálogo de lo que se puede hacer ya abierto |
| `uiActions[].type = "HIGHLIGHT"` | Dejar de emitirlo | Lo hace con `point_at`, que devuelve si el control estaba |
| `uiActions[].type = "TOAST"` | **Se queda** | No tiene equivalente: es el backend avisando, no la mascota actuando |

## 2. Por qué, en una frase

Un `uiAction` se manda a ciegas: el modelo no se entera de si el formulario se abrió, de si
el campo existía ni de si la pantalla llegó a cambiar. Las herramientas de cliente hacen lo
mismo y **devuelven el resultado dentro del mismo turno**, que es lo que le permite
corregirse en vez de insistir.

## 3. Lo que el frontend ya no hace

Desde F8, con una `pendingAction` el frontend **sólo enseña la tarjeta**. Ya no sale a buscar
el formulario adivinando su pantalla desde el nombre de la tool, ni lo abre, ni lo rellena,
ni retira la acción por su cuenta. Eso sí es independiente del backend.

Lo de `uiActions` NO: sigue atendiéndose entero. Ver §6.

## 4. Lo único que sí necesitamos conservar

`params.patientId` en los `uiActions` es **el único sitio del contrato** por el que el
frontend se entera de qué paciente tiene el backend por activo. Si se retiran los
`uiActions` de navegación sin más, perdemos ese dato.

Pedimos una de estas dos, la que al backend le resulte más natural:

1. Que `AssistantTurnResponse` lleve el paciente activo del turno (por ejemplo
   `subjectUserId`, como ya hace la sesión), **o**
2. que el `TOAST` conserve `params.patientId` cuando lo haya.

Sin esto, la mascota pierde el hilo de con quién está trabajando en una conversación que
cambia de paciente.

## 5. Cómo lo probamos

El frontend tiene cobertura de que lo retirado ya no se usa; lo que no podemos probar desde
aquí es el emisor. Cuando la B4 esté, basta con una conversación real que antes mandaba
`NAVIGATE`: la mascota tiene que llegar igual a la pantalla, pero llamando a `navigate`.

---

## 6. Por qué hay que coordinarlo (nos equivocamos)

La primera versión de este documento decía que el frontend ya podía ignorar los `uiActions`
de navegación y que el backend podía retirarlos cuando quisiera. **Es falso, y lo probamos
rompiéndolo.**

`navigate_to`, `navigate_to_patient`, `open_dialog` y `highlight_field` son **tools de
servidor** (§7 del contrato). Su único efecto sobre el navegador es el `uiAction` que el
backend emite al ejecutarlas. Si el frontend deja de atenderlo:

- el modelo llama a `navigate_to_patient`,
- el backend se la da por ejecutada,
- el navegador no hace nada,
- y el modelo responde **«¡Listo! Ya tienes abierta la ficha de Homer Simpson»** con la
  pantalla sin moverse.

Lo retiramos, pasó exactamente eso, y lo hemos devuelto. El frontend vuelve a atender
`NAVIGATE`, `OPEN_DIALOG` y `HIGHLIGHT`.

### El orden correcto

1. **Backend:** retira esas cuatro tools del catálogo del modelo, de forma que sólo pueda
   navegar y abrir por las herramientas de cliente (`navigate`, `open_<id>`, `point_at`),
   que además le devuelven si salió bien.
2. **Backend:** deja de emitir los `uiActions` correspondientes.
3. **Frontend:** retira el código que los atiende.

Entre el 1 y el 3 no se rompe nada: si llega un `uiAction` se sigue atendiendo, y si no
llega, no hace falta.
