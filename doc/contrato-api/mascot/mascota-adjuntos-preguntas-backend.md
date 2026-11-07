# Mascota — dos preguntas antes de implementar los adjuntos

> **Quién pregunta:** frontend (sif-web).
> **Sobre qué:** [`mascota-frontend.md`](mascota-frontend.md) §3.3 y §4.3, y [`assistant-frontend.md`](../assistant/assistant-frontend.md) §3.1.
> **Fecha:** 2026-11-01.
> **Por qué antes y no después:** las dos cambian el diseño del frontend, no el
> acabado. Implementar y luego descubrir la respuesta significa tirar el trabajo.
>
> **✅ RESPONDIDO el 2026-11-01.** Las respuestas, al final del documento (§4).
> El contrato (`mascota-frontend.md` §4.1 y §4.3) ya está corregido con ellas.

Los adjuntos llegaron completos y con detalles que no habíamos pedido y se
agradecen —el tipo validado antes de aceptar la subida, y reenviar al modelo
solo el adjunto más reciente—. Lo que sigue no son pegas: son dos huecos del
contrato que no podemos rellenar adivinando.

---

## 1. ¿El endpoint de streaming acepta `attachmentId`?

El §4.3 justifica la subida en dos pasos diciendo que así «el endpoint de
streaming sigue siendo JSON». Eso da a entender que el turno con adjunto se
manda por streaming como cualquier otro:

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages/stream
Accept: text/event-stream
Content-Type: application/json

{ "content": "¿Me pasas estos valores a la ficha?", "attachmentId": "uuid" }
```

Pero el contrato del stream (`assistant-frontend.md` §3.1) solo documenta
`{ "content": "..." }`, y no dice nada de adjuntos. No sabemos si ese
`attachmentId` se ignora, da un 400, o funciona y falta documentarlo.

**Por qué nos cambia el diseño.** El frontend manda **siempre** por streaming, y
el endpoint bloqueante es el camino de respaldo cuando el stream se corta. Si el
stream no admite adjuntos, hay que invertir esa regla justo para estos turnos:

- Con adjunto → endpoint bloqueante.
- Sin adjunto → streaming.

Y eso se nota: el turno que lleva un PDF es, precisamente, el que más va a
tardar (el modelo tiene que leerlo). Sería el único de la conversación en el que
la mascota se queda muda hasta tener la respuesta entera, que es el peor sitio
para perder los `delta`.

**Lo que necesitamos:** un sí o un no. Si es que sí, una línea en §3.1 con el
cuerpo completo y confirmando que un `attachmentId` inexistente o de otra sesión
responde igual que en el endpoint bloqueante (`404
error.assistant_attachment_not_found`), para no tener que tratar dos caminos de
error distintos.

---

## 2. ¿Qué borra exactamente los adjuntos al cerrar la sesión?

El §4.3 dice:

> **Muere con la conversación.** Cerrar la sesión (§3.3) y la expiración
> automática borran también los objetos de MinIO. No hay `DELETE /sessions/{id}`:
> el cierre es ese borrado.

La última frase contradice al §3.3, que documenta exactamente ese endpoint y que
responde `204`. Y el frontend **ya lo llama**.

Caben dos lecturas:

- **(a) Es una errata** y quiere decir «no hay un `DELETE` de adjuntos aparte:
  el borrado va con el cierre de la sesión». Es la que nos parece, pero no es la
  que está escrita.
- **(b) El endpoint se retira.** Entonces hay que decirlo en §3.3 y en las notas
  de migración, porque tenemos código llamándolo.

**Por qué importa más de lo que parece.** El frontend no cierra sesiones solo
cuando la persona lo pide: también **por su cuenta**. Si el nutricionista está
en la ficha de un paciente y abre la de otro, la sesión anterior apuntaba a un
`subjectUserId` que ya no es el correcto, así que se cierra y se abre una nueva
(`MascotStateService.openPanel`, con la comprobación de sesión obsoleta).

Si cerrar la sesión borra los objetos de MinIO, entonces **cambiar de ficha se
lleva por delante el PDF que acabas de subir**, sin avisar y sin que nadie haya
pedido borrar nada. Y es un gesto normalísimo: subo la analítica de Marge, me
acuerdo de algo de Frink, abro su ficha, vuelvo — y el adjunto ya no está.

**Lo que necesitamos saber**, en concreto:

1. ¿Qué dispara el borrado de los objetos: el `DELETE /sessions/{id}`, la
   expiración, o las dos cosas?
2. ¿Sigue existiendo `DELETE /sessions/{id}` tal y como lo documenta §3.3?
3. Si existe y borra adjuntos: ¿nos recomendáis dejar de cerrar la sesión al
   cambiar de ficha —y abrir una nueva sin cerrar la anterior, dejando que
   expire—, o preferís que avisemos a la persona de que va a perder el adjunto?

La tercera es la que de verdad decide nuestro trabajo. Si la respuesta es «no
cerréis», nos vale: solo necesitamos saber que varias sesiones abiertas del
mismo usuario no os estorban.

---

## 3. Mientras tanto

Los adjuntos no se empiezan. No es por falta de ganas: el camino de subida es el
mismo con cualquiera de las respuestas, pero el de envío (§1) y el ciclo de vida
(§2) no, y son justo las dos decisiones que no se pueden cambiar luego sin
rehacerlo. El resto del plan de la mascota ya está entregado.

---

## 4. Las respuestas (2026-11-01)

### 4.1 El stream sí acepta `attachmentId`

No hay dos caminos: `POST .../messages` y `POST .../messages/stream` leen el
mismo cuerpo y acaban los dos en `AssistantConversationService.sendMessage`; lo
único que cambia es el listener. **El frontend no invierte nada**: el turno con
PDF va por streaming como cualquier otro.

Lo que sí cambia es el manejo de errores, y no es menor: en el stream la
respuesta ya salió con `200` cuando el error ocurre, así que lo que en el
bloqueante es un `404` llega como evento `error` con
`code: "error.assistant_attachment_not_found"` —el mismo mecanismo que §3.1 ya
documentaba para `assistant_session_closed`—. Un solo camino de error,
discriminando por `code` y no por estado HTTP.

Y ese código es el mismo para un adjunto inexistente, de otra sesión o de otro
tenant: a propósito. No se distingue "no existe" de "no es tuyo".

### 4.2 Los adjuntos mueren con la sesión, y por eso no se cierra la sesión

1. **Qué los borra:** las dos cosas. `close()` borra los adjuntos de la sesión,
   y el barrido de caducadas (cada 5 min) hace lo mismo. El TTL es de 24 h
   renovables, y cualquier actividad lo reinicia.
2. **`DELETE /sessions/{id}` sigue existiendo** tal y como lo documenta §3.3.
   La frase del §4.3 era una errata: quería decir que no hay un `DELETE` de
   adjuntos aparte.
3. **Dejar de cerrar la sesión al cambiar de ficha**, y no como apaño: las
   sesiones están indexadas por `(tenantId, userId, subjectUserId)`, un `POST`
   con otro paciente no toca la anterior, y no hay límite de sesiones abiertas
   por usuario. Volver a la ficha de antes devuelve **esa misma sesión**, con su
   historial y su PDF. Cerrar y reabrir era perder trabajo a cambio de nada.

Y un aviso que agradecemos, porque era un fallo nuestro: el `subjectUserId` de
una sesión **también lo mueve la mascota** con `set_active_patient` cuando
alguien nombra a otro paciente sin abrir su ficha. El paciente activo es estado
del backend, así que la comprobación de sesión obsoleta tiene que mirar lo que
dice la sesión, no lo que el frontend creía al crearla.

### 4.3 Qué hizo el frontend con esto

- Ya **no se cierra la sesión** al cambiar de ficha (`MascotStateService.openPanel`):
  se suelta la local y `ensureSession` trae la del paciente de ahora. El
  `DELETE` queda para un "cerrar esta conversación" deliberado, que todavía no
  existe en la interfaz.
- La comprobación de sesión obsoleta mira el paciente activo que haya movido la
  mascota, no el de la creación.
- Queda pendiente implementar los adjuntos, ya sin nada que los bloquee.
