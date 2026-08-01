# Tenant Creation Workflow & Seed Data

Este documento describe el comportamiento del backend al crear un nuevo Tenant (Espacio de trabajo o Clínica) en el sistema, lo cual es útil para que el Frontend entienda el estado inicial de la plataforma sin tener que forzar al usuario a configurarlo todo de cero.

## ¿Quién puede crear un Tenant?
La creación de un Tenant mediante `POST /tenants` está estrictamente protegida. Solo puede ejecutarla un usuario que cumpla ambas condiciones:
1. Tener una sesión iniciada dentro de un tenant marcado como `admin_tenant = true` (Tenant de Administración Global de la plataforma).
2. Tener un rol que posea el permiso `MANAGE_TENANT` (generalmente el rol `ADMIN`).

## Datos base ("Seed Data") auto-generados
Para garantizar que el tenant sea funcional desde el segundo cero y no requiera de complejas configuraciones de arranque o "wizards", el backend autogenera los siguientes recursos durante su creación de forma sincrónica:

### 1. Preferencias del Tenant (`TenantPreferences`)
Si el payload no especifica preferencias, el sistema asignará las predeterminadas:
- Lenguaje: `es-ES`
- Color primario: `#005ac2` (azul por defecto).
- Días de vacaciones estándar: `22`
- Módulos activos: Vacaciones y Registro horario (`clock_in_module`).
- AI (Gemini): Desactivado por defecto.
- Cuestionario de Anamnesis: Se habilitan los campos base (Motivo, Historia médica, Hábitos, Estilo de vida, etc.).

### 2. Administrador Automático
El usuario (administrador de la plataforma) que ejecuta el endpoint de creación **se auto-asignará al nuevo tenant automáticamente con el rol de `ADMIN`**. 
- **Impacto Frontend**: No es necesario solicitar una invitación a un usuario de inicio. El Frontend puede directamente refrescar los tenants disponibles del usuario actual y cambiar de contexto (`Switch Tenant`) al nuevo para comenzar a operar.

### 3. Tipos de Consulta (`AppointmentType`)
Se generan automáticamente dos tipos de citas base, detectando el idioma base de las preferencias (Español o Inglés):
- **Primera Consulta / Initial consultation**: 50 minutos (Marcada como default).
- **Seguimiento / Follow-up**: 20 minutos.

### 4. Horarios por Defecto (`Schedule` y Asignaciones)
El calendario necesita un horario para permitir las reservas de consultas. El backend generará:
- **Horario Estándar**: Lunes a Viernes, con dos bloques (09:00 - 14:00 y 16:00 - 19:00).
- **Activación Inmediata**: Este horario será asignado (`TenantScheduleAssignment`) de manera válida desde la fecha de creación hasta 10 años en el futuro. 
- **Impacto Frontend**: La vista de Calendario funcionará sin necesidad de configurar primero los horarios de la clínica.
