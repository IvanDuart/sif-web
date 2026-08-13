# Recordatorios de Cita (Push Notifications)

Este documento detalla la nueva funcionalidad de **recordatorios automáticos de cita** para pacientes, enviados mediante notificaciones push (OneSignal). Incluye los cambios en el backend, la nueva preferencia a nivel de tenant y las implicaciones para Frontend (web) y App Móvil (Flutter).

---

## 1. Resumen del Comportamiento

El backend ejecuta un job programado **todos los días a las 08:00** (hora del servidor) que:

1. Revisa todos los **tenants activos** (`enabled = true`) que tengan activados los recordatorios.
2. Busca sus citas en estado **`SCHEDULED`** (pendientes/confirmadas) que ocurran en las próximas **48 horas** desde el momento de la ejecución.
3. Para cada cita, calcula la fecha local del **paciente** usando su `timezone` y determina si la cita es:
   - **Hoy** → envía el recordatorio "de hoy".
   - **Mañana** (según la fecha local del paciente) → envía el recordatorio "de mañana".
   - En cualquier otro caso (o si la cita ya ha comenzado al ejecutarse el job) → **no envía nada**.
4. El mensaje se localiza según el `language` del paciente y la hora se formatea en `HH:mm` usando su `timezone`.

> **Nota importante:** La hora de ejecución (08:00) es la hora del servidor, no la de cada tenant/paciente. La determinación de "hoy / mañana" y el formato de la hora sí se calculan en la zona horaria de cada paciente.

---

## 2. Cambios en el Backend

### 2.1 Nueva preferencia de tenant: `enable_appointment_reminders`

Se añade una nueva clave en el JSON `preferences` de la entidad `tenant`:

```json
{
  "enable_appointment_reminders": true
}
```

- **Valor por defecto:** `true` (activado).
- **Semántica de `null`/ausente:** si la clave no está presente en el JSON almacenado (tenants creados antes del despliegue o peticiones que omiten la clave), el backend la trata como **activada**. Por tanto, para desactivar los recordatorios de un tenant es necesario enviarla explícitamente con valor `false`.
- **Verificación en el código:** `AppointmentReminderService` considera los recordatorios activados si `enable_appointment_reminders` es `null` o `true`.

### 2.2 Clases y archivos afectados

| Archivo | Cambio |
|---|---|
| `models/entity/TenantPreferences.java` | Nueva propiedad `enableAppointmentReminders` (`@JsonProperty("enable_appointment_reminders")`). Añadida al método `defaults()` con valor `true`. |
| `repository/AppointmentRepository.java` | Nuevo método `findScheduledInRange(tenantId, from, to)` que devuelve citas `SCHEDULED` de un tenant con `startTime` en el rango. |
| `service/AppointmentReminderService.java` | Nuevo servicio con el job `@Scheduled(cron = "0 0 8 * * *")` y la lógica de recordatorios. |
| `TusDietasApplication.java` | Añadida la anotación `@EnableScheduling` (también habilita los jobs de `NagerService` que ya existían). |

**No hay migración de base de datos:** la preferencia se guarda dentro del JSONB `preferences` existente.

### 2.3 Cuerpo de los mensajes push

| Caso | Destinatario | Título | Cuerpo |
|---|---|---|---|
| Cita de **hoy** (`es`) | Paciente (rol `USER`) | `Recordatorio de cita` | `Recuerda que tienes cita con nosotros hoy a las HH:mm` |
| Cita de **hoy** (`en`) | Paciente (rol `USER`) | `Appointment reminder` | `Remember you have an appointment with us today at HH:mm` |
| Cita de **mañana** (`es`) | Paciente (rol `USER`) | `Recordatorio de cita` | `Recuerda tu cita de mañana a las HH:mm` |
| Cita de **mañana** (`en`) | Paciente (rol `USER`) | `Appointment reminder` | `Remember your appointment tomorrow at HH:mm` |

- El idioma se toma del campo `language` del paciente (si no empieza por `en`, se usa español).
- La hora `HH:mm` se formatea en el huso horario del paciente (campo `timezone`; si no es válido, se usa `Europe/Madrid` como fallback).
- Se usa el mismo mecanismo existente de identificación por `external_id` (el UUID del paciente en la BD) vía OneSignal.

---

## 3. Integración en Frontend (Web / Panel de Administración)

### 3.1 Leer el estado de los recordatorios

La preferencia se obtiene dentro del objeto `preferences` en el perfil del tenant:

- **Endpoint:** `GET /api/tenant/{tenantId}/profile`
- **Permisos:** `VIEW_TENANT_BRANDING` o `MANAGE_TENANT`
- **Respuesta relevante:**
```json
{
  "id": "...",
  "name": "Centro...",
  "preferences": {
    "...otras claves...",
    "enable_appointment_reminders": true
  }
}
```

> **Regla de negocio para el frontend:** si `enable_appointment_reminders` no aparece en la respuesta (tenant antiguo), el backend lo interpreta como **activado**. El switch en la UI debe mostrarse como `ON` en ese caso.

### 3.2 Activar / desactivar los recordatorios

Se hace actualizando el objeto completo de preferencias del tenant. Existen dos endpoints equivalentes (ambos reemplazan **todo** el JSON `preferences`):

- **Endpoint (recomendado):** `PUT /api/tenant/{tenantId}/preferences`
  - **Permiso:** `MANAGE_TENANT`
- **Alternativa:** `PUT /api/tenant/{tenantId}/branding/preferences`
  - **Permiso:** `MANAGE_TENANT_BRANDING`

**Body (ejemplo):**
```json
{
  "enable_vacation_module": true,
  "enable_clock_in_module": true,
  "default_language": "es-ES",
  "primary_color": "#005ac2",
  "keycloak_sync_mode": "IMPORT",
  "from_email": "no-reply@carajillolabs.com",
  "standard_vacation_days": 22.0,
  "active_anamnesis_fields": [],
  "ai_enabled": false,
  "gemini_api_key": null,
  "show_price": false,
  "enable_appointment_reminders": false
}
```

> **Advertencia importante:** como el `PUT` reemplaza el JSON completo de preferencias, el frontend debe **enviar siempre el objeto de preferencias íntegro** (con todas las claves que quiera conservar). Si se omite `enable_appointment_reminders`, se guardará como `null` y el backend lo tratará como **activado**. Para desactivar el módulo hay que enviar explícitamente `"enable_appointment_reminders": false`.

### 3.3 UI sugerida

- Sección de **Configuración del centro → Notificaciones** o similar.
- Un interruptor (toggle) "Recordatorios de cita por push".
- Estado inicial: leer de `GET /api/tenant/{tenantId}/profile` → `preferences.enable_appointment_reminders` (valor ausente = ON).
- Al cambiar: `PUT /api/tenant/{tenantId}/preferences` con el objeto completo de preferencias y el nuevo valor de la clave.

---

## 4. Implicaciones para la App Móvil (Flutter)

### 4.1 Requisitos previos (ya existentes)

- La app debe registrar al usuario en OneSignal con su UUID (`OneSignal.login(userId)`) para recibir notificaciones — ver `doc/citas_pacientes_onesignal.md`.
- El **paciente debe sincronizar su zona horaria e idioma** (endpoint `PATCH /api/v1/users/me/locale`) para que la hora del recordatorio se muestre correctamente y en su idioma — ver `doc/user_locale_sync.md`.

### 4.2 Comportamiento para el usuario

- El usuario recibirá a las 08:00 (hora del servidor) una notificación push con título y cuerpo ya formateados por el backend (no es necesaria ninguna transformación en la app).
- La notificación de "mañana" llega el día anterior a la cita; la de "hoy" llega el mismo día.
- Las citas ya iniciadas o fuera del rango (hoy/mañana del paciente) no generan recordatorio.

### 4.3 Requisitos de plataforma (push)

- iOS/Android: permisos de notificación de OneSignal estándar (sin cambios).
- Si el paciente tiene la app actualizada y su locale sincronizado, la hora en el cuerpo (`HH:mm`) será correcta para su zona.

---

## 5. Notas Operativas

- **Duplicidad de envíos:** el job está pensado para una única instancia. Si se despliegan varias réplicas con `@EnableScheduling`, cada réplica ejecutará el job y se enviarían recordatorios duplicados (habrá que blindarlo con bloqueo distribuido si se horizonta en el futuro).
- **Hora de ejecución:** 08:00 hora del servidor. Actualmente no es configurable por tenant.
- **Combinación con otros disparadores:** las notificaciones de creación/cambio de estado de citas (`AppointmentService`) son independientes de este job y siguen funcionando igual.

---

## 6. Resumen de Archivos Cambiados

| Ruta | Descripción |
|---|---|
| `src/main/java/.../models/entity/TenantPreferences.java` | Nueva preferencia + helper. |
| `src/main/java/.../repository/AppointmentRepository.java` | Query `findScheduledInRange`. |
| `src/main/java/.../service/AppointmentReminderService.java` | **Nuevo**: job diario 08:00 y envío de recordatorios. |
| `src/main/java/.../TusDietasApplication.java` | `@EnableScheduling`. |
| `src/test/java/.../service/AppointmentReminderServiceTest.java` | **Nuevo**: pruebas del servicio (7 casos). |
| `src/test/java/.../service/{TenantServiceTest, AppointmentTypeServiceTest, MenuTemplateUploadServiceTest}.java` | Actualizados por el nuevo argumento del record `TenantPreferences`. |