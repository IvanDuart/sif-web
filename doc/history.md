# Histórico de cambios — Perfil clínico y mediciones corporales

## 1. Resumen

Se amplía el modelo de datos para soportar perfil clínico del usuario (fecha de nacimiento, altura, edad calculada), mediciones corporales con histórico (peso, IMC, masa muscular, % grasa) ligadas a tenant, y trazabilidad de asignación de menús. Edad e IMC son valores calculados virtualmente, nunca persistidos.

---

## 2. Cambios en el modelo de datos

### 2.1 AppUser — nuevos campos

| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| `birth_date` | `DATE` | Sí | Fecha de nacimiento (sin hora) |
| `height_cm` | `NUMERIC(5,1)` | Sí | Altura en centímetros (ej. `175.5`) |
| `age` | — | — | **Virtual** — calculado vía `@Transient` como `Period.between(birthDate, LocalDate.now()).getYears()` |

### 2.2 Nueva tabla: `body_measurement`

```sql
CREATE TABLE body_measurement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenant(id)   ON DELETE CASCADE,
    measured_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    weight_kg       NUMERIC(5,2),
    body_fat_pct    NUMERIC(4,1),
    muscle_mass_kg  NUMERIC(5,2),
    notes           TEXT,
    recorded_by     VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_bm_any_metric CHECK (
        weight_kg IS NOT NULL OR body_fat_pct IS NOT NULL OR muscle_mass_kg IS NOT NULL
    )
);

CREATE INDEX idx_body_measurement_user_tenant_date
    ON body_measurement (app_user_id, tenant_id, measured_at DESC);
CREATE INDEX idx_body_measurement_tenant ON body_measurement (tenant_id);
```

**Reglas de la tabla:**
- Todas las métricas son `NULL` por separado, pero al menos una debe estar presente (`ck_bm_any_metric`).
- `measured_at` puede ser una fecha pasada (para cargar histórico), pero **no puede ser futura**.
- `bmi` (IMC) **no se persiste** — se calcula en cada lectura.
- Las mediciones pertenecen a un par `(user, tenant)`. Un mismo usuario en dos tenants no comparte histórico.

### 2.3 Menu — nuevos campos de asignación

| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| `assigned_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL` | Fecha en que se asignó el menú al usuario |
| `assigned_by` | `VARCHAR(255)` | Sí | Email del usuario autenticado que lo asignó (o `"system"`) |

- Backfill: para menús preexistentes, `assigned_at` toma el valor de `created_at`.
- Al crear un menú activo, los anteriores **se desactivan** pero **no se borran** — el histórico queda preservado.

---

## 3. Nuevos endpoints REST

### 3.1 Mediciones corporales

Base: `/tenant/{tenantId}/users/{userId}/measurements`

| Método | Ruta | Permiso | Request | Response | Códigos |
|---|---|---|---|---|---|
| `POST` | `/` | `MANAGE_USER` | `CreateBodyMeasurementRequest` | `BodyMeasurementDto` | 200, 400, 403, 404 |
| `GET` | `/` | `VIEW_USER` | — | `Page<BodyMeasurementDto>` | 200, 403, 404 |
| `GET` | `/latest` | `VIEW_USER` | — | `BodyMeasurementDto` | 200, **204** (sin datos), 403, 404 |
| `GET` | `/evolution` | `VIEW_USER` | — | `MeasurementHistoryDto` | 200, 403, 404 |
| `DELETE` | `/{measurementId}` | `MANAGE_USER` | — | — | 204, 403, 404 |

**POST /tenant/{tenantId}/users/{userId}/measurements** — ejemplo:

```bash
curl -X POST "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/users/00000000-0000-0000-0000-000000000002/measurements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "weightKg": 78.5,
    "bodyFatPct": 15.2,
    "muscleMassKg": 35.0,
    "notes": "Medición post-consulta",
    "measuredAt": "2026-06-09T10:00:00Z"
  }'
```

**GET /tenant/{tenantId}/users/{userId}/measurements/latest** — ejemplo:

```bash
curl "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/users/00000000-0000-0000-0000-000000000002/measurements/latest" \
  -H "Authorization: Bearer $TOKEN"
```

**GET /tenant/{tenantId}/users/{userId}/measurements/evolution** — ejemplo:

```bash
curl "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/users/00000000-0000-0000-0000-000000000002/measurements/evolution" \
  -H "Authorization: Bearer $TOKEN"
```

### 3.2 Histórico de menús

| Método | Ruta | Permiso | Response |
|---|---|---|---|
| `GET` | `/tenant/{tenantId}/menu/history?userId={userId}` | `VIEW_MENU` | `List<Menu>` |

- Devuelve los menús ordenados por `assigned_at DESC`.
- Incluye menús activos e inactivos.
- No incluye los `meals` (carga ligera).

```bash
curl "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/menu/history?userId=00000000-0000-0000-0000-000000000002" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Endpoints existentes — payloads ampliados

### 4.1 GET /tenant/{tenantId}/users — lista de usuarios del tenant

`TenantUserDto` ahora incluye:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "enabled": true,
  "birthDate": "2000-05-12",
  "age": 26,
  "heightCm": 175.5,
  "roleCode": "USER",
  "roleName": "Usuario",
  "permissions": ["VIEW_MENU"],
  "lastMeasurement": null
}
```

- `birthDate` y `heightCm` son `null` si no se han registrado.
- `age` es `null` si no hay `birthDate`.
- `lastMeasurement` sigue la misma estructura que `BodyMeasurementDto` (ver sección 7).
- Si el usuario no tiene mediciones, `lastMeasurement` es `null`.

### 4.2 POST /tenant/{tenantId}/users/invite

El body ahora acepta campos opcionales:

```json
{
  "email": "user@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "roleCode": "USER",
  "birthDate": "2000-05-12",
  "heightCm": 175.5
}
```

Si el usuario ya existía en el sistema (mismo email en otro tenant), `birthDate` y `heightCm` **actualizan** su perfil global.

### 4.3 GET /me — usuario logado

`AppUserDto` ahora incluye:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "birthDate": "2000-05-12",
  "age": 26,
  "heightCm": 175.5,
  "createdAt": "2026-01-15T10:00:00Z",
  "memberships": [ ... ]
}
```

---

## 5. Reglas de negocio y validaciones

| Regla | Comportamiento |
|---|---|
| **IMC** | Se calcula como `peso(kg) / (altura(m)²)` con 1 decimal. Devuelve `null` si falta peso o altura. |
| **Edad** | Años cumplidos entre `birthDate` y hoy. `null` si no hay `birthDate`. |
| **measuredAt futuro** | Rechazado con `400 Bad Request`. |
| **Métrica vacía** | Si no se envía ninguna métrica, DB lanza error por `CHECK`. |
| **Menú activo único** | Activar un menú desactiva los anteriores del mismo usuario+tenant. |
| **Menú inactivo** | No se elimina; permanece en el histórico con su `assigned_at`. |
| **Asignación** | `assigned_by` y `recorded_by` se rellenan con el email del JWT o `"system"` si no hay sesión. |

---

## 6. Permisos por endpoint

| Endpoint | Permiso |
|---|---|
| `POST /measurements` | `MANAGE_USER` |
| `GET /measurements` | `VIEW_USER` |
| `GET /measurements/latest` | `VIEW_USER` |
| `GET /measurements/evolution` | `VIEW_USER` |
| `DELETE /measurements/{id}` | `MANAGE_USER` |
| `GET /menu/history` | `VIEW_MENU` |
| Los endpoints existentes (`/users`, `/invite`, `/me`, etc.) mantienen los permisos que ya tenían. |

---

## 7. Schemas JSON — request y response

### BodyMeasurementDto (response)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "measuredAt": "2026-06-09T10:00:00Z",
  "weightKg": 78.50,
  "bodyFatPct": 15.2,
  "muscleMassKg": 35.00,
  "bmi": 25.6,
  "notes": "Medición post-consulta",
  "recordedBy": "nutri@clinica.com",
  "createdAt": "2026-06-09T10:00:00Z"
}
```

- `weightKg` — `null` si no se registró peso en esa entrada.
- `bodyFatPct` — `null` si no se registró.
- `muscleMassKg` — `null` si no se registró.
- `bmi` — calculado con el peso de esta entrada y la **altura actual** del usuario. `null` si falta peso o altura.
- `notes` — opcional, texto libre.
- `createdAt` — timestamp del insert (no confundir con `measuredAt`).

### CreateBodyMeasurementRequest (request)

```json
{
  "weightKg": 78.50,
  "bodyFatPct": 15.2,
  "muscleMassKg": 35.00,
  "measuredAt": "2026-06-09T10:00:00Z",
  "notes": "Medición post-consulta"
}
```

- Todos los campos métricos son opcionales, pero al menos uno obligatorio.
- `measuredAt` opcional — si no se envía, se usa `Instant.now()`.
- `measuredAt` no puede ser futuro.
- `weightKg`, `muscleMassKg` aceptan hasta 2 decimales, rango hasta 999.99.
- `bodyFatPct` acepta hasta 1 decimal, rango hasta 99.9.

### MeasurementHistoryDto (response para /evolution)

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "heightCm": 175.5,
  "points": [
    {
      "measuredAt": "2026-06-09T10:00:00Z",
      "weightKg": 78.50,
      "bodyFatPct": 15.2,
      "muscleMassKg": 35.00,
      "bmi": 25.6
    }
  ]
}
```

- `heightCm` es la altura actual del usuario para que el frontend pueda recalcular el IMC si lo necesita.
- Ordenado por `measuredAt DESC`.

---

## 8. Cálculo de IMC y edad

### IMC

```
function computeBmi(weightKg: Decimal | null, heightCm: Decimal | null): Decimal | null {
    if (!weightKg || !heightCm || heightCm === 0) return null;
    const heightM = heightCm / 100;
    return Math.round(weightKg / (heightM * heightM) * 10) / 10;
}
```

### Edad

```
function computeAge(birthDate: LocalDate | null): number | null {
    if (!birthDate) return null;
    return Period.between(birthDate, today).years;
}
```

**Nota importante:** El IMC se calcula con la altura **actual** del usuario. Si la altura cambia, los IMCs de mediciones pasadas también cambian al recuperarlas (no hay inconsistencia porque el IMC no se persiste). El frontend debe ser consciente de esto si cachea valores de IMC localmente.

---

## 9. Notas para el frontend

### Paginación
- `GET /measurements` usa paginación Spring: `?page=0&size=20&sort=measuredAt,desc`.
- Parámetros: `page` (0‑based), `size`, `sort=campo,dirección`.
- Respuesta: `Page<BodyMeasurementDto>` con `content`, `totalElements`, `totalPages`, `number`, `size`.

### Estados vacíos
- **Sin mediciones**: `GET /latest` devuelve **`204 No Content`** (no `404`). La lista del tenant (`GET /users`) devuelve `lastMeasurement: null`.
- **Sin fecha de nacimiento**: `birthDate: null`, `age: null`. El frontend puede mostrar "—" en estos campos.

### Comportamiento por tenant
- Las mediciones están ligadas a `(user_id, tenant_id)`. Si un usuario pertenece a dos tenants, **no** ve el histórico del otro.
- `lastMeasurement` que devuelve `GET /users` es específico del tenant consultado.

### Borrado de usuario del tenant (`revokeAccess`)
- Las mediciones del usuario en ese tenant **no se eliminan** — sobreviven al `revokeAccess`.
- Si el usuario vuelve a ser invitado, recupera su histórico de mediciones (no así los menús inactivos, que también se preservan).

### Formatos de fecha
| Campo | Tipo Java | Serialización JSON | Ejemplo |
|---|---|---|---|
| `birthDate` | `LocalDate` | `"YYYY-MM-DD"` | `"2000-05-12"` |
| `measuredAt`, `createdAt`, `assignedAt` | `Instant` | `"YYYY-MM-DDTHH:mm:ssZ"` | `"2026-06-09T15:42:11Z"` |

- Los `Instant` viajan en UTC. El frontend debe convertirlos a la zona horaria local para mostrarlos.

### Nota sobre la altura y el IMC
- Si el usuario actualiza su altura, los IMCs históricos (calculados con la nueva altura) pueden diferir de lo que el frontend tenía cacheados de requests previas. No hay inconsistencia real — el IMC siempre se calcula con la altura actual. Si esto es un problema clínico, el frontend puede optar por recalcular el IMC localmente si también cachea la altura del momento de cada medición.

---

## Apéndice — Migración V4 SQL

```sql
-- app_user nuevos campos
ALTER TABLE app_user ADD COLUMN birth_date DATE;
ALTER TABLE app_user ADD COLUMN height_cm NUMERIC(5,1);

-- body_measurement
CREATE TABLE body_measurement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_user_id     UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    measured_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    weight_kg       NUMERIC(5,2),
    body_fat_pct    NUMERIC(4,1),
    muscle_mass_kg  NUMERIC(5,2),
    notes           TEXT,
    recorded_by     VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bm_user   FOREIGN KEY (app_user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_bm_tenant FOREIGN KEY (tenant_id)   REFERENCES tenant(id)   ON DELETE CASCADE,
    CONSTRAINT ck_bm_any_metric CHECK (
        weight_kg IS NOT NULL OR body_fat_pct IS NOT NULL OR muscle_mass_kg IS NOT NULL
    )
);

CREATE INDEX idx_body_measurement_user_tenant_date
    ON body_measurement (app_user_id, tenant_id, measured_at DESC);
CREATE INDEX idx_body_measurement_tenant ON body_measurement (tenant_id);

-- menu campos de asignación
ALTER TABLE menu ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE menu ADD COLUMN assigned_by VARCHAR(255);
UPDATE menu SET assigned_at = created_at WHERE assigned_at IS NULL;
ALTER TABLE menu ALTER COLUMN assigned_at SET NOT NULL;
ALTER TABLE menu ALTER COLUMN assigned_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_menu_user_tenant_assigned ON menu (app_user_id, tenant_id, assigned_at DESC);
```
