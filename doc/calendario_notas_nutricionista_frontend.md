# Calendario y notas del nutricionista — Guía para frontend y app móvil

## 1. Resumen

Se añade el módulo de **notas y entradas personales de calendario** para el nutricionista. Hasta ahora su calendario solo podía mostrar citas (`appointment`) y el horario/festivos del centro: no había forma de anotar nada propio ni de marcar "estas horas no estoy disponible".

Cada entrada se crea eligiendo un **tipo**, y ese tipo decide todo su comportamiento:

| `type` | Qué es | ¿Afecta a las citas? |
|--------|--------|----------------------|
| `REMINDER` | Nota o recordatorio personal | **No.** Es puramente informativo |
| `TIME_BLOCK` | Bloqueo de horas | **Sí.** Impide crear o reagendar citas del nutricionista en esa franja |

Tres propiedades transversales del módulo que conviene tener claras antes de integrar:

- **Son privadas de su autor.** No hay forma de ver el calendario de otro profesional, ni siquiera siendo `ADMIN`.
- **El bloqueo es bidireccional.** Ni se puede agendar sobre un bloqueo, ni bloquear sobre una cita ya agendada (ambos casos son forzables, ver §5).
- **No hay recurrencia** en esta versión. Cada entrada es un rango único. Si el usuario quiere "todos los martes", el cliente debe crear N entradas.

**Base URL:** `/api/tenant/{tenantId}/calendar-notes`

---

## 2. Modelo de datos

### `CalendarNoteDto` (respuesta de todos los endpoints salvo `DELETE`)

```json
{
  "id": "3f1a...",
  "tenantId": "9c2b...",
  "nutritionistId": "7e4d...",
  "type": "TIME_BLOCK",
  "title": "Dentista",
  "description": "Revisión anual",
  "startTime": "2026-11-02T10:00:00Z",
  "endTime": "2026-11-02T12:00:00Z",
  "allDay": false,
  "color": "#FF5722",
  "reminderMinutesBefore": 30,
  "remindAt": "2026-11-02T09:30:00Z",
  "reminderSentAt": null,
  "createdAt": "2026-10-17T08:12:44Z",
  "updatedAt": null
}
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | `UUID` | |
| `tenantId` | `UUID` | |
| `nutritionistId` | `UUID` | Autor. Siempre es el usuario autenticado — el backend lo asigna solo |
| `type` | `"REMINDER"` \| `"TIME_BLOCK"` | |
| `title` | `string` | Máx. 255 |
| `description` | `string` \| `null` | Texto libre, sin límite |
| `startTime` | `ISO 8601` (UTC) | |
| `endTime` | `ISO 8601` (UTC) | Nunca es `null`: si no se envía al crear, se copia de `startTime` |
| `allDay` | `boolean` | Marca de presentación, ver §5.3 |
| `color` | `string` \| `null` | Máx. 20. Libre: el backend no lo interpreta ni lo valida como color |
| `reminderMinutesBefore` | `int` \| `null` | `null` = sin aviso push |
| `remindAt` | `ISO 8601` \| `null` | **Derivado**, solo lectura: `startTime - reminderMinutesBefore` |
| `reminderSentAt` | `ISO 8601` \| `null` | **Solo lectura**: cuándo se envió el push. `null` = pendiente |
| `createdAt` | `ISO 8601` | |
| `updatedAt` | `ISO 8601` \| `null` | `null` mientras no se haya editado |

> El DTO **no** usa `@JsonView`: siempre vienen todos los campos, en todos los endpoints.

---

## 3. Endpoints

### 3.1 `POST /tenant/{tenantId}/calendar-notes`

Crea una entrada **para el usuario autenticado**. No se envía `nutritionistId`: aunque se enviara, se ignoraría.

```json
{
  "type": "TIME_BLOCK",
  "title": "Dentista",
  "description": "Revisión anual",
  "startTime": "2026-11-02T10:00:00Z",
  "endTime": "2026-11-02T12:00:00Z",
  "allDay": false,
  "color": "#FF5722",
  "reminderMinutesBefore": 30,
  "allowOverlap": false
}
```

| Campo | Tipo | Obligatorio | Validación |
|-------|------|-------------|------------|
| `type` | `"REMINDER"` \| `"TIME_BLOCK"` | **Sí** | |
| `title` | `string` | **Sí** | No vacío ni solo espacios, máx. 255 |
| `description` | `string` | No | |
| `startTime` | `ISO 8601` | **Sí** | **Se admite el pasado** (a diferencia de las citas) |
| `endTime` | `ISO 8601` | No | Si se omite se copia `startTime`. Obligatorio *de facto* en `TIME_BLOCK` |
| `allDay` | `boolean` | No | Por defecto `false` |
| `color` | `string` | No | Máx. 20 |
| `reminderMinutesBefore` | `int` | No | Debe ser `> 0` |
| `allowOverlap` | `boolean` | No | Ver §5.2 |

**`201 Created`** → `CalendarNoteDto`.

### 3.2 `GET /tenant/{tenantId}/calendar-notes`

Devuelve **solo las entradas propias**, ordenadas por `startTime` ascendente. Array plano, **sin paginar** (igual que `GET /appointments/nutritionist/{id}`).

| Query param | Tipo | Notas |
|-------------|------|-------|
| `from` | `ISO 8601` | Opcional, independiente de `to` |
| `to` | `ISO 8601` | Opcional, independiente de `from` |
| `type` | `"REMINDER"` \| `"TIME_BLOCK"` | Opcional |

```
GET /api/tenant/{tenantId}/calendar-notes?from=2026-11-01T00:00:00Z&to=2026-11-30T23:59:59Z
```

**Importante para pintar el calendario:** el filtro devuelve toda entrada que **toque** el rango, aunque empiece antes o acabe después (`endTime > from AND startTime < to`). Una vacación del 28 de octubre al 5 de noviembre aparece al pedir noviembre. El cliente debe recortar la pintura al rango visible, no asumir que `startTime` cae dentro.

**`200 OK`** → `CalendarNoteDto[]` (puede ser `[]`).

### 3.3 `GET /tenant/{tenantId}/calendar-notes/{noteId}`

**`200 OK`** → `CalendarNoteDto`. **`404`** si no existe *o no es tuya* (ver §5.1).

### 3.4 `PUT /tenant/{tenantId}/calendar-notes/{noteId}`

Actualización **parcial**: todo campo ausente o `null` se deja como estaba.

```json
{
  "startTime": "2026-11-03T10:00:00Z",
  "endTime": "2026-11-03T12:00:00Z"
}
```

Mismos campos que el `POST`, todos opcionales, más uno:

| Campo | Tipo | Notas |
|-------|------|-------|
| `clearReminder` | `boolean` | `true` **elimina** el aviso push |

> **Cuidado con el aviso push.** Como `null` significa "no tocar", no se puede quitar un recordatorio enviando `reminderMinutesBefore: null`. Hay que enviar `clearReminder: true`. Enviar ambos a la vez hace ganar a `clearReminder`.

Cambiar `type` está permitido (un recordatorio puede convertirse en bloqueo y viceversa), pero entonces se aplican las validaciones del tipo nuevo.

**`200 OK`** → `CalendarNoteDto`.

### 3.5 `DELETE /tenant/{tenantId}/calendar-notes/{noteId}`

Borrado **físico**, no lógico. **`204 No Content`**, sin cuerpo.

---

## 4. Permisos

| Permiso | Endpoints | Roles |
|---------|-----------|-------|
| `MANAGE_CALENDAR_NOTES` | `POST`, `PUT`, `DELETE` | `ADMIN`, `NUTRITIONIST` |
| `VIEW_CALENDAR_NOTES` | `GET` (ambos) | `ADMIN`, `NUTRITIONIST` |

Los pacientes (`USER`) **no tienen ninguno de los dos**: para ellos todos estos endpoints responden `403`. No hay que mostrarles la sección de calendario personal.

Ambos permisos llegan en `GET /users/me` por la ruta de siempre, `memberships[].role.permissions[].code` — úsalos para decidir si pintar el módulo.

---

## 5. Reglas de negocio

### 5.1 Privacidad: cada uno ve solo lo suyo

El permiso abre el endpoint, pero **la pertenencia decide las filas**. El backend resuelve el autor desde el JWT y filtra siempre por él:

- `GET` lista → solo las entradas cuyo `nutritionistId` es el del usuario autenticado.
- `GET`/`PUT`/`DELETE` por id → si la entrada es de otro profesional, responde **`404`, no `403`**, para no revelar que existe.

Un `ADMIN` tiene su propio calendario personal, pero **no** ve el de los demás. No existe endpoint para consultar el calendario de otro nutricionista, ni es posible pasando su id.

### 5.2 El bloqueo funciona en los dos sentidos

**(a) Agendar sobre un bloqueo.** `POST /appointments` y `PATCH /appointments/{id}` (reagendar) comprueban ahora los `TIME_BLOCK` del nutricionista, además del solape con otras citas:

```
409 Conflict  →  "El nutricionista ha bloqueado esa franja horaria"
```

El staff puede saltárselo enviando `allowOverlap: true` en el body de la cita — es el **mismo flag** que ya existía para solapar citas, no uno nuevo, y cubre ambas comprobaciones a la vez. El paciente **no** puede: si no tiene `MANAGE_APPOINTMENTS`, su `allowOverlap` se descarta en el backend aunque lo envíe. Esto vale también para las citas `PROPOSED` que solicita el propio paciente.

**(b) Bloquear sobre una cita ya agendada.** Al crear o editar un `TIME_BLOCK` que pisa una cita `SCHEDULED` del propio nutricionista:

```
409 Conflict  →  "El bloqueo se solapa con una cita ya agendada"
```

Forzable con `allowOverlap: true` en el body de la nota. El caso de uso real es "me ha surgido algo, bloqueo la tarde aunque tenga pacientes, ya les llamo" — por eso se permite forzar, pero nunca en silencio.

Detalles que afectan al cliente:
- Solo cuentan las citas en estado **`SCHEDULED`**. Una cita `PROPOSED`, `CANCELLED` o `NO_SHOW` no impide bloquear.
- Dos `TIME_BLOCK` **sí** pueden solaparse entre sí: es inofensivo y no se valida.
- El solape usa intervalo semiabierto: una cita que termina exactamente a las 10:00 **no** choca con un bloqueo que empieza a las 10:00.
- Un `TIME_BLOCK` **no** se valida contra el horario del centro ni los festivos: justamente sirve para marcar ausencias fuera de lo previsto.

### 5.3 Día completo y zonas horarias

`allDay` es una **marca de presentación**, no cambia el cálculo de nada: el solapamiento se sigue calculando con `startTime`/`endTime`.

El backend trabaja en UTC y **no normaliza** el rango (política general del proyecto: la conversión horaria es del cliente). Al marcar "todo el día", el cliente debe enviar el rango completo del día **ya resuelto en la zona del usuario**:

```jsonc
// "Todo el día del 2 de noviembre" para un usuario en Europe/Madrid (UTC+1)
{
  "allDay": true,
  "startTime": "2026-11-01T23:00:00Z",
  "endTime":   "2026-11-02T23:00:00Z"
}
```

Si se envía `00:00Z–23:59Z`, el bloqueo quedará desplazado una o dos horas respecto a lo que ve el usuario, y bloqueará franjas equivocadas.

### 5.4 Aviso push

Si se envía `reminderMinutesBefore`, el backend calcula `remindAt = startTime - reminderMinutesBefore` y un job **envía un push al propio nutricionista** a esa hora. El push llega por OneSignal, igual que los recordatorios de cita.

- El job se ejecuta **cada 5 minutos**, así que el aviso puede llegar con hasta ~5 min de retraso. No sirve para avisos al minuto exacto.
- Avisos con más de **1 hora** de retraso se descartan (p. ej. si el servicio estuvo caído). No llegará una avalancha de pushes atrasados.
- **Mover la entrada rearma el aviso**: al cambiar `startTime` o `reminderMinutesBefore`, se recalcula `remindAt` y `reminderSentAt` vuelve a `null`.
- El texto del push se localiza según el `language` del usuario y la hora se formatea en su `timezone`:
  - `es` → título `"Recordatorio de agenda"`, cuerpo `"<título> a las HH:mm"`
  - `en` → título `"Calendar reminder"`, cuerpo `"<título> at HH:mm"`
- `reminderSentAt != null` significa que ya se envió. Es solo informativo; no hace falta mostrarlo.

El aviso funciona con **cualquier** `type`, también en un `TIME_BLOCK`.

---

## 6. Errores

Todos los errores de negocio siguen el contrato del proyecto: **`{ "error": "<mensaje>" }`**.

| HTTP | Mensaje (es) | Cuándo |
|------|--------------|--------|
| `400` | `endTime no puede ser anterior a startTime` | Rango invertido |
| `400` | `Un bloqueo de horas debe tener endTime posterior a startTime` | `TIME_BLOCK` de duración cero |
| `403` | `Permiso denegado` | El rol no tiene el permiso (p. ej. un paciente) |
| `404` | `Nota de calendario no encontrada` | No existe **o es de otro profesional** |
| `409` | `El bloqueo se solapa con una cita ya agendada` | Crear/editar `TIME_BLOCK` sobre cita `SCHEDULED` |
| `409` | `El nutricionista ha bloqueado esa franja horaria` | **En los endpoints de citas**, al agendar sobre un bloqueo |

> **Dos avisos importantes sobre errores:**
>
> 1. El cuerpo lleva el **mensaje ya traducido**, no una clave estable. El idioma se resuelve por la cabecera `Accept-Language` (por defecto, español). **No hagas matching por el texto**: discrimina por código HTTP y, si necesitas distinguir los dos `409`, por el endpoint que has llamado.
> 2. Los `400` de **validación de formato** (`title` vacío, `type` ausente, `startTime` ausente, `reminderMinutesBefore` ≤ 0) los gestiona Spring, no el manejador de errores del proyecto, así que **no** vienen con la forma `{ "error": ... }` sino con el cuerpo de error por defecto de Spring Boot. Trátalos solo por el código `400`.

---

## 7. Impacto en lo ya existente

**No hay cambios incompatibles.** Ningún DTO ni endpoint previo cambia de forma. Lo único que cambia es el comportamiento de dos endpoints de citas:

| Endpoint | Qué cambia |
|----------|-----------|
| `POST /tenant/{tenantId}/appointments` | Puede devolver un `409` nuevo por franja bloqueada |
| `PATCH /tenant/{tenantId}/appointments/{appointmentId}` | Igual, al reagendar |

Si tu cliente ya gestiona el `409` de solape de citas mostrando el diálogo de "¿forzar de todos modos?", **ese mismo flujo cubre el caso nuevo sin tocar nada**: la respuesta es un `409` y la solución es reenviar con `allowOverlap: true`. Lo único recomendable es afinar el texto del diálogo, porque el motivo ya no es siempre "ya tienes una cita".

El resto del módulo es puramente aditivo: endpoints nuevos, tabla nueva (`calendar_note`), dos permisos nuevos.

---

## 8. Cómo montar la vista de calendario

No existe (ni se añade) un endpoint agregado que devuelva todo junto. La vista se compone en cliente, igual que ya se hacía:

```
GET /appointments/nutritionist/{id}?from&to   →  citas            (ocupado, con paciente)
GET /calendar-notes?from&to                   →  notas y bloqueos (propias)
GET /schedules  +  GET /schedules/assignments →  horario del centro (fondo)
GET /holidays                                 →  festivos          (fondo)
```

Sugerencias de pintado:

- Distinguir visualmente los tres planos: fondo (horario/festivos), bloqueos (`TIME_BLOCK`, franja no disponible) y eventos (citas y `REMINDER`).
- Usar `color` si viene; si no, un color por defecto según `type`.
- Un `REMINDER` con `startTime == endTime` es **puntual**: píntalo como marca/chincheta, no como franja de altura cero.
- Las entradas con `allDay: true` van en la banda superior del día, no en la rejilla horaria.
- Recortar al rango visible: recuerda que la API devuelve entradas que empiezan antes o acaban después (§3.2).

---

## 9. Checklist de integración

- [ ] Leer `VIEW_CALENDAR_NOTES` / `MANAGE_CALENDAR_NOTES` de `GET /users/me` y ocultar el módulo si faltan.
- [ ] Formulario de alta con selector de tipo (recordatorio / bloqueo) como primer campo, ya que condiciona el resto.
- [ ] Exigir `endTime > startTime` en cliente cuando el tipo sea `TIME_BLOCK` (el backend lo rechaza con `400`).
- [ ] Permitir fechas pasadas: **no** reutilizar el validador "fecha futura" de las citas.
- [ ] "Todo el día" → calcular el rango en la zona del usuario y enviarlo en UTC (§5.3).
- [ ] Gestionar el `409` al crear un bloqueo ofreciendo reintentar con `allowOverlap: true`.
- [ ] Gestionar el `409` nuevo al agendar citas (reutilizar el diálogo de solape existente, ajustando el texto).
- [ ] Para quitar un recordatorio push, enviar `clearReminder: true` — no `reminderMinutesBefore: null`.
- [ ] Al listar por rango, recortar en cliente las entradas que desbordan el rango pedido.
- [ ] Asumir que un `REMINDER` nunca bloquea nada: no lo pintes como franja ocupada.
- [ ] No ofrecer recurrencia en la UI: no está soportada en esta versión.

---

## 10. Archivos backend implicados

| Archivo | Rol |
|---------|-----|
| `controller/CalendarNoteController.java` | Los 5 endpoints |
| `controller/dto/CreateCalendarNoteRequest.java` | Body del `POST` |
| `controller/dto/UpdateCalendarNoteRequest.java` | Body del `PUT` |
| `models/dto/CalendarNoteDto.java` | Respuesta |
| `models/entity/CalendarNote.java` | Entidad (filtro multi-tenant) |
| `models/entity/CalendarNoteType.java` | Enum `REMINDER` / `TIME_BLOCK` |
| `repository/CalendarNoteRepository.java` | Consultas de solape y de avisos pendientes |
| `service/CalendarNoteService.java` | CRUD, privacidad y validaciones |
| `service/CalendarNoteReminderService.java` | Job de push (cron cada 5 min) |
| `service/AppointmentService.java` | **Modificado**: comprueba bloqueos al crear y reagendar |
| `exception/ErrorResource.java` | **Modificado**: 5 constantes nuevas |
| `i18n/Messages*.properties` | **Modificado**: traducciones es/en |
| `db/migration/V47__create_calendar_notes_table.sql` | Tabla, índices y permisos |

**Tabla `calendar_note`**

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `UUID` | PK |
| `tenant_id` | `UUID` | FK → `tenant`, `ON DELETE CASCADE` |
| `nutritionist_id` | `UUID` | FK → `app_user`, `ON DELETE CASCADE` — el autor |
| `type` | `VARCHAR(20)` | `CHECK IN ('REMINDER','TIME_BLOCK')` |
| `title` | `VARCHAR(255)` | `NOT NULL` |
| `description` | `TEXT` | |
| `start_time` / `end_time` | `TIMESTAMPTZ` | `CHECK (end_time >= start_time)` |
| `all_day` | `BOOLEAN` | Por defecto `FALSE` |
| `color` | `VARCHAR(20)` | |
| `reminder_minutes_before` | `INTEGER` | |
| `remind_at` | `TIMESTAMPTZ` | Derivado, índice parcial para el job |
| `reminder_sent_at` | `TIMESTAMPTZ` | Idempotencia del push |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |
