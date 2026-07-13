# Nuevas Funcionalidades: Control de Agua y Configuración de Anamnesis por Tenant

## 1. Seguimiento del consumo de agua
Se ha implementado un nuevo módulo que permite a los pacientes hacer un seguimiento diario de su consumo de agua, con un objetivo recomendado de 2L al día.

### Tabla y Permisos
- Tabla: `water_intake` con las columnas `id`, `tenant_id`, `patient_id`, `record_date`, `amount_ml`, `created_at`, `updated_at`.
- Restricción única: Un único registro por `(tenant_id, patient_id, record_date)`.
- Permisos creados:
  - `VIEW_WATER_INTAKE`: Permite a los roles `ADMIN` y `NUTRITIONIST` ver el histórico de consumo de agua del paciente.
- Seguridad de Modificación:
  - **No existe un permiso global para modificar el agua**. Únicamente el propio paciente autenticado puede registrar, modificar o borrar su propio consumo de agua (validación estricta de identidad `isSelfInTenant`).

---

### Endpoints de Consumo de Agua

#### PUT `/tenant/{tenantId}/users/{userId}/water-intake/{date}`
Registra o actualiza los mililitros consumidos por un paciente en una fecha concreta.

- **Permisos requeridos:** El usuario autenticado debe ser exactamente el mismo `userId` de la petición y pertenecer al tenant.
- **Parámetro `{date}`:** Fecha en formato `YYYY-MM-DD` (ej. `2026-07-13`).
- **Body:**
```json
{
  "amountMl": 1500
}
```
- **Response 200 (WaterIntakeDto):**
```json
{
  "id": "e2f1e29c-fa1a-4712-9c3f-ee0840b2a3a5",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "patientId": "73d4a259-86db-4bcf-b19b-f1190bc1f301",
  "recordDate": "2026-07-13",
  "amountMl": 1500,
  "isGoalReached": false
}
```
*Nota: `isGoalReached` se evalúa a `true` si `amountMl` es mayor o igual a `2000` (2 litros).*

#### GET `/tenant/{tenantId}/users/{userId}/water-intake`
Obtiene el historial ordenado cronológicamente de agua consumida para un paciente dentro de un rango de fechas.

- **Permisos requeridos:** `VIEW_WATER_INTAKE` en el tenant para nutricionistas/admins, O bien que el usuario autenticado sea el propio `userId` (paciente).
- **Query parameters (opcionales):**
  - `startDate`: Fecha de inicio en formato `YYYY-MM-DD`.
  - `endDate`: Fecha de fin en formato `YYYY-MM-DD`.
  *Si no se proporcionan parámetros, por defecto se recupera el historial de los últimos 7 días terminando hoy.*
- **Response 200 (List<WaterIntakeDto>):**
```json
[
  {
    "id": "e2f1e29c-fa1a-4712-9c3f-ee0840b2a3a5",
    "tenantId": "00000000-0000-0000-0000-000000000001",
    "patientId": "73d4a259-86db-4bcf-b19b-f1190bc1f301",
    "recordDate": "2026-07-13",
    "amountMl": 2000,
    "isGoalReached": true
  }
]
```

#### DELETE `/tenant/{tenantId}/users/{userId}/water-intake/{intakeId}`
Elimina un registro de agua específico por su UUID.

- **Permisos requeridos:** El usuario autenticado debe ser exactamente el mismo `userId` de la petición y pertenecer al tenant.
- **Response 204 No Content.**

---

## 2. Configuración de Anamnesis por Tenant
Se añade soporte para que cada centro/tenant configure qué campos de la anamnesis (`UserTenantProfile`) desea utilizar, permitiendo ocultar aquellos que no necesiten en su flujo de trabajo.

### Cambios en Preferencias del Tenant
En las preferencias de configuración del tenant (`TenantPreferences` / objeto `preferences` devuelto en `Tenant`), se incluye la propiedad:
- **`active_anamnesis_fields`**: Lista de strings con los identificadores de los campos activos.

### Valores por Defecto
Por defecto, la lista incluye todos los campos disponibles para garantizar retrocompatibilidad:
```json
"active_anamnesis_fields": [
  "consultationReason",
  "diseases",
  "medicalHistory",
  "habits",
  "lifestyle",
  "exercise",
  "psyche",
  "allergiesIntolerances",
  "foodPreferences",
  "medicationSupplements",
  "gastrointestinalStatus",
  "hormonalCycle"
]
```

### Configuración desde el Frontend
Para cambiar los campos activos, el administrador puede llamar al endpoint de actualización de tenant existente:

#### PUT `/tenant/{tenantId}` (o PATCH / PUT global según corresponda)
- **Request Body:**
```json
{
  "name": "Clínica Salud",
  "cif": "B12345678",
  "preferences": {
    "enable_vacation_module": true,
    "enable_clock_in_module": true,
    "default_language": "es-ES",
    "primary_color": "#005ac2",
    "keycloak_sync_mode": "IMPORT",
    "from_email": "soporte@clinicasalud.com",
    "standard_vacation_days": 22.0,
    "active_anamnesis_fields": [
      "consultationReason",
      "diseases",
      "allergiesIntolerances"
    ]
  }
}
```
*Si un campo no se incluye en la lista `active_anamnesis_fields`, el frontend debe ocultar su visualización y formulario al cargar el perfil de anamnesis del paciente.*

---

## 3. Seguridad para el Rol USER (Paciente) y Reagendamiento de Citas
Para habilitar que los pacientes puedan acceder a sus datos desde su dashboard sin vulnerar la privacidad de otros usuarios del tenant, se ha modificado la seguridad de varios controladores:

### Permisos del Paciente (Solo Consulta)
- **Métricas Corporales (`BodyMeasurementController`)**:
  - `GET /tenant/{tenantId}/users/{userId}/measurements` y sub-rutas (`/latest`, `/evolution`).
  - Ahora permiten el acceso al propio paciente autenticado (`userId`) además del nutricionista con `VIEW_USER`.
- **Datos de Perfil Básico (`UserTenantRoleController`)**:
  - `GET /tenant/{tenantId}/users/{userId}`.
  - Permite al propio paciente consultar sus datos básicos de membresía y perfil.
- **Citas (`AppointmentController`)**:
  - `GET /tenant/{tenantId}/appointments/patient/{patientId}`.
  - Permite al paciente consultar el histórico y próximas citas asignadas.

---

### Funcionalidad de Reagendamiento de Citas

#### Estado `PROPOSED` en Citas
Se ha añadido el estado `PROPOSED` al enum `AppointmentStatus`. Este estado representa una propuesta de fecha/hora sugerida por el paciente.

#### Flujo de Reagendamiento
1. El paciente puede sugerir un cambio de horario llamando a:
   - **`PATCH /tenant/{tenantId}/appointments/{appointmentId}`** (Reschedule).
   - Este endpoint está securizado para permitir el acceso al propio paciente si la cita le pertenece (`isAppointmentPatient`).
2. Al procesar la solicitud, si el usuario que realiza la petición **no** tiene el permiso global `MANAGE_APPOINTMENTS` (es decir, es el paciente):
   - El estado de la cita cambiará automáticamente a **`PROPOSED`**.
   - Si la solicitud es realizada por un nutricionista u otro staff con dicho permiso, el estado se mantendrá (o volverá a) **`SCHEDULED`**, lo cual sirve para aceptar/confirmar la fecha propuesta.

