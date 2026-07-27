---
layout: page
title: Gestión de Horarios, Festivos y Perfil del Centro
---

# Gestión de Horarios, Festivos y Perfil del Centro

Este documento cubre tres áreas funcionales para la configuración del centro de nutrición (Tenant):
1. **Perfil del Centro** – Datos generales, país/región para festivos
2. **Horarios** – Jornadas laborales con bloques horarios
3. **Festivos** – Días de cierre del centro

> **Nota:** La creación y modificación de citas valida automáticamente la disponibilidad contra horarios y festivos.

## Endpoints Base

Todos los endpoints están bajo el prefijo del tenant:

```
/api/tenant/{tenantId}
```

---

## 0. Perfil del Centro (Tenant Profile)

Permite al administrador del centro consultar y actualizar los datos generales del mismo, incluyendo los códigos de país y región necesarios para la importación automática de festivos.

### 0.1 Obtener Perfil del Centro

```
GET /tenant/{tenantId}/profile
```

**Respuesta (200 OK):**

```json
{
  "id": "uuid",
  "name": "Centro de Nutrición Ejemplo",
  "cif": "B12345678",
  "address": "C/ Mayor 1, 07001 Palma",
  "phone": "+34 971 123 456",
  "countryCode": "ES",
  "stateCode": "PM",
  "city": "Palma",
  "preferences": {
    "primaryColor": "#005ac2",
    "defaultLanguage": "es-ES",
    "aiEnabled": true
  },
  "createdAt": "2026-01-01T10:00:00Z",
  "updatedAt": "2026-07-27T10:00:00Z"
}
```

### 0.2 Actualizar Perfil del Centro

```
PUT /tenant/{tenantId}/profile
```

Actualiza los datos generales del centro. Solo se envían los campos que se desean modificar.

**Request Body:**

```json
{
  "name": "Centro de Nutrición Ejemplo",
  "cif": "B12345678",
  "address": "C/ Mayor 1, 07001 Palma",
  "phone": "+34 971 123 456",
  "countryCode": "ES",
  "stateCode": "PM",
  "city": "Palma"
}
```

**Respuesta (200 OK):** Objeto `Tenant` completo (misma estructura que el GET).

### 0.3 Actualizar Preferencias del Centro

Ya existía en `/tenant/{tenantId}/branding/preferences`. Ahora también está disponible en:

```
PUT /tenant/{tenantId}/profile/preferences
```

**Request Body:**

```json
{
  "primaryColor": "#005ac2",
  "defaultLanguage": "es-ES",
  "aiEnabled": false
}
```

**Respuesta (200 OK):** Objeto `TenantPreferences` actualizado.

### 0.4 Importancia de countryCode y stateCode

Estos dos campos son **obligatorios** para que funcione la importación automática de festivos desde la API de Nager:

| Campo | Ejemplo | Descripción |
|-------|---------|-------------|
| `countryCode` | `"ES"` | Código ISO 3166-1 alpha-2 del país |
| `stateCode` | `"PM"` | Código de la provincia/región (ej. "PM" para Baleares, "M" para Madrid) |
| `city` | `"Palma"` | Nombre de la ciudad/municipio (para festivos locales) |

> Sin estos valores, el endpoint `/holidays/load-from-nager/{year}` no podrá cargar festivos.

---

## 1. Gestión de Jornadas (Schedules)

Una "Jornada" (Schedule) define los días de la semana y los bloques de horas en los que el centro está abierto. Una jornada puede tener **múltiples bloques** para un mismo día (ej. para incluir pausas de comida).

### 1.1 Crear Jornada

```
POST /schedules
```

Crea una nueva jornada. El campo `dayOfWeek` va del 1 (Lunes) al 7 (Domingo).

**Request Body:**

```json
{
  "name": "Horario de Verano",
  "color": "#FFC300",
  "details": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "13:00" },
    { "dayOfWeek": 1, "startTime": "15:00", "endTime": "20:00" },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "14:00" },
    { "dayOfWeek": 2, "startTime": "15:00", "endTime": "20:00" },
    { "dayOfWeek": 3, "startTime": "09:00", "endTime": "14:00" },
    { "dayOfWeek": 4, "startTime": "09:00", "endTime": "14:00" },
    { "dayOfWeek": 5, "startTime": "09:00", "endTime": "13:30" }
  ]
}
```

**Respuesta (201 Created):**

```json
{
  "id": "uuid",
  "name": "Horario de Verano",
  "color": "#FFC300",
  "details": [
    { "id": "uuid", "dayOfWeek": 1, "startTime": "09:00", "endTime": "13:00" },
    { "id": "uuid", "dayOfWeek": 1, "startTime": "15:00", "endTime": "20:00" },
    ...
  ],
  "enabled": true,
  "createdAt": "2026-07-27T10:00:00Z",
  "updatedAt": "2026-07-27T10:00:00Z"
}
```

### 1.2 Listar Jornadas Activas

```
GET /schedules
```

**Respuesta (200 OK):** Array de `ScheduleDto`.

### 1.3 Obtener Jornada Específica

```
GET /schedules/{scheduleId}
```

### 1.4 Eliminar Jornada

```
DELETE /schedules/{scheduleId}
```

> Solo se puede eliminar si la jornada NO está asignada a ningún periodo actual o futuro. Devuelve `204 No Content` en éxito.

---

## 2. Asignación de Horarios (Tenant Schedule Assignments)

Las jornadas creadas deben "asignarse" a rangos de fechas concretos en el calendario del centro. Esto permite, por ejemplo, usar un horario de verano del 15 de junio al 15 de septiembre.

### 2.1 Asignar Jornada a un Periodo

```
POST /schedules/assignments
```

**Request Body:**

```json
{
  "scheduleId": "uuid-del-schedule",
  "year": 2026,
  "validFrom": "2026-06-15",
  "validTo": "2026-09-15"
}
```

> `validTo` puede ser `null` si el horario es indefinido (abierto hasta nuevo aviso).

**Respuesta (201 Created):**

```json
{
  "id": "uuid",
  "scheduleId": "uuid",
  "year": 2026,
  "validFrom": "2026-06-15",
  "validTo": "2026-09-15",
  "schedule": { ... }  // Objeto ScheduleDto completo anidado
}
```

### 2.2 Listar Asignaciones

```
GET /schedules/assignments
```

**Respuesta (200 OK):** Array de `TenantScheduleAssignmentDto`, ordenados por `validFrom` descendente (más reciente primero). Incluye el `ScheduleDto` completo anidado para facilitar el renderizado en frontend.

### 2.3 Eliminar Asignación

```
DELETE /schedules/assignments/{assignmentId}
```

Devuelve `204 No Content`.

---

## 3. Gestión de Festivos (Holidays)

Permite establecer días en los que el centro estará cerrado. No se podrán agendar citas en estas fechas.

### 3.1 Importar Festivos Automáticamente (Nager API)

```
POST /holidays/load-from-nager/{year}
```

Carga automáticamente los festivos nacionales y locales del año especificado basándose en el `countryCode` y `stateCode` configurados en el Tenant. Esta operación también se ejecuta automáticamente cada 1 de enero.

> No devuelve body. Status `200 OK` en caso de éxito.

### 3.2 Crear Festivo Manual

```
POST /holidays
```

**Request Body:**

```json
{
  "holidayDate": "2026-10-12",
  "description": "Día de la Hispanidad",
  "type": "NATIONAL"
}
```

**Valores de `type`:** `NATIONAL` | `LOCAL`

**Respuesta (201 Created):**

```json
{
  "id": "uuid",
  "holidayDate": "2026-10-12",
  "description": "Día de la Hispanidad",
  "type": "NATIONAL",
  "enabled": true,
  "createdAt": "2026-07-27T10:00:00Z",
  "updatedAt": "2026-07-27T10:00:00Z"
}
```

### 3.3 Listar Festivos

```
GET /holidays
```

**Respuesta (200 OK):** Array de `HolidayDto`, ordenados por fecha ascendente.

### 3.4 Obtener Festivo Específico

```
GET /holidays/{holidayId}
```

### 3.5 Eliminar Festivo

```
DELETE /holidays/{holidayId}
```

Devuelve `204 No Content`.

---

## 4. Impacto en Citas (Appointments)

No hay nuevos endpoints de citas, pero **su comportamiento ha cambiado** para incluir dos nuevas validaciones automáticas:

### 4.1 Validación de Festivos

Al intentar crear (`POST /appointments`) o reprogramar (`PATCH /appointments/{id}`) una cita, si la fecha coincide con un registro en la tabla `holiday`, el backend rechaza la operación:

```
HTTP 400 Bad Request
"El centro está cerrado por festivo"
```

### 4.2 Validación de Horario de Apertura

El backend busca la asignación de horario activa (`TenantScheduleAssignment`) que cubra la fecha de la cita, obtiene los bloques horarios (`ScheduleDetail`) para ese día de la semana, y valida que la hora de inicio y fin de la cita estén **completamente contenidas** en al menos uno de los bloques:

```
HTTP 400 Bad Request
"La hora de la cita está fuera del horario de apertura del centro"
```

### 4.3 Recomendación para el Frontend (UX)

Para mejorar la experiencia de usuario y evitar errores 400, se recomienda:

1. **Obtener el horario activo** del centro usando `GET /schedules/assignments` y determinar qué Schedule está activo para la fecha seleccionada.
2. **Obtener los festivos** usando `GET /holidays`.
3. **Deshabilitar visualmente** en el selector de fechas:
  - Días festivos completos.
  - Días sin asignación de horario (centro cerrado todo el día).
4. **Deshabilitar franjas horarias** en el selector de horas que estén fuera de los bloques definidos en el `Schedule` activo para ese día de la semana.
5. **Mostrar mensajes informativos** al usuario: _"El centro cierra a las 15:00"_, _"Festivo - centro cerrado"_, etc.

---

## 5. DTOs de Referencia

### ScheduleDto

```json
{
  "id": "UUID",
  "name": "String",
  "color": "String",
  "details": ["ScheduleDetailDto"],
  "enabled": "boolean",
  "createdAt": "Instant",
  "updatedAt": "Instant"
}
```

### ScheduleDetailDto

```json
{
  "id": "UUID",
  "dayOfWeek": "int (1=Monday, 7=Sunday)",
  "startTime": "LocalTime (HH:mm)",
  "endTime": "LocalTime (HH:mm)"
}
```

### TenantScheduleAssignmentDto

```json
{
  "id": "UUID",
  "scheduleId": "UUID",
  "year": "int",
  "validFrom": "LocalDate",
  "validTo": "LocalDate | null",
  "schedule": "ScheduleDto (anidado)"
}
```

### HolidayDto

```json
{
  "id": "UUID",
  "holidayDate": "LocalDate",
  "description": "String",
  "type": "NATIONAL | LOCAL",
  "enabled": "boolean",
  "createdAt": "Instant",
  "updatedAt": "Instant"
}
```

### Tenant (Perfil del Centro — campos relevantes)

```json
{
  "id": "UUID",
  "name": "String",
  "cif": "String | null",
  "address": "String | null",
  "phone": "String | null",
  "countryCode": "String (ISO 3166-1 alpha-2) | null",
  "stateCode": "String | null",
  "city": "String | null",
  "preferences": {
    "primaryColor": "String",
    "defaultLanguage": "String",
    "aiEnabled": "boolean"
  },
  "enabled": "boolean",
  "createdAt": "Instant",
  "updatedAt": "Instant"
}
```

### UpdateTenantRequest

```json
{
  "name": "String | null",
  "cif": "String | null",
  "address": "String | null",
  "phone": "String | null",
  "countryCode": "String | null",
  "stateCode": "String | null",
  "city": "String | null",
  "preferences": "TenantPreferences | null"
}
```

---

## 6. Modelo de Datos

| Tabla | Propósito |
|-------|-----------|
| `tenant` | Centro de nutrición. Columnas relevantes: `country_code`, `state_code`, `city`, `address`, `phone`, `preferences` |
| `schedule` | Almacena jornadas (nombre, color) |
| `schedule_detail` | Bloques de tiempo dentro de una jornada (dayOfWeek, startTime, endTime) |
| `tenant_schedule_assignment` | Asignación de una jornada a un rango de fechas (validFrom, validTo) |
| `holiday` | Festivos nacionales y locales por tenant |

### Relaciones

- `Schedule` 1 → N `ScheduleDetail` (orphan removal: al eliminar Schedule, se eliminan sus detalles)
- `TenantScheduleAssignment` N → 1 `Schedule` (una jornada puede asignarse a múltiples periodos)
- `Holiday` N → 1 `Tenant` (cada festivo pertenece a un centro)
- `Schedule` N → 1 `Tenant`
- `TenantScheduleAssignment` N → 1 `Tenant`

---

## 7. Flujo de Uso Recomendado (Frontend)

```
1. Configurar perfil del centro (país/región)
   → GET /tenant/{tenantId}/profile (obtener datos actuales)
   → PUT /tenant/{tenantId}/profile (guardar countryCode = "ES", stateCode = "PM")

2. Crear jornadas base
   → POST /schedules (crear "Horario Invierno", "Horario Verano")

3. Cargar festivos automáticos
   → POST /holidays/load-from-nager/2026

4. Asignar horarios a periodos del año
   → POST /schedules/assignments

5. (Opcional) Ajustar horarios temporales
   → Crear nueva asignación para un periodo concreto que solape al anterior
   (el sistema busca la asignación más reciente que cubra la fecha)

6. Usuarios crean citas
   → El sistema valida automáticamente horario y festivos
```

---

## 8. Códigos de Estado Http

| Código | Significado |
|--------|-------------|
| `201 Created` | Recurso creado correctamente (POST) |
| `200 OK` | Operación exitosa (GET, PATCH) |
| `204 No Content` | Eliminación exitosa (DELETE) |
| `400 Bad Request` | Error de validación (festivo, fuera de horario, solapamiento) |
| `404 Not Found` | Recurso no encontrado |
| `409 Conflict` | La cita solapa con otra existente |

---

## 9. Resumen de Permisos

| Endpoint | Permiso Requerido | Quién puede usarlo |
|----------|-------------------|-------------------|
| `PUT /tenant/{tenantId}/profile` | `MANAGE_TENANT` | Administrador del centro |
| `PUT /tenant/{tenantId}/profile/preferences` | `MANAGE_TENANT` | Administrador del centro |
| `POST /schedules` | `MANAGE_TENANT` | Administrador del centro |
| `DELETE /schedules/{scheduleId}` | `MANAGE_TENANT` | Administrador del centro |
| `POST /schedules/assignments` | `MANAGE_TENANT` | Administrador del centro |
| `DELETE /schedules/assignments/{assignmentId}` | `MANAGE_TENANT` | Administrador del centro |
| `POST /holidays` | `MANAGE_TENANT` | Administrador del centro |
| `DELETE /holidays/{holidayId}` | `MANAGE_TENANT` | Administrador del centro |
| `POST /holidays/load-from-nager/{year}` | `MANAGE_TENANT` | Administrador del centro |
| `GET /tenant/{tenantId}/profile` | `VIEW_TENANT_BRANDING` o `MANAGE_TENANT` | Cualquier usuario del centro |
| `GET /schedules` | `VIEW_TENANT` o `MANAGE_TENANT` | Cualquier usuario del centro |
| `GET /schedules/{scheduleId}` | `VIEW_TENANT` o `MANAGE_TENANT` | Cualquier usuario del centro |
| `GET /schedules/assignments` | `VIEW_TENANT` o `MANAGE_TENANT` | Cualquier usuario del centro |
| `GET /holidays` | `VIEW_TENANT` o `MANAGE_TENANT` | Cualquier usuario del centro |
| `GET /holidays/{holidayId}` | `VIEW_TENANT` o `MANAGE_TENANT` | Cualquier usuario del centro |
