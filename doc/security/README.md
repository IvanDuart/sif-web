# Seguridad, usuarios y roles

Documentación sobre autenticación, permisos, clasificación de usuarios y ciclo de vida de las cuentas.

## Documentos

| Documento | Contenido |
|---|---|
| [`disable_user.md`](disable_user.md) | Endpoint para habilitar/deshabilitar usuarios y alcance de permisos de `NUTRITIONIST` vs `ADMIN`. |
| [`userType.md`](userType.md) | Clasificación de roles en `STAFF` (equipo) y `PATIENT` (paciente). Base para separar listados y permisos. |
| [`user_locale_sync.md`](user_locale_sync.md) | Sincronización de zona horaria e idioma del usuario para push y fechas localizadas. |
| [`updateUser.md`](updateUser.md) | Actualización del perfil básico de usuario (nombre, email, teléfono, fecha de nacimiento, altura). |

## Relaciones con otros dominios

- **Pacientes:** el estado clínico es independiente del acceso técnico. Ver [`../patients/clinical-status.md`](../patients/clinical-status.md) y [`../patients/listado_pacientes_frontend.md`](../patients/listado_pacientes_frontend.md).
- **Citas:** los permisos de citas (`MANAGE_APPOINTMENTS`, `VIEW_APPOINTMENTS`, `REQUEST_APPOINTMENT`) se documentan en [`../appointments/appointments.md`](../appointments/appointments.md).
- **Notificaciones:** `user_locale_sync.md` es requisito para que los push lleguen traducidos y con la hora local correcta. Ver [`../notifications/sse-notificaciones-frontend.md`](../notifications/sse-notificaciones-frontend.md).
- **Perfil clínico:** los permisos `VIEW_PATIENT_PROFILE` y `MANAGE_PATIENT_PROFILE` se detallan en [`../patients/patient_profile.md`](../patients/patient_profile.md).

## Notas

- `userType` es la forma recomendada de distinguir staff de pacientes, en lugar de comparar códigos de rol concretos.
- El estado clínico (`clinical-status.md`) **no** sustituye a `enabled`/`disabledAt`: uno controla la situación asistencial y el otro el acceso real.
