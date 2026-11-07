# Asistente — el streaming pierde un espacio en cada corte

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** `POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages/stream`
> ([`assistant-frontend.md`](assistant-frontend.md) §3.1).
> **Gravedad:** visible para cualquier usuario en cada respuesta de más de una línea, y **queda
> guardado así en la base de datos**.
> **Fecha:** 2026-11-07.

---

## 1. Qué pasa

Las respuestas de la mascota salen con palabras pegadas:

> «**Te**ayudo a buscar pacientes…»
> «**Para**crear una plantilla de menú, vas a la sección de Menús **en**el menú principal…»
> «Tu próximo**p**aciente es Homer Simpson, con quien tienes una cita el lunes 9 de
> **noviembre**a las 10:00.»

Otros casos recogidos de la misma conversación: «paraqué», «generaruno», «elcentro»,
«cualquierpaciente», «telo genere», «configurarlos».

## 2. No es del frontend

Capturamos el cuerpo crudo de la respuesta SSE. Este es, literal, el turno de
«Cuéntame en una frase qué puedes hacer»:

```text
event:delta
data:{"text":"Te"}

event:delta
data:{"text":"ayudo a buscar pacientes, gestionar citas, consultar medidas, crear menús y configurar"}

event:delta
data:{"text":"los horarios y festivos del centro."}

event:done
data:{"assistantMessage":{...,"content":"Teayudo a buscar pacientes, gestionar citas, consultar medidas, crear menús y configurarlos horarios y festivos del centro.",...},"pendingAction":null,"uiActions":[]}
```

Dos cosas se ven ahí:

1. **El espacio no viene en ningún `delta`.** El primero acaba en `"Te"` y el segundo empieza
   en `"ayudo"`; entre los dos no hay nada. Lo mismo entre `"configurar"` y `"los"`. El
   navegador concatena fielmente lo que recibe.
2. **El `done` del mismo turno ya trae el defecto.** Su `assistantMessage.content` dice
   `"Teayudo…"` y `"configurarlos…"`. Ese campo lo monta el backend, no sale de concatenar
   nuestros `delta`, así que el fallo está **antes de persistir**: el mensaje se guarda roto
   y vuelve roto al recargar el historial.

## 3. Nuestra hipótesis

El troceado del stream parece partir por palabras y **consumir el separador** en vez de
incluirlo en uno de los dos lados. Es el patrón típico de un `split(" ")` o de un tokenizador
cuyo delimitador no se vuelve a emitir.

Conviene mirar dónde se parte el texto que llega de Gemini antes de emitir cada `delta`, y
comprobar que la concatenación de todos los `delta` es **idéntica carácter a carácter** al
texto original. Un test de propiedad vale: trocear y volver a unir tiene que devolver lo mismo.

## 4. Lo que hace el frontend, por si acaso

El parser cumple el formato SSE y no toca el contenido. Lo único que recorta es el espacio
opcional tras los dos puntos, que es del formato y no del dato
(`src/app/core/api/services/assistant-stream.ts`):

```ts
// Un solo espacio tras los dos puntos es del formato, no del dato.
const value = colon === -1 ? '' : line.slice(line[colon + 1] === ' ' ? colon + 2 : colon + 1);
```

Después, `JSON.parse` sobre el `data` y se usa `payload.text` tal cual. Si un `delta` llegara
como `data:{"text":" ayudo"}` —con su espacio dentro de la cadena JSON— el espacio se
conservaría.

## 5. Un detalle que NO es un fallo

El backend emite `event:delta` y `data:{...}` **sin espacio tras los dos puntos**. Es válido:
el espacio tras `:` es opcional en SSE. Lo decimos sólo para que no se persiga por ahí.

## 6. Cómo sabremos que está arreglado

Una respuesta larga (tres o más `delta`) que se lea sin palabras pegadas, y su
`assistantMessage.content` en el `done` igual de limpio.
