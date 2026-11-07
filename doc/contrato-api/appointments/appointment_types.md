# Tipos de cita — configuración por tenant

## 1. Resumen

Se añade el módulo de **tipos de cita (appointment types)** para que cada tenant pueda configurar su propio catálogo de tipos de consulta con duraciones predefinidas.

Cuando se crea una cita, el tipo de cita permite:
- **Calcular automáticamente** la hora de fin (`endTime`) a partir de la duración configurada.
- **Identificar visualmente** el propósito de la consulta en el frontend.

**Valores semilla por tenant:**
- Si el idioma del tenant (`default_language`) empieza por `es`: "Primera consulta" (50 min, por defecto) y "Seguimiento" (20 min).
- Si el idioma es otro: "Initial consultation" (50 min, por defecto) y "Follow-up" (20 min).

---

## 2. Endpoints

Todas las rutas están bajo el prefijo `/tenant/{tenantId}/appointment-types`.

### GET /tenant/{tenantId}/appointment-types

Lista los tipos de cita del tenant.

**Parámetros query (opcionales):**

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `onlyActive` | `boolean` | `true` | Si es `true`, solo devuelve tipos activos |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "tenantId": "uuid",
    "name": "Primera consulta",
    "durationMinutes": 50,
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-06-15T12:00:00Z"
  },
  {
    "id": "uuid",
    "tenantId": "uuid",
    "name": "Seguimiento",
    "durationMinutes": 20,
    "isDefault": false,
    "isActive": true,
    "createdAt": "2026-06-15T12:00:00Z"
  }
]
```

---

### POST /tenant/{tenantId}/appointment-types

Crea un nuevo tipo de cita.

**Cuerpo de la solicitud:**
```json
{
  "name": "Sesión exprés",
  "durationMinutes": 15,
  "isDefault": false
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `name` | `string` | Sí | Nombre del tipo de cita |
| `durationMinutes` | `integer` | Sí | Duración en minutos (> 0) |
| `isDefault` | `boolean` | No | Si es `true`, se marca como predeterminado (desmarca otros) |

**Response 201:** el objeto creado (misma estructura que en GET).

---

### PUT /tenant/{tenantId}/appointment-types/{typeId}

Actualiza un tipo de cita existente. Todos los campos son opcionales (semántica PATCH).

**Cuerpo de la solicitud:**
```json
{
  "name": "Consulta completa",
  "durationMinutes": 45,
  "isDefault": true
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | `string` | Nuevo nombre |
| `durationMinutes` | `integer` | Nueva duración |
| `isDefault` | `boolean` | Marcar como predeterminado (desmarca otros) |
| `isActive` | `boolean` | Activar / desactivar |

**Response 200:** el objeto actualizado.

---

### DELETE /tenant/{tenantId}/appointment-types/{typeId}

Eliminación lógica: establece `isActive = false` para no corromper el histórico de citas que lo referencian.

**Response 204:** sin contenido.

---

## 3. Seguridad

| Permiso | Endpoints | Asignado a |
|---|---|---|
| `VIEW_APPOINTMENTS` | `GET` | `ADMIN`, `NUTRITIONIST` |
| `MANAGE_APPOINTMENTS` | `POST`, `PUT`, `DELETE` | `ADMIN`, `NUTRITIONIST` |

---

## 4. Tabla de campos — appointment_type

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `UUID` | PK |
| `tenant_id` | `UUID` | FK → `tenant`, multi-tenant |
| `name` | `VARCHAR(100)` | Nombre del tipo de cita |
| `duration_minutes` | `INTEGER` | Duración en minutos (> 0) |
| `is_default` | `BOOLEAN` | Indica si es el tipo predeterminado del tenant |
| `is_active` | `BOOLEAN` | Indica si está activo (soporta borrado lógico) |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | Fecha de última actualización |

---

## 5. Notas técnicas

- **Seed automático**: al crear un nuevo tenant, se insertan automáticamente 2 tipos de cita según el `default_language` de sus preferencias.
- **Borrado lógico**: `DELETE` no elimina físicamente el registro. Establece `isActive = false` para preservar la integridad referencial de las citas que lo usan (`ON DELETE SET NULL`).
- **Default único**: solo un tipo de cita puede tener `isDefault = true` por tenant. Al marcar uno nuevo, el anterior se desmarca automáticamente.
- **Multi-tenant**: la entidad `AppointmentType` lleva `@Filter(name = "tenantFilter")`.

---

## 6. Archivos creados / modificados

| Ruta | Cambio |
|---|---|
| `db/migration/V9__appointment_types.sql` | Nuevo — crea tabla + FK en `appointment` + seed para tenants existentes |
| `models/entity/AppointmentType.java` | Nuevo — entidad JPA con tenant filter |
| `models/dto/AppointmentTypeDto.java` | Nuevo — DTO de respuesta |
| `controller/dto/CreateAppointmentTypeRequest.java` | Nuevo — DTO de creación |
| `controller/dto/UpdateAppointmentTypeRequest.java` | Nuevo — DTO de actualización |
| `repository/AppointmentTypeRepository.java` | Nuevo — repositorio JPA |
| `service/AppointmentTypeService.java` | Nuevo — CRUD + seed defaults |
| `controller/AppointmentTypeController.java` | Nuevo — endpoints REST |
| `service/TenantService.java` | Modificado — inyecta `AppointmentTypeService` y llama a `seedDefaultsForTenant()` al crear un tenant |
| `service/AppointmentService.java` | Modificado — resuelve tipo de cita y calcula `endTime` automáticamente |
| `models/entity/Appointment.java` | Modificado — añadida relación `@ManyToOne` a `AppointmentType` |
