# Mascota — adjuntos en la conversación del asistente

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** [`mascota-frontend.md`](mascota-frontend.md) §5 (sesión y conversación) y [`assistant-frontend.md`](assistant-frontend.md) §3.1 (streaming).
> **De dónde sale:** `mascot-improvement-plan.md` §5.2.8 ("drag & drop de archivos sobre la mascota"). Hoy es inimplementable: el protocolo del asistente es sólo texto.
> **Precedente:** el chat 1:1 ya resolvió esto entero — ver [`chat-frontend.md`](chat-frontend.md) §2.5 y §2.8. **Esta petición es, en lo posible, "lo mismo que el chat".**
> **Fecha:** 2026-11-01.

---

## 1. Qué pasa

Enviar un mensaje al asistente es hoy esto, y nada más:

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages
Content-Type: application/json

{ "content": "..." }
```

Lo mismo en streaming, contra `.../messages/stream`. No hay sitio donde meter un
archivo, ni en el `AssistantMessageDto` que vuelve.

El caso de uso que lo pide es el del nutricionista en consulta: tiene delante
una analítica en PDF o la foto de una báscula de bioimpedancia y quiere soltarla
sobre la mascota en lugar de transcribir doce números a un formulario. La
mascota ya sabe rellenar el formulario de mediciones (`measurement.surface.ts`);
lo que no sabe es de dónde sacar los números si no se los dictas.

El chat 1:1 ya tiene resuelto el camino completo —multipart, validación por
magic bytes, bucket privado de MinIO, URL firmada con TTL y endpoint para
refrescarla—, así que esto no es diseñar nada nuevo: es extender lo que ya
funciona a la otra conversación.

---

## 2. Qué pedimos

### 2.1 Subir el adjunto aparte, no en el mensaje

A diferencia del chat, preferimos **dos pasos** en vez de un `multipart` en el
endpoint de mensajes:

```http
POST /api/tenant/{tenantId}/assistant/sessions/{sessionId}/attachments
Content-Type: multipart/form-data

file: <binario>
```

```json
{
  "attachmentId": "uuid",
  "fileName": "analitica-marzo.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 241533,
  "url": "https://minio.../firmada"
}
```

Y después el mensaje de siempre, con una referencia:

```json
{ "content": "¿Me pasas estos valores a la ficha?", "attachmentId": "uuid" }
```

El motivo es que `/messages/stream` responde `text/event-stream` sobre una
petición JSON; convertirla en `multipart` obliga a tocar el endpoint que más
cuesta y a subir el archivo otra vez si el turno falla. Separándolo, el
streaming no se entera y el archivo se sube una sola vez.

Si al backend le resulta más barato replicar el `multipart` del chat tal cual,
nos vale igual, pero entonces hace falta en **los dos** endpoints de mensajes
(normal y `stream`), no sólo en el normal.

### 2.2 Que el modelo lo lea, no sólo que se guarde

Es la parte importante y la que no se deduce del chat, donde el adjunto es sólo
para que lo mire una persona. Aquí el adjunto **tiene que entrar en el contexto
del turno**: si el backend lo almacena y le pasa al modelo únicamente el texto,
la función no sirve de nada y el usuario recibe un "no puedo ver la imagen"
después de haber subido cinco megas.

Concretamente:

- El adjunto del mensaje va al modelo junto con el texto de ese turno.
- Si el modelo configurado no puede leer ese tipo (por ejemplo, PDF en un modelo
  sin soporte), el backend responde **antes de aceptar la subida**, con
  `error.assistant_attachment_unsupported` (422) y el tipo que sí admite.
- Que quede escrito en el contrato qué tipos lee de verdad el modelo, porque esa
  lista y la lista de tipos que el almacenamiento acepta pueden no ser la misma.

### 2.3 Límites y validación

Partimos de los del chat, con una diferencia:

| | Chat | Asistente (pedido) |
|---|---|---|
| Tipos | JPEG, PNG, WebP | JPEG, PNG, WebP **y PDF** |
| Tamaño | 5 MB | 10 MB |
| Por mensaje | 1 | 1 |
| Validación | magic bytes | magic bytes |

El PDF es el caso real: las analíticas llegan así. Si admitirlo complica el
almacenamiento o el modelo, preferimos **PDF antes que WebP**.

Los 10 MB son por el PDF escaneado, que pesa más que una foto. Si es un problema,
con 5 MB empezamos igual.

### 2.4 Qué devuelve el mensaje

El `AssistantMessageDto` del turno lleva el adjunto, con la misma forma que el
chat:

```json
{
  "id": "uuid",
  "role": "USER",
  "content": "¿Me pasas estos valores a la ficha?",
  "attachment": {
    "id": "uuid",
    "fileName": "analitica-marzo.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 241533,
    "url": "https://minio.../firmada"
  },
  "createdAt": "2026-11-01T10:10:00Z"
}
```

- `attachment` es `null` en todos los mensajes que no lo tengan, incluidos los
  del asistente.
- La URL es firmada, con el mismo TTL que el chat (10 minutos), y se refresca
  igual:
  `GET /api/tenant/{tenantId}/assistant/attachments/{attachmentId}/url`.
- Al recuperar el historial (`GET .../messages`) los adjuntos vienen con URL
  fresca, como en el chat.

### 2.5 Aislamiento y retención

- El adjunto vive bajo su tenant y su sesión. Sólo lo lee quien es dueño de esa
  sesión; otro usuario del mismo centro recibe 404, no 403.
- **Se borra con la sesión.** `DELETE /assistant/sessions/{sessionId}` se lleva
  por delante los objetos de MinIO asociados, y la caducidad de la sesión
  también. Son datos clínicos de un paciente concreto en un chat efímero: no
  deben sobrevivir a la conversación.
- Si la sesión tiene `subjectUserId`, el adjunto hereda ese sujeto para que
  cualquier auditoría posterior sepa de qué paciente era el PDF.

### 2.6 Errores nuevos

| Código | HTTP | Cuándo |
|---|---|---|
| `error.assistant_attachment_too_large` | 413 | Supera el límite de §2.3. |
| `error.assistant_attachment_unsupported` | 422 | Tipo no admitido, o admitido por el almacenamiento pero ilegible por el modelo. |
| `error.assistant_attachment_not_found` | 404 | `attachmentId` inexistente, de otra sesión o ya caducado. |

---

## 3. Cómo se comprueba que está hecho

1. `POST .../sessions/{id}/attachments` con un JPEG de 1 MB devuelve
   `attachmentId` y una URL que abre la imagen en el navegador.
2. Un mensaje con ese `attachmentId` vuelve con `attachment` relleno, y el
   historial lo sigue trayendo con URL fresca al recargar.
3. Lo mismo con `/messages/stream`: el turno con adjunto llega por SSE sin
   romperse.
4. **La prueba que cierra la petición:** subir la foto de una analítica y pedir
   "pásame estos valores a la ficha de Frink". El asistente propone un
   `pendingAction` de medición con los números **leídos del archivo**. Si
   responde que no puede ver imágenes, §2.2 no está hecho.
5. Un PDF de 12 MB responde 413 antes de subir nada.
6. Borrar la sesión y comprobar que la URL firmada ya no sirve.

---

## 4. Qué hace el frontend mientras tanto

Nada: está bloqueado de principio a fin. El drag & drop sobre la mascota sale
del plan de mejoras hasta que exista §2.1 y §2.2 — dibujar la zona de soltar
antes de que haya dónde enviar el archivo sólo sirve para prometer algo que no
ocurre.

Lo que sí se mantiene es la alternativa que ya funciona: dictarle los valores a
la mascota en texto libre, que desde el asistente v2 ya rellena el formulario de
mediciones.
