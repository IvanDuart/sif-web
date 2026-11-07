# Solape de citas permitido para el nutricionista

## 1. Resumen

Hasta ahora el backend **bloqueaba cualquier solapamiento** entre citas de un mismo
nutricionista (por ejemplo, una cita de 11:00 a 11:30 impedía crear otra a las 11:20).

A partir de este cambio, el **nutricionista (staff)** puede decidir explícitamente
**permitir el solape**. El **paciente mantiene la lógica actual**: si su cita se solapa
con otra del nutricionista, sigue recibiendo `409 Conflict`.

La decisión se envía desde el frontend mediante un nuevo campo opcional **`allowOverlap`**
en los endpoints de **crear** y **reagendar** cita.

---

## 2. Regla de negocio

| Quién llama | `allowOverlap` | Resultado |
|---|---|---|
| Staff / nutricionista (`MANAGE_APPOINTMENTS`) | `false` u omitido | Se bloquea el solape → `409` |
| Staff / nutricionista (`MANAGE_APPOINTMENTS`) | `true` | **Se permite el solape** |
| Paciente | `false` u omitido | Se bloquea el solape → `409` |
| Paciente | `true` | **Se ignora** el campo → `409` si hay solape |

> El campo `allowOverlap` **solo tiene efecto si el usuario autenticado tiene el permiso
> `MANAGE_APPOINTMENTS`** en el tenant. Un paciente no puede saltarse la validación aunque
> envíe `allowOverlap: true`.

Todo lo demás sigue igual: se mantienen las validaciones de horario del centro, festivos,
estado de la cita, etc. `allowOverlap` **solamente** afecta a la validación de solapamiento
con otras citas del mismo nutricionista.

---

## 3. Cambios en la API

### 3.1 Crear cita

```http
POST /tenant/{tenantId}/appointments
Content-Type: application/json
```

**Nuevo campo en el body:**

| Campo | Tipo | Obligatorio | Por defecto | Descripción |
|---|---|---|---|---|
| `allowOverlap` | `boolean` | No | `false` | Permite crear la cita aunque se solape con otra del mismo nutricionista. Solo efectivo para staff. |

**Body completo de referencia:**

```json
{
  "nutritionistId": "uuid-del-nutricionista",
  "patientId": "uuid-del-paciente",
  "patientName": null,
  "startTime": "2026-07-01T11:20:00Z",
  "endTime": "2026-07-01T11:50:00Z",
  "typeId": "uuid-del-tipo-de-cita",
  "notes": "Cita solapada intencionadamente",
  "allowOverlap": true
}
```

---

### 3.2 Reagendar cita

```http
PATCH /tenant/{tenantId}/appointments/{appointmentId}
Content-Type: application/json
```

**Nuevo campo en el body:**

| Campo | Tipo | Obligatorio | Por defecto | Descripción |
|---|---|---|---|---|
| `allowOverlap` | `boolean` | No | `false` | Permite mover la cita a un tramo que se solape con otra del mismo nutricionista. Solo efectivo para staff. |

**Body de ejemplo:**

```json
{
  "startTime": "2026-07-01T11:20:00Z",
  "endTime": "2026-07-01T11:50:00Z",
  "allowOverlap": true
}
```

**La respuesta de ambos endpoints no cambia**: sigue devolviendo el objeto `AppointmentDto`
completo.

---

## 4. Errores

El único error relacionado con el solape sigue siendo el mismo:

| HTTP | Clave | Mensaje |
|---|---|---|
| `409 Conflict` | `error.appointment_overlap` | `The nutritionist already has an appointment in that time slot` |

Se devuelve cuando **no** se permite el solape (paciente, o staff sin `allowOverlap: true`).

---

## 5. Flujo recomendado en el frontend

1. El nutricionista elige fecha/hora y guarda la cita **sin** enviar `allowOverlap`
   (o enviándolo a `false`), que es el comportamiento actual.
2. Si el backend responde **`409` con `error.appointment_overlap`**, mostrar al nutricionista
   un diálogo de confirmación del tipo:
   > "Ya tienes otra cita en ese horario. ¿Quieres agendarla igualmente en paralelo?"
3. Si el nutricionista **confirma**, repetir la misma llamada añadiendo `"allowOverlap": true`.
4. Si **cancela**, no se hace nada (o se le pide elegir otro horario).

De esta forma el solape siempre es una **decisión explícita** del nutricionista y nunca
un efecto accidental.

```text
POST /appointments  ──> 201 Created
                    │
                    └─> 409 error.appointment_overlap
                              │
                    ¿El usuario es staff? ──no──> mostrar error (no se puede solapar)
                              │ sí
                        mostrar diálogo de confirmación
                              │
                    POST /appointments { ..., allowOverlap: true } ──> 201 Created
```

### Consideraciones de UI

- El diálogo de confirmación **solo** debe mostrarse a usuarios con permiso
  `MANAGE_APPOINTMENTS` (staff/nutricionista). El paciente nunca debe ver la opción de
  "solapar", ya que el backend la rechazará igualmente.
- El flag es de un solo uso: no conviene guardarlo en el estado del formulario como
  permanente. Se envía únicamente en el reintento tras la confirmación.
- En el calendario/agenda, si ya se permiten citas solapadas, conviene representar las
  citas en paralelo (por ejemplo, en columnas) para que el solape sea visible.

---

## 6. Archivos modificados (backend)

| Ruta | Cambio |
|---|---|
| `controller/dto/CreateAppointmentRequest.java` | Añadido campo `Boolean allowOverlap` |
| `controller/dto/RescheduleAppointmentRequest.java` | Añadido campo `Boolean allowOverlap` |
| `service/AppointmentService.java` | `create()` y `reschedule()` omiten la validación de solape si el llamador es staff y `allowOverlap = true` |

---

## 7. Compatibilidad

- El campo es **opcional** y su valor por defecto es `false`.
- El frontend y la app móvil actuales siguen funcionando **sin cambios** (se mantiene el
  comportamiento previo de bloquear solapes).
- No requiere migración de base de datos.
