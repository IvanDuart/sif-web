# Listado general de pacientes — cambios de API para el frontend

Documento de apoyo para el rediseño de la pantalla **Pacientes** (`design/pacientes.html`).
Recoge lo implementado en el backend para que el frontend pueda construir el
listado general completo: **filtro por estado, columnas de última visita / próxima
cita, ordenación por fechas de cita, cambio de estado masivo y exportación**.

---

## 0. Aclaración importante sobre los nombres

En la petición se hablaba de un endpoint que recibe `UserSearchParams` y devuelve
`AppUserDto`. En este repositorio **esas clases no existen**; el listado general de
usuarios/pacientes de un centro es:

| Concepto de la petición | Equivalente real en el backend |
|---|---|
| `UserSearchParams` | Query params del endpoint (más `Pageable`) |
| `AppUserDto` | `TenantUserDto` |
| Endpoint de búsqueda | `GET /api/tenant/{tenantId}/users` y `GET /api/tenant/{tenantId}/users/by-type/{userType}` |

Para el **listado general de pacientes** se usa:

```
GET /api/tenant/{tenantId}/users/by-type/PATIENT
```

con lo que solo se devuelven los usuarios con rol de tipo `PATIENT` (ver `doc/userType.md`).

> Contexto path: la app se sirve bajo `/api` (`server.servlet.context-path`). En el
> resto del documento se omite el prefijo `/api` por brevedad, pero los ejemplos de
> `curl` sí lo incluyen.

---

## 1. Filtro por Estado (chips «Activos / Inactivos»)

El estado del usuario es el booleano `enabled` de `app_user`. Se ha añadido el
parámetro **`enabled`** a los dos endpoints de listado, de modo que **el filtro se
aplica en base de datos antes de paginar** (no rompe la paginación).

### Query params de `GET /tenant/{tenantId}/users/by-type/{userType}`

| Param | Tipo | Req. | Default | Notas |
|---|---|:---:|---|---|
| `userType` | `STAFF` \| `PATIENT` (path) | ✅ | — | Tipo de rol. |
| `search` | string | ❌ | — | Busca en `firstName`, `lastName`, `email` y **`phone`** (nuevo). |
| `enabled` | boolean | ❌ | — | `true` = activos, `false` = inactivos. **Omitido = sin filtrar.** |
| `page`, `size`, `sort` | Pageable | ❌ | `sort=appUser.firstName,asc` | Ver sección 3. |

Lo mismo aplica a `GET /tenant/{tenantId}/users` (todos los tipos).

### Mapeo de los chips del prototipo

El prototipo tiene 5 estados (`activo`, `nuevo`, `pausa`, `alta`, `inactivo`), pero
el backend **solo distingue habilitado / deshabilitado**. De momento:

| Chip del prototipo | Query string |
|---|---|
| Todos | *(sin `enabled`)* |
| Activos | `enabled=true` |
| Inactivos | `enabled=false` |

Los chips «Nuevos», «Sin próxima cita» y «De alta» **no se pueden resolver con un
único parámetro** en esta iteración:

- **Sin próxima cita**: se puede combinar con la ordenación por `nextAppointmentDate`
  (los `null` van al final), pero no hay todavía un filtro booleano dedicado.
- **Nuevos / De alta**: requieren un modelo de estado de negocio (p. ej. una futura
  columna `patientStatus`) que aún no existe. Si se decide implementarlo, será un
  nuevo parámetro.

### Ejemplo

```bash
# Pacientes activos del centro, buscando "laura"
curl "http://localhost:8081/api/tenant/$TENANT_ID/users/by-type/PATIENT?enabled=true&search=laura&page=0&size=25" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 2. Columnas «Última visita» y «Próxima cita»

`TenantUserDto` incorpora dos campos nuevos:

| Campo | Tipo | Descripción |
|---|---|---|
| `lastAppointmentDate` | `string` (ISO-8601 UTC) \| `null` | Inicio de la cita **`COMPLETED` o `NO_SHOW`** más reciente del paciente **en este centro**. `null` = sin visitas cerradas. |
| `nextAppointmentDate` | `string` (ISO-8601 UTC) \| `null` | Inicio de la próxima cita **`SCHEDULED` o `PROPOSED`** que todavía no ha terminado. `null` = sin cita agendada. |

Reglas:

- Están **acotadas al tenant** activo y al paciente (no mezclan datos de otros centros).
- Para usuarios de tipo `STAFF` llegan siempre `null` (no aplica).
- Los cálculos se hacen en lote para toda la página, no fila a fila.

El frontend se encarga de **formatear el relativo** («hace 3 días», «en 2 semanas»,
«hoy», etc.) como hace el prototipo. El backend entrega el instante crudo.

### Respuesta de ejemplo

```json
{
  "content": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "email": "laura.vidal@mail.com",
      "firstName": "Laura",
      "lastName": "Vidal",
      "phone": "658 71 02 33",
      "enabled": true,
      "birthDate": "1992-03-10",
      "age": 34,
      "heightCm": 168.0,
      "userType": "PATIENT",
      "roleCode": "USER",
      "roleName": "Usuario",
      "permissions": ["VIEW_MENU"],
      "lastMeasurement": null,
      "assignedNutritionistId": "11111111-...",
      "assignedNutritionistName": "Marta Ibáñez",
      "lastAppointmentDate": "2026-09-24T08:00:00Z",
      "nextAppointmentDate": "2026-10-15T09:30:00Z"
    }
  ],
  "totalElements": 148,
  "totalPages": 6,
  "size": 25,
  "number": 0
}
```

---

## 3. Ordenación (sorting) ampliada

El parámetro `sort` de Spring Data acepta `propiedad,dirección` y **varias claves
separadas por comas** (`sort=campo1,asc&sort=campo2,desc` o `sort=campo1,asc,campo2,desc`).

La ordenación se resuelve **en base de datos sobre el conjunto completo**, respetando
la paginación, y con **`NULLS LAST`** (los valores vacíos siempre al final, tanto en
ascendente como en descendente).

### Campos ordenables

| Columna del prototipo | Clave a enviar | Alias aceptados |
|---|---|---|
| Paciente | `firstName` | `nombre`, `appUser.firstName` |
| Apellidos | `lastName` | `apellidos`, `appUser.lastName` |
| Email | `email` | `appUser.email` |
| Teléfono | `phone` | `telefono`, `appUser.phone` |
| Estado | `enabled` | `estado`, `appUser.enabled` |
| Edad | `birthDate` | `edad`, `appUser.birthDate` |
| Última visita | `lastAppointmentDate` | `ultima`, `lastAppointment` |
| Próxima cita | `nextAppointmentDate` | `proxima`, `nextAppointment` |

- **Edad**: como el DTO no guarda la edad, se ordena por `birthDate`
  (`asc` = mayor edad primero; `desc` = más joven primero).
- Cualquier propiedad no reconocida se **ignora** con un `WARN` en el log (no provoca error 400).

### Valores por defecto recomendados (los del prototipo)

| Columna | Dirección por defecto |
|---|---|
| Nombre | `asc` |
| Estado | `asc` |
| Edad | `asc` |
| Teléfono | `asc` |
| Última visita | `desc` |
| Próxima cita | `asc` |

### Ejemplos

```bash
# Próxima cita más cercana primero
curl ".../users/by-type/PATIENT?sort=nextAppointmentDate,asc" -H "Authorization: Bearer $TOKEN"

# Orden compuesto: estado y luego apellidos
curl ".../users/by-type/PATIENT?sort=enabled,asc&sort=lastName,asc" -H "Authorization: Bearer $TOKEN"
```

---

## 4. Operación masiva: cambiar estado en lote

Para el checkbox por fila y la barra de acciones («Desactivar / Activar»), se añade
un endpoint que acepta un array de UUIDs.

```
PATCH /tenant/{tenantId}/users/bulk/status
```

- **Permiso**: `DISABLE_USER` (el mismo que el cambio de estado individual).
- **Body**:

```json
{
  "userIds": [
    "660e8400-e29b-41d4-a716-446655440001",
    "660e8400-e29b-41d4-a716-446655440002"
  ],
  "enabled": false
}
```

- **Respuesta `200`** — resumen con fallos parciales:

```json
{
  "requested": 2,
  "updated": 1,
  "failedIds": ["660e8400-e29b-41d4-a716-446655440002"]
}
```

Comportamiento:

- Procesa usuario a usuario. Si alguno falla (no pertenece al tenant, es el único
  admin protegido, etc.) **se continúa con el resto** y se informa en `failedIds`.
- Si `userIds` viene vacío → `400 Bad Request` (`@NotEmpty`).
- La protección del **único administrador** del centro se sigue aplicando por usuario.

```bash
curl -X PATCH "http://localhost:8081/api/tenant/$TENANT_ID/users/bulk/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"userIds":["...uuid1..."],"enabled":false}'
```

### Sobre el resto de acciones masivas del prototipo

| Acción del prototipo | Estado |
|---|---|
| Desactivar / Activar en lote | ✅ Implementado (`PATCH /users/bulk/status`) |
| Exportar | ✅ Implementado (selección: usar el mismo `export` con los UUID ya filtrados en cliente; ver §5) |
| Enviar mensaje | ❌ No implementado (canal de mensajería del centro, fuera de alcance) |
| Eliminar en lote | ❌ No implementado en esta iteración (la eliminación individual sigue en `DELETE /users/{userId}` y está restringida a `ADMIN`) |

---

## 5. Exportación CSV

Exporta **todo** el listado que cumple los mismos filtros y el mismo orden que la
pantalla (sin paginar), no solo la página visible.

```
GET /tenant/{tenantId}/users/export
```

### Query params

| Param | Tipo | Req. | Notas |
|---|---|:---:|---|
| `userType` | `STAFF` \| `PATIENT` | ❌ | Omitido = todos los usuarios. |
| `search` | string | ❌ | Igual que en el listado. |
| `enabled` | boolean | ❌ | Igual que en el listado. |
| `sort` | string | ❌ | Mismas claves que el listado. |

### Respuesta

- `Content-Type: text/csv;charset=UTF-8`
- `Content-Disposition: attachment; filename="pacientes.csv"`
- **UTF-8 con BOM** y separador **`;`** para que Excel lo abra bien en español.
- Cabecera:
  `Nombre;Apellidos;Email;Telefono;Estado;Edad;Profesional;Ultima visita;Proxima cita`
- Fechas en ISO-8601 UTC (p. ej. `2026-10-15T09:30:00Z`).
- Permiso requerido: `VIEW_USER`.

```bash
curl -L "http://localhost:8081/api/tenant/$TENANT_ID/users/export?userType=PATIENT&enabled=true&sort=lastName,asc" \
  -H "Authorization: Bearer $TOKEN" -o pacientes.csv
```

> Para «Exportar selección»: el endpoint está pensado para exportar por filtros. Si
> se quiere exportar exactamente las filas marcadas, la opción más sencilla es que el
> frontend genere el CSV en cliente con los datos ya cargados, o (si crece la
> necesidad) pedir un endpoint que acepte `userIds`.

---

## 6. Modelos TypeScript

```typescript
export type RoleType = 'STAFF' | 'PATIENT';

export interface TenantUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  enabled: boolean;
  birthDate: string | null;      // ISO date (yyyy-MM-dd)
  age: number | null;
  heightCm: number | null;
  userType: RoleType;
  roleCode: string;
  roleName: string;
  permissions: string[];
  lastMeasurement: BodyMeasurement | null;
  assignedNutritionistId: string | null;
  assignedNutritionistName: string | null;
  lastAppointmentDate: string | null;  // ISO-8601 UTC
  nextAppointmentDate: string | null;  // ISO-8601 UTC
}

export interface BulkOperationResult {
  requested: number;
  updated: number;
  failedIds: string[];
}

export interface UserListQuery {
  search?: string;
  enabled?: boolean;
  page?: number;
  size?: number;
  sort?: string;   // p.ej. 'nextAppointmentDate,asc'
}
```

### Servicio Angular (ejemplo)

```typescript
@Injectable({ providedIn: 'root' })
export class PatientListService {
  private base = '/api/tenant';

  constructor(private http: HttpClient) {}

  list(tenantId: string, query: UserListQuery): Observable<Page<TenantUser>> {
    let params = new HttpParams()
      .set('page', query.page ?? 0)
      .set('size', query.size ?? 25)
      .set('sort', query.sort ?? 'appUser.firstName,asc');

    if (query.search) params = params.set('search', query.search);
    if (query.enabled !== undefined) params = params.set('enabled', String(query.enabled));

    return this.http.get<Page<TenantUser>>(
      `${this.base}/${tenantId}/users/by-type/PATIENT`, { params }
    );
  }

  bulkSetStatus(tenantId: string, userIds: string[], enabled: boolean): Observable<BulkOperationResult> {
    return this.http.patch<BulkOperationResult>(
      `${this.base}/${tenantId}/users/bulk/status`,
      { userIds, enabled }
    );
  }

  exportUrl(tenantId: string, query: UserListQuery): string {
    let params = new HttpParams().set('userType', 'PATIENT')
      .set('sort', query.sort ?? 'appUser.firstName,asc');
    if (query.search) params = params.set('search', query.search);
    if (query.enabled !== undefined) params = params.set('enabled', String(query.enabled));
    return `${this.base}/${tenantId}/users/export?${params.toString()}`;
  }
}
```

> Nota: `sort` por defecto del backend es `appUser.firstName,asc`; el servicio puede
> seguir enviándolo explícitamente. Recuerda que las claves válidas del `sort` están
> en la sección 3.

---

## 7. Códigos de respuesta

| Código | Cuándo |
|---|---|
| `200 OK` | Listado / export / bulk correctos. |
| `400 Bad Request` | `userIds` vacío en bulk, `userType`/`enabled` mal formados. |
| `403 Forbidden` | Sin permiso `VIEW_USER` (listado/export) o `DISABLE_USER` (bulk). |
| `404 Not Found` | (Individual) usuario no pertenece al tenant. |

---

## 8. Resumen de cambios en el backend

| Fichero | Cambio |
|---|---|
| `models/dto/TenantUserDto.java` | + `lastAppointmentDate`, `nextAppointmentDate` |
| `models/dto/BulkOperationResult.java` | **Nuevo** — resumen de operación masiva |
| `controller/dto/BulkUserStatusRequest.java` | **Nuevo** — body del bulk status |
| `repository/AppointmentRepository.java` | + `findLastAppointmentDates`, `findNextAppointmentDates` |
| `service/UserTenantRoleService.java` | Filtro `enabled`, búsqueda por teléfono, ordenación (incluidas fechas de cita con `NULLS LAST`), mapeo en lote de fechas, `setUsersEnabled`, export CSV |
| `controller/UserTenantRoleController.java` | + param `enabled` en listados, + `GET /users/export`, + `PATCH /users/bulk/status` |

Sin migraciones de base de datos: todo se apoya en tablas existentes
(`app_user`, `user_tenant_role`, `appointment`).

---

## 9. Pendientes / decisiones abiertas

1. **Modelo de estado de paciente** (Nuevo / En pausa / De alta / Inactivo): hoy solo
   existe `enabled`. Si se quiere replicar los 5 estados del prototipo, hace falta una
   columna de estado de negocio y un filtro dedicado.
2. **Filtro «Sin próxima cita»**: se puede añadir un booleano
   `withoutNextAppointment=true` si se confirma que el prototipo lo necesita como
   filtro de servidor.
3. **Eliminación en lote**: pendiente de decidir si entra (complejidad por el borrado
   en cascada y los permisos; hoy solo `ADMIN` puede eliminar de uno en uno).
4. **Export por selección**: valorar endpoint que acepte `userIds` si el requisito de
   «exportar solo lo marcado» se vuelve importante.
