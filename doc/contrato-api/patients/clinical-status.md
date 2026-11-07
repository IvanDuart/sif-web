# Estado clínico del paciente

El estado clínico describe la situación asistencial del paciente en un centro. Es **independiente** del acceso técnico (`app_user.enabled`, Keycloak) y del rol.

## Estados

| Estado | Significado | Escritura |
|---|---|---|
| `ONBOARDING` | Alta en curso | Permitida |
| `ACTIVE` | Paciente activo | Permitida |
| `PAUSED` | Tratamiento en pausa | Solo lectura |
| `DISCHARGED` | Alta clínica | Solo lectura |
| `DROPPED_OUT` | Abandono | Solo lectura |

`enabled`/`disabledAt` siguen controlando si el usuario puede autenticarse. El estado clínico **no** toca Keycloak ni revoca el acceso.

## Endpoints

### Cambiar estado

```http
PATCH /api/tenant/{tenantId}/users/{userId}/clinical-status
Content-Type: application/json

{
  "clinicalStatus": "DISCHARGED",
  "reason": "Objetivo alcanzado"
}
```

Requiere `MANAGE_USER`. Solo aplica a usuarios con rol `PATIENT`.

Respuesta:

```json
{
  "userId": "...",
  "clinicalStatus": "DISCHARGED",
  "reason": "Objetivo alcanzado",
  "changedAt": "2026-10-30T12:00:00Z"
}
```

### Historial

```http
GET /api/tenant/{tenantId}/users/{userId}/clinical-status/history
```

Requiere `VIEW_USER` o ser el propio paciente.

```json
[
  {
    "id": "...",
    "previousStatus": "ACTIVE",
    "newStatus": "DISCHARGED",
    "reason": "Objetivo alcanzado",
    "changedAt": "2026-10-30T12:00:00Z",
    "changedBy": "nutricionista@centro.com"
  }
]
```

## Reglas de acceso

- `ONBOARDING` y `ACTIVE`: lectura y escritura.
- `PAUSED`, `DISCHARGED` y `DROPPED_OUT`: lectura permitida; las peticiones de escritura bajo `/tenant/{tenantId}/...` se rechazan con `403` y `code = error.clinical_status_read_only`.
- El login sigue funcionando mientras `app_user.enabled = true`.
- El historial clínico queda registrado en `clinical_status_history`.

## Listado de pacientes

`TenantUserDto` incluye:

- `clinicalStatus`
- `clinicalStatusReason`
- `clinicalStatusChangedAt`

Filtro:

```http
GET /api/tenant/{tenantId}/users/by-type/PATIENT?clinicalStatus=DISCHARGED
```

Ordenación:

```http
GET /api/tenant/{tenantId}/users/by-type/PATIENT?sort=clinicalStatus,asc
```

Alias aceptados: `estadoClinico`, `clinicalStatus`.

## Migración

`V52__clinical_status.sql`:

- Añade `clinical_status`, `clinical_status_reason` y `clinical_status_changed_at` a `user_tenant_role`.
- Crea `clinical_status_history`.
- Inicializa el estado de las membresías existentes a `ACTIVE`.
- Inserta un registro inicial de historial por membresía.

## Acciones para frontend/app

1. Mostrar el estado clínico en la ficha y el listado de pacientes.
2. Permitir cambiarlo solo a staff con `MANAGE_USER`.
3. Ocultar acciones de escritura (citas, menús, diario, mediciones) para pacientes en estado de solo lectura.
4. Mantener visible el historial y los datos de lectura.
5. No confundir el estado clínico con el toggle de acceso (`enabled`).
