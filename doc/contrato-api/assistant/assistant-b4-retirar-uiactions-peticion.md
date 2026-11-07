# Asistente — retirar `uiActions` (fase B4)

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** el contrato vigente en [`assistant-frontend.md`](assistant-frontend.md) §4 y §5.
> **Estado:** pendiente en el backend. **El frontend ya está listo**: desde la fase F8 no
> consume nada de lo que aquí se pide retirar, así que el backend puede dejar de mandarlo
> cuando quiera, sin coordinar despliegues.
> **Fecha:** 2026-11-07.

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

Desde F8, `MascotStateService`:

- de `uiActions` sólo atiende `TOAST` (y lee `params.patientId`, ver §4);
- con una `pendingAction` **sólo enseña la tarjeta**. Ya no sale a buscar el formulario
  adivinando su pantalla desde el nombre de la tool, ni lo abre, ni lo rellena, ni retira
  la acción por su cuenta.

Nada de esto necesita que el backend cambie primero: lo que siga llegando se ignora.

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
