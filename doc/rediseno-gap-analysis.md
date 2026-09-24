# Rediseño SIF-Web — Fase 0: Análisis de brechas (API ↔ Diseño)

**Fecha**: 24 sep 2026
**Alcance**: qué datos expone hoy el backend frente a lo que piden las pantallas de `design/`.
**Referencia de pantallas**: `design/dashboard-nutricionista.html`, `agenda.html`, `pacientes.html`,
`ficha-paciente.html`, `planes.html`, `plan-detalle.html`, `metricas.html`, `configuracion.html`.

---

## 1. Resumen ejecutivo

| Área | Estado | Acción |
|---|---|---|
| Roles y permisos | ✅ Cubierto | Reutilizar `PermissionsService` |
| Agenda / citas | ✅ Cubierto | Sin cambios de contrato |
| Precio de cita | ✅ Cubierto (`AppointmentTypeDto.price`) | Sin cambios |
| Facturación total | ✅ Cubierto (`GET .../revenue`) | Sin cambios |
| Pacientes atendidos / ticket medio | 🟡 Parcial | Calcular en frontend con citas del periodo |
| Desglose por profesional | 🟡 Parcial | N peticiones (una por profesional) o agregación en frontend |
| Desglose por tipo de servicio | 🟠 **Falta** | No hay endpoint de agrupación por tipo |
| Ausencias / tasa de asistencia | 🟡 Parcial | `NO_SHOW` existe en el enum; el estado se puede contar desde citas |
| "Agenda sin cubrir" (€ perdidos) | 🟠 **Falta** | Derivar en frontend: nº NO_SHOW × precio del tipo |
| Peso como línea suavizada | 🟡 Parcial | `evolution` devuelve puntos crudos; suavizar en frontend |
| Raciones / intercambios | 🟠 **Falta** | El modelo actual expone `kcal` (56 usos); el diseño prohíbe calorías |
| Comparativa con periodo anterior | 🟠 **Falta** | Requiere 2 series (periodo + mismo tramo anterior) |
| Periodo en curso ponderado | 🟠 **Falta** | Lógica de negocio, no hay dato de "días transcurridos" |
| Estado "sucio" en configuración | ✅ Cubierto | Angular `dirty` + `beforeunload` |
| Bottom navigation móvil | ✅ Cubierto | Puramente frontend |

Leyenda: ✅ cubierto · 🟡 parcial (se resuelve en frontend) · 🟠 falta dato o contrato.

---

## 2. Detalle por brecha

### 2.1 Cero calorías — decisión de producto pendiente

El modelo `food.model.ts` expone `ENERC` (kcal) y las vistas de menús lo pintan en 56
puntos (`menu-detail.page.html`, `meal-cell`, `meal-items-editor`, `food-create-panel`).

**Regla de la guía**: "Cero calorías en toda la plataforma… Los planes se construyen por
raciones e intercambios. Prohibido: kcal, déficit, objetivo calórico."

**Conflicto**: "sin perder funcionalidad" vs. la regla de producto.

**Opciones**:
- **A (recomendada)**: ocultar `kcal` en toda la UI y mostrar el recuento de
  raciones/intercambios. Se conserva el dato en el modelo (por si Auditoría/nutrición lo
  necesita) pero no se pinta. Coste: medio (retocar plantillas de menús).
- **B**: mantener kcal. Rompe la regla de producto.

> Necesita confirmación del usuario antes de tocar menús.

### 2.2 Métricas de asistencia y facturación

`GET /tenant/{tenantId}/appointments/revenue?startDate&endDate&nutritionistId` devuelve
**un único número** (total de citas COMPLETED). `metricas.html` necesita además:

1. **Consultas realizadas** → nº de citas `COMPLETED` en el rango.
   *Resoluble en frontend* con `GET .../appointments/nutritionist/{id}?from&to` (ya existe).
2. **Importe medio por consulta** → `revenue / consultas`. *Frontend.*
3. **Pacientes atendidos** → nº de `patientId` distintos con cita `COMPLETED`. *Frontend.*
4. **Desglose por profesional** (admin) → N llamadas a `revenue` (una por profesional).
   *Frontend con `forkJoin`* (patrón ya usado en `revenue.page.ts`), o pedir endpoint agregado.
5. **Desglose por tipo de servicio** → agrupar por `appointment.typeId/typeName` sobre las
   citas del periodo, valorando con `type.price`. *Frontend*, pero hoy no se traen las citas
   para calcular: habría que añadir esa carga.
6. **Tasa de asistencia / ausencias sin avisar** → contar `CANCELLED` y `NO_SHOW` sobre el
   total programado. *Frontend.*
7. **"Agenda sin cubrir" (€)** → `noShowCount × type.price`. La guía lo pide explícitamente
   ("12 citas perdidas equivalen a 430 € de agenda sin cubrir"). *Frontend.*

**Recomendación**: no pedir endpoints nuevos todavía. Añadir un *selector/derivador* en
frontend que, a partir de las citas del periodo + `revenue`, construya todos los KPIs. Si
`metricas` se vuelve pesada, entonces sí proponer al backend `GET .../metrics?from&to`.

**Endpoint faltante candidato** (futuro, no bloqueante):
`GET /tenant/{tenantId}/appointments/metrics?from&to[&nutritionistId]` → objeto con
`revenue`, `completed`, `noShow`, `cancelled`, `patientsSeen`, `byNutritionist[]`,
`byServiceType[]`. Evitaría el fan-out de peticiones.

### 2.3 Comparativa con periodo anterior y periodo en curso

La guía exige comparar contra "el mismo tramo del periodo anterior", cortando el periodo
anterior a la misma altura del calendario, y marcar el actual como "en curso".

No existe endpoint de comparación: hay que **duplicar las consultas** con el rango anterior
equivalente. *Resoluble en frontend* (ya lo insinúa `revenue.page.html` con
`comparado con el mismo tramo de…`). Requiere una utilidad compartida para calcular los
rangos (evitar duplicar lógica en métricas y facturación).

### 2.4 Evolución del peso (línea suavizada)

`GET .../measurements/evolution` devuelve `MeasurementHistoryDto.points`, con
`weightKg` crudo por fecha. La guía prohíbe los puntos crudos ("nunca como puntos crudos que
exageren la oscilación diaria").

**Acción**: utility en TypeScript compartida para suavizar (media móvil / Catmull-Rom) antes
de pintar. Sin cambio de backend. Existe ya `patient-weight-chart.ts`; unificar criterio ahí.

### 2.5 Raciones e intercambios en planes

`menu.model.ts` / `meal.model.ts` no exponen un concepto explícito de "ración" o
"intercambio"; el detalle se apoya en `food` + `kcal`. `planes.html` y `plan-detalle.html`
construyen los menús por raciones.

**Brecha real**: no está claro que exista un tipo de dato "ración/intercambio" en el
contrato. *Pendiente de investigar el modelo de menús en profundidad antes de la Fase 4.*

### 2.6 Roles (admin vs. nutricionista)

`PermissionsService` + `TenantContextService.currentMembership().roleCode` +
`userType ('STAFF' | 'PATIENT')` cubren lo que pide la guía (`MANAGE_TENANT` ya distingue
admin). La visibilidad condicional de "Desglose por profesional" y de la configuración del
centro puede resolverse en frontend sin cambios de API. ✅

### 2.7 Agenda: solapes y estados

`CreateAppointmentRequest.allowOverlap`, error `409` +
`error.appointment_overlap_frontend`, y estados `SCHEDULED | COMPLETED | CANCELLED |
NO_SHOW | PROPOSED` están ya documentados e implementados. El modal de "Nueva cita"
unificado (cita o bloqueo) es trabajo de presentación. ✅

---

## 3. Decisiones tomadas (24 sep 2026)

1. **kcal**: se **oculta en toda la UI** (opción A) — mantenerla rompe la regla de
   producto. El dato puede seguir en el modelo, pero no se pinta. Se aplica en la
   Fase 4 (menús/planes).
2. **Métricas**: se pide al backend el endpoint agregado. Encargo exacto en
   **`doc/backend-metricas-prompt.md`**. Mientras no llegue, plan B: derivar en
   frontend con fan-out (todo menos `cancelledInTime` / `cancelledLate` /
   `recoveredSlots`, que son imposibles sin backend).
3. **Marca por centro**: confirmado. `--brand-primary` default = `#2F5D4F`,
   manteniendo el override por centro vía `ThemeService.setPrimary`.
4. **`--accent`**: la Guía es la fuente correcta → `#C45608` (los prototipos con
   `#C4714B` se consideran un desvío a corregir).
5. **Tipografía de títulos**: **Satoshi** (variante `data-type="c"` de la Guía:
   peso 700, tracking `-0.02em`). Inter se mantiene para la interfaz.

---

## 4. Efecto en las fases siguientes

- Fase 1 (tokens/tipografía): sin dependencias de API. Arranca ya.
- Fase 2 (layout + bottom nav): sin dependencias de API.
- Fase 3 (componentes): sin dependencias; el fan-out de métricas se aborda aquí.
- Fase 4 (vistas): requiere cerrar las decisiones §3.1 y §3.2 antes de menús y métricas.
