# Métricas y asistencia — Guía de integración frontend

Documento de apoyo para el rediseño de la pantalla **Métricas** (`design/metricas.html`).
Resume el contrato nuevo del backend, los cambios en DTOs existentes y las reglas de
cálculo para que el frontend pueda pintar la pantalla completa **en una sola llamada**.

> **Cero kcal**: la pantalla solo habla de euros, citas y porcentajes. No se exponen
> calorías en ningún campo.

---

## 1. Endpoint agregado de métricas (nuevo)

```
GET /api/tenant/{tenantId}/appointments/metrics
```

Permiso requerido: **`VIEW_REVENUE`** (lo tienen `ADMIN` y `NUTRITIONIST`).

### Query params

| Param | Tipo | Req. | Default | Notas |
|---|---|---|---|---|
| `from` | date-time (ISO-8601) | ✅ | — | Inicio del rango, inclusive. |
| `to` | date-time (ISO-8601) | ✅ | — | Fin del rango, inclusive. |
| `nutritionistId` | uuid | ❌ | — | Solo se respeta si el usuario tiene `MANAGE_TENANT`. |
| `granularity` | `DAY` \| `WEEK` \| `MONTH` \| `QUARTER` | ❌ | `MONTH` | Granularidad de la serie temporal. |
| `bucketCount` | int (1..60) | ❌ | `12` | Nº de cubos de la serie. El último cubo es el que contiene `to`. |

**Reglas de permisos**

- Con `MANAGE_TENANT` (administrador del centro): ve todo el centro o filtra por el
  `nutritionistId` que envíe.
- Sin `MANAGE_TENANT` (p. ej. `NUTRITIONIST`): el backend **ignora** cualquier
  `nutritionistId` y devuelve solo sus propios datos. Además, `byNutritionist` y
  `byServiceType` llegan **vacíos** (no se le expone el desglose del centro).

Errores: `400` si `from > to` o si `bucketCount` no está entre 1 y 60.

### Ejemplo de respuesta `200`

```json
{
  "range": { "from": "2026-09-01T00:00:00Z", "to": "2026-09-24T23:59:59Z" },
  "revenue": {
    "total": 15444.00,
    "currency": "EUR",
    "completedAppointments": 312,
    "averageTicket": 49.50,
    "patientsSeen": 176
  },
  "attendance": {
    "scheduled": 352,
    "attended": 312,
    "attendanceRate": 0.8864,
    "noShow": 18,
    "cancelledInTime": 16,
    "cancelledLate": 6,
    "recoveredSlots": null,
    "targetRate": 0.9000
  },
  "byNutritionist": [
    { "nutritionistId": "…", "nutritionistName": "Marta Ibáñez",
      "revenue": 6000.00, "scheduled": 100, "attended": 90,
      "attendanceRate": 0.9000, "noShow": 5 }
  ],
  "byServiceType": [
    { "typeId": "…", "typeName": "Primera visita",
      "revenue": 2470.00, "scheduled": 38, "attended": 29,
      "attendanceRate": 0.7632, "noShow": 6 }
  ],
  "byTimeBand": [
    { "label": "08:00-11:00", "scheduled": 80, "attended": 66, "attendanceRate": 0.8250 }
  ],
  "series": {
    "granularity": "MONTH",
    "revenue": [
      { "label": "oct", "from": "2025-10-01T00:00:00Z", "to": "2025-11-01T00:00:00Z", "value": 1200.00 }
    ],
    "attendanceRate": [
      { "label": "oct", "from": "2025-10-01T00:00:00Z", "to": "2025-11-01T00:00:00Z",
        "value": 0.8700, "scheduled": 30 }
    ]
  }
}
```

### Reglas de cálculo

- `scheduled`: citas con estado `SCHEDULED | COMPLETED | CANCELLED | NO_SHOW` cuya
  `startTime` cae en `[from, to]`. **`PROPOSED` queda excluido de todas las cifras.**
- `attended`: citas `COMPLETED` en el rango.
- `noShow`: citas `NO_SHOW` en el rango.
- `attendanceRate`: `attended / scheduled`, 4 decimales (0.0000 si `scheduled = 0`).
- `revenue.total`: suma del `price` (snapshot en la cita) de las `COMPLETED`
  del rango — misma semántica que `GET /appointments/revenue`.
- `averageTicket`: `total / attended` a 2 decimales, `0.00` si `attended = 0`.
- `patientsSeen`: nº de `patientId` distintos entre las `COMPLETED`. Las citas sin
  paciente (alta rápida de staff) no cuentan.
- `cancelledInTime` / `cancelledLate`: se calculan al leer con el umbral del centro
  (ver §3). Las cancelaciones históricas sin hora de cancelación se cuentan como
  **tarde** (`cancelledLate`), de modo que
  `cancelledInTime + cancelledLate = nº de CANCELLED`.
- `recoveredSlots`: **siempre `null`** por ahora (no existe el concepto de lista de
  espera). La UI debe omitir la tarjeta «Huecos recuperados» mientras llegue `null`.
- `targetRate`: objetivo del centro desde las preferencias, normalizado a 0..1
  (si el centro envía `90` se normaliza a `0.90`).

### Desgloses

- `byNutritionist` y `byServiceType` solo se rellenan con `MANAGE_TENANT`; si no,
  arrays vacíos. Ordenados por `revenue` descendente.
- Las citas sin tipo de servicio se agrupan bajo `typeId: null`, `typeName: "Sin tipo"`.
- `byTimeBand` siempre se rellena, con las bandas configuradas del centro (incluidas
  las de conteo 0). Las citas fuera de todas las bandas (p. ej. el hueco de mediodía
  `14:00-15:00`) no aparecen en ninguna franja.

### Serie temporal (`series`)

- `bucketCount` cubos consecutivos que **terminan en el cubo en curso** (el que
  contiene `to`). `from`/`to` de cada cubo van en ISO-8601 para tooltips.
- Etiquetas (`label`):
  - `DAY` → `dd/MM` (p. ej. `24/09`)
  - `WEEK` → `dd/MM` del lunes de la semana
  - `MONTH` → `ene`, `feb`, …, `dic`
  - `QUARTER` → `T1 ’26`
- `revenue` lleva el importe facturado por cubo; `attendanceRate` lleva la tasa y el
  `scheduled` del cubo (para ponderar o mostrar contexto).
- Las citas que caigan en `[from, to]` pero antes del primer cubo contribuyen a los
  totales, no a la serie.

> **Zona horaria**: los cubos y las franjas horarias se calculan en hora local del
> centro, fijada por ahora a `Europe/Madrid`. No hay todavía preferencia de zona
> horaria del tenant.

### Ejemplo de llamada

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/api/tenant/$TENANT_ID/appointments/metrics?from=2026-07-01T00:00:00Z&to=2026-09-24T12:00:00Z&granularity=MONTH&bucketCount=12"
```

---

## 2. `AppointmentDto`: nuevos campos de cancelación

Se añaden dos campos al DTO de cita (también en las respuestas de crear/reagendar/
cambiar estado y en los listados por nutricionista y paciente):

| Campo | Tipo | Descripción |
|---|---|---|
| `cancelledAt` | `date-time` \| `null` | Momento en que la cita pasó a `CANCELLED`. |
| `cancellationNoticeHours` | `number` \| `null` | Horas de antelación con que se canceló respecto a `startTime`. Positivo = avisó con margen. `null` en cancelaciones históricas. |

```json
{
  "id": "…",
  "status": "CANCELLED",
  "cancelledAt": "2026-09-23T09:12:00Z",
  "cancellationNoticeHours": 51.8,
  "…": "…"
}
```

Al hacer `PATCH /tenant/{tenantId}/appointments/{appointmentId}/status` con
`{"status":"CANCELLED"}`, el backend rellena ambos campos automáticamente sobre la
cita que pasa a `SCHEDULED → CANCELLED`.

**Nota de modelo**: no se añade un estado nuevo a `AppointmentStatus`. «A tiempo» vs
«tarde» es una clasificación de lectura que depende del umbral del centro.

---

## 3. Preferencias del centro (`TenantPreferences`)

Nuevas claves dentro de `preferences` del tenant, en lectura (`GET /tenant/{id}/profile`)
y escritura (`PUT /tenant/{id}/profile/preferences`):

| Clave JSON | Tipo | Default | Uso |
|---|---|---|---|
| `attendance_target_rate` | number (0..1) | `0.90` | Línea de objetivo de la gráfica de asistencia. Editable en Configuración. |
| `cancellation_notice_threshold_hours` | int | `24` | Horas que separan «cancelada a tiempo» de «cancelada tarde». |
| `appointment_time_bands` | array de `{label, from, to}` | ver abajo | Franjas horarias del desglose de asistencia. |

Bandas por defecto si `appointment_time_bands` es `null` o vacío:

```json
[
  { "label": "08:00-11:00", "from": "08:00", "to": "11:00" },
  { "label": "11:00-14:00", "from": "11:00", "to": "14:00" },
  { "label": "15:00-17:00", "from": "15:00", "to": "17:00" },
  { "label": "17:00-20:30", "from": "17:00", "to": "20:30" }
]
```

`from` es inclusivo y `to` exclusivo, en formato `HH:mm` y hora local del centro.

> ⚠️ El `PUT /preferences` **reemplaza** el objeto completo. Si el formulario de
> Configuración guarda preferencias, debe enviar también estas claves para no
> perderlas. Los valores por defecto protegen la lectura, pero no el guardado.

Ejemplo de payload de guardado:

```json
{
  "show_price": true,
  "enable_appointment_reminders": true,
  "attendance_target_rate": 0.9,
  "cancellation_notice_threshold_hours": 24,
  "appointment_time_bands": [
    { "label": "Mañana", "from": "08:00", "to": "14:00" },
    { "label": "Tarde", "from": "15:00", "to": "20:30" }
  ]
}
```

---

## 4. Checklist de integración frontend

- [ ] `appointment.api.ts`: añadir `getMetrics(tenantId, { from, to, nutritionistId?, granularity?, bucketCount? })`.
- [ ] `appointment.model.ts`: `AppointmentMetricsDto` (+ tipos anidados) y los campos
      `cancelledAt` / `cancellationNoticeHours` en `AppointmentDto`.
- [ ] Sustituir el `forkJoin` de buckets de `revenue.page.ts` por la serie agregada
      de `getMetrics`.
- [ ] Pantalla de Métricas: pestaña Facturación (`revenue.total`,
      `completedAppointments`, `averageTicket`, `patientsSeen` + `series.revenue`) y
      pestaña Asistencia (`attendance.*`, `series.attendanceRate`, `byTimeBand`,
      `byNutritionist`, `byServiceType`).
- [ ] Ocultar «Huecos recuperados» mientras `recoveredSlots` sea `null`.
- [ ] Pintar la línea de objetivo con `attendance.targetRate`.
- [ ] Configuración: exponer los tres campos de §3.
- [ ] Recordatorio de producto: **cero kcal** en la UI.

---

## 5. Mientras backend no esté desplegado (plan B)

La pantalla puede implementarse con el fan-out actual (`/revenue` + citas del rango)
para: `total`, `completedAppointments`, `averageTicket`, `patientsSeen`, `scheduled`,
`attended`, `noShow`, `attendanceRate`, `byNutritionist`, `byServiceType` y
`byTimeBand`.

**No se puede** sin este cambio de backend: `cancelledInTime` vs `cancelledLate`
(`cancellationNoticeHours`) y `recoveredSlots`. `targetRate` quedaría fijo a `0.90`.
