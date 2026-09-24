# Encargo a backend — Métricas y asistencia (bloqueante para el rediseño)

**Contexto**: el rediseño de `sif-web` incorpora la pantalla *Métricas* de los
prototipos `design/metricas.html`. Para cubrirla con la UX prevista hacen falta
agregados que hoy no existen. El frontend puede derivar algunas cifras, pero tres
cosas son imposibles sin cambios de contrato.

---

## Prompt (listo para pegar)

> **Tarea**: añadir soporte backend para la pantalla de Métricas del rediseño.
> Proyecto `sif-back` (Spring). Respetar el estilo actual de controllers/DTOs,
> el multi-tenant por `tenantId` de la ruta y la validación de permisos.
>
> ### 1. Nuevo endpoint agregado de métricas
>
> `GET /tenant/{tenantId}/appointments/metrics`
>
> Query params:
> - `from` (date-time, required)
> - `to` (date-time, required)
> - `nutritionistId` (uuid, optional) — si el usuario no tiene `MANAGE_TENANT`,
>   ignorar el parámetro y forzar el `nutritionistId` del usuario autenticado.
> - `granularity` (enum `DAY|WEEK|MONTH|QUARTER`, optional, default `MONTH`)
> - `bucketCount` (int, optional, default 12) — nº de cubos de la serie temporal.
>
> Respuesta `200 AppointmentMetricsDto`:
>
> ```json
> {
>   "range": { "from": "2026-09-01T00:00:00Z", "to": "2026-09-24T23:59:59Z" },
>   "revenue": {
>     "total": 15444.0,
>     "currency": "EUR",
>     "completedAppointments": 312,
>     "averageTicket": 49.5,
>     "patientsSeen": 176
>   },
>   "attendance": {
>     "scheduled": 352,
>     "attended": 312,
>     "attendanceRate": 0.886,
>     "noShow": 18,
>     "cancelledInTime": 16,
>     "cancelledLate": 6,
>     "recoveredSlots": 9,
>     "targetRate": 0.90
>   },
>   "byNutritionist": [
>     { "nutritionistId": "uuid", "nutritionistName": "Marta Ibáñez",
>       "revenue": 6000.0, "scheduled": 100, "attended": 90,
>       "attendanceRate": 0.90, "noShow": 5 }
>   ],
>   "byServiceType": [
>     { "typeId": "uuid", "typeName": "Primera visita",
>       "revenue": 2470.0, "scheduled": 38, "attended": 29,
>       "attendanceRate": 0.763, "noShow": 6 }
>   ],
>   "byTimeBand": [
>     { "label": "08:00-11:00", "scheduled": 80, "attended": 66, "attendanceRate": 0.825 }
>   ],
>   "series": {
>     "granularity": "MONTH",
>     "revenue":        [ { "label": "oct", "from": "...", "to": "...", "value": 1200.0 } ],
>     "attendanceRate": [ { "label": "oct", "from": "...", "to": "...", "value": 0.87, "scheduled": 30 } ]
>   }
> }
> ```
>
> Reglas de cálculo:
> - `scheduled` = citas con estado `SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`
>   cuya `startTime` cae en `[from, to]`. **Excluir `PROPOSED`.**
> - `attended` = citas `COMPLETED` en el rango.
> - `noShow` = citas `NO_SHOW` en el rango.
> - `attendanceRate` = `attended / scheduled` (0..1, 4 decimales máx.).
> - `revenue.total` = suma del `price` del `AppointmentType` de cada cita
>   `COMPLETED` del rango (misma semántica que el endpoint `/revenue` actual).
> - `averageTicket` = `revenue.total / attended` (0 si `attended = 0`).
> - `patientsSeen` = nº de `patientId` distintos entre las citas `COMPLETED`.
> - `byTimeBand`: bandas horarias **configurables por tenant**; si no hay
>   configuración, usar por defecto `08:00-11:00`, `11:00-14:00`, `15:00-17:00`,
>   `17:00-20:30` (hora local del centro).
> - `series`: `bucketCount` cubos consecutivos que **terminan en el cubo en curso**;
>   cada cubo con su `label` corto (mes: `ene`…`dic`; trimestre: `T1 ’26`).
> - `byNutritionist` y `byServiceType` solo si el usuario tiene `MANAGE_TENANT`
>   (para el resto, devolver arrays vacíos).
>
> ### 2. Distinguir cancelación con aviso de cancelación tardía (imprescindible)
>
> Hoy `AppointmentStatus` solo tiene `CANCELLED`, así que no se puede separar
> «cancelada a tiempo» de «cancelada tarde». Añadir al `AppointmentDto`:
> - `cancelledAt` (date-time, nullable)
> - `cancellationNoticeHours` (number, nullable) — horas de antelación con que se
>   canceló respecto a `startTime` (positivo = con aviso).
>
> Y una preferencia de centro:
> - `cancellationNoticeThresholdHours` (int, default 24) — umbral que separa
>   «a tiempo» de «tarde».
>
> `attendance.cancelledInTime` = canceladas con `cancellationNoticeHours >=`
> umbral; `cancelledLate` = canceladas por debajo del umbral. Rellenar también
> `cancelledAt` al hacer `PATCH .../status` con `status = CANCELLED`.
>
> ### 3. Objetivo de asistencia del centro
>
> Exponer `attendanceTargetRate` (0..1, default 0.90) en las preferencias del
> tenant (lectura y escritura), para poder pintar la línea de objetivo de la
> gráfica y poder editarla en Configuración.
>
> ### 4. Lista de espera / huecos recuperados (decisión de producto)
>
> El prototipo muestra «Huecos recuperados» (huecos de cancelación cubiertos desde
> lista de espera). Si no existe ese concepto en el dominio, decid: (a)
> implementarlo, o (b) devolver `recoveredSlots: null` y lo omitimos en la UI.
> No bloquear el resto por esto.
>
> ### Criterios de aceptación
> - Multi-tenant: nunca cruzar datos entre `tenantId`.
> - Permisos: un `NUTRITIONIST` sin `MANAGE_TENANT` solo ve sus propios datos,
>   aunque envíe `nutritionistId` de otro.
> - 1 sola llamada sirve la pantalla completa (evita el fan-out actual de N
>   peticiones a `/revenue`).
> - Swagger (`doc/api-docs.json`) actualizado con el nuevo endpoint y el DTO.
> - Tests de integración para: rango vacío, `attended = 0` (sin división por
>   cero), excluir `PROPOSED`, y aislamiento por rol.

---

## Lo que **no** hace falta pedir (ya cubierto)

| Necesidad | Endpoint existente |
|---|---|
| Facturación de un rango | `GET /tenant/{id}/appointments/revenue` (queda como *fallback* / compatibilidad) |
| Citas de un profesional en un rango | `GET .../appointments/nutritionist/{id}?from&to&status` |
| Citas de un paciente | `GET .../appointments/patient/{id}?from&to` |
| Precio por tipo de cita | `AppointmentTypeDto.price` |
| Comparativa con periodo anterior | El cliente llama dos veces con rangos equivalentes |

## Impacto en el frontend cuando esté listo

- `src/app/core/api/services/appointment.api.ts`: añadir `getMetrics(...)`.
- `src/app/core/api/models/appointment.model.ts`: `AppointmentMetricsDto` +
  `cancelledAt` / `cancellationNoticeHours` en `AppointmentDto`.
- `revenue.page.ts`, `metricas`: sustituir el `forkJoin` de buckets por la serie
  agregada.
- Recordar: **cero kcal** en la UI (decisión de producto confirmada).

## Mientras backend no lo entregue (plan B)

La pantalla de Métricas puede implementarse con el fan-out actual
(`revenue` + citas del rango) para: `total`, `completedAppointments`,
`averageTicket`, `patientsSeen`, `scheduled`, `attended`, `noShow`,
`attendanceRate`, `byNutritionist`, `byServiceType` y `byTimeBand`.

**No se puede** sin backend: `cancelledInTime` vs `cancelledLate` (falta el
dato) y `recoveredSlots` (falta el concepto). `targetRate` quedaría fijo a 0.90.
