# Funcionalidad de Precios de Consultas y Cálculo de Ingresos

## 📋 Descripción General

Se ha implementado una nueva funcionalidad que permite:

1. **Gestionar precios de tipos de consulta** en la entidad `AppointmentType`
2. **Congelar el precio** en cada cita al momento de su creación (para mantener histórico inmutable)
3. **Controlar la visibilidad del precio** para los clientes mediante `TenantPreferences`
4. **Calcular ingresos totales** filtrando por rango de fechas

## 🔧 Cambios en Base de Datos

### Migración Flyway: `V20__add_prices.sql`

Se han añadido dos columnas de tipo `DECIMAL(10,2)`:

- **`appointment_type.price`**: Precio base de cada tipo de consulta
- **`appointment.price`**: Precio congelado al momento de crear la cita (copia del precio del `AppointmentType`)

```sql
ALTER TABLE appointment_type ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE appointment ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00;
```

## 📝 Cambios en Entidades

### 1. `AppointmentType.java`

Se ha añadido el campo `price` de tipo `BigDecimal`:

```java
@Column(name = "price", nullable = false, precision = 10, scale = 2)
@Builder.Default
private BigDecimal price = BigDecimal.ZERO;
```

### 2. `Appointment.java`

Se ha añadido el campo `price` para guardar el precio congelado:

```java
@Column(name = "price", nullable = false, precision = 10, scale = 2)
@Builder.Default
private BigDecimal price = BigDecimal.ZERO;
```

### 3. `TenantPreferences.java`

Se ha añadido un nuevo campo `record` para controlar si mostrar o no el precio a los clientes:

```java
@JsonProperty("show_price")
boolean showPrice
```

**Valor por defecto**: `false` (los precios NO se muestran a clientes)

En el método `defaults()`:

```java
public static TenantPreferences defaults() {
    return new TenantPreferences(
            // ... otros campos ...
            false  // show_price = false
    );
}
```

## 🔌 Cambios en Capas DTO y API

### `AppointmentTypeDto.java`

Se ha añadido el campo `price`:

```java
public record AppointmentTypeDto(
        UUID id,
        UUID tenantId,
        String name,
        int durationMinutes,
        BigDecimal price,  // ← NUEVO
        boolean isDefault,
        boolean isActive,
        Instant createdAt
) {
}
```

### `CreateAppointmentTypeRequest.java`

Se ha añadido validación para el precio (obligatorio, mínimo 0.00):

```java
public record CreateAppointmentTypeRequest(
        @NotBlank String name,
        @Positive int durationMinutes,
        @NotNull @DecimalMin("0.00") BigDecimal price,  // ← NUEVO
        boolean isDefault
) {
}
```

### `UpdateAppointmentTypeRequest.java`

Se ha añadido el campo price para actualizar (opcional):

```java
public record UpdateAppointmentTypeRequest(
        String name,
        @Positive Integer durationMinutes,
        @DecimalMin("0.00") BigDecimal price,  // ← NUEVO
        Boolean isDefault,
        Boolean isActive
) {
}
```

## 🎯 Lógica de Negocio

### `AppointmentTypeService.java`

- Mapea el campo `price` al crear y actualizar tipos de consulta
- En el método `toDto()` se incluye el precio en la respuesta

### `AppointmentService.java`

#### Creación de Citas

Al crear una nueva cita, se **copia automáticamente el precio** del `AppointmentType`:

```java
var appointment = Appointment.builder()
        .tenantId(tenantId)
        .nutritionist(nutritionist)
        .patient(patient)
        .appointmentType(type)
        .startTime(startTime)
        .endTime(endTime)
        .notes(request.notes())
        .price(type != null ? type.getPrice() : BigDecimal.ZERO)  // ← COPIA EL PRECIO
        .build();
```

#### Cálculo de Ingresos

Nuevo método `getTotalRevenue()`:

```java
@Transactional(readOnly = true)
public BigDecimal getTotalRevenue(UUID tenantId, Instant startDate, Instant endDate) {
    var total = appointmentRepository.calculateTotalRevenue(tenantId, startDate, endDate);
    return total != null ? total : BigDecimal.ZERO;
}
```

### `AppointmentRepository.java`

Nueva query JPQL que suma ingresos:

```java
@Query("SELECT SUM(a.price) FROM Appointment a " +
       "WHERE a.tenantId = :tenantId AND a.status = 'COMPLETED' " +
       "AND a.startTime >= :startDate AND a.startTime <= :endDate")
BigDecimal calculateTotalRevenue(
        UUID tenantId,
        Instant startDate,
        Instant endDate
);
```

**Nota**: Solo suma citas con estado `COMPLETED`.

## 🔗 Nuevos Endpoints

### 1. Crear Tipo de Consulta con Precio

**Endpoint**: `POST /tenant/{tenantId}/appointment-types`

**Request Body**:
```json
{
  "name": "Primera Consulta",
  "durationMinutes": 50,
  "price": 75.50,
  "isDefault": true
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Primera Consulta",
  "durationMinutes": 50,
  "price": 75.50,
  "isDefault": true,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### 2. Actualizar Tipo de Consulta (incluyendo precio)

**Endpoint**: `PUT /tenant/{tenantId}/appointment-types/{typeId}`

**Request Body** (campos opcionales):
```json
{
  "name": "Primera Consulta - Actualizada",
  "price": 85.00,
  "durationMinutes": 60
}
```

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Primera Consulta - Actualizada",
  "durationMinutes": 60,
  "price": 85.00,
  "isDefault": true,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### 3. Obtener Total de Ingresos (NEW)

**Endpoint**: `GET /tenant/{tenantId}/appointments/revenue?startDate={start}&endDate={end}`

**Parámetros**:
- `startDate` (obligatorio): Fecha y hora de inicio (formato ISO 8601: `2024-01-01T00:00:00Z`)
- `endDate` (obligatorio): Fecha y hora de fin (formato ISO 8601: `2024-12-31T23:59:59Z`)

**Ejemplo**:
```
GET /tenant/123e4567-e89b-12d3-a456-426614174000/appointments/revenue?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z
```

**Response** (200 OK):
```
5250.75
```

**Nota**: 
- Solo cuenta citas con estado `COMPLETED`
- El precio considerado es el **precio congelado** al momento de crear la cita
- Si no hay citas completadas en el rango, devuelve `0`

---

## 🎨 Ejemplo de Flujo Completo

### 1. Crear tipo de consulta con precio

```bash
curl -X POST http://localhost:8080/tenant/123e4567-e89b-12d3-a456-426614174000/appointment-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Consulta General",
    "durationMinutes": 30,
    "price": 50.00,
    "isDefault": true
  }'
```

**Respuesta**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Consulta General",
  "durationMinutes": 30,
  "price": 50.00,
  "isDefault": true,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### 2. Crear cita (el precio se copia automáticamente)

```bash
curl -X POST http://localhost:8080/tenant/123e4567-e89b-12d3-a456-426614174000/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "nutritionistId": "nut-uuid-123",
    "patientId": "patient-uuid-456",
    "startTime": "2024-02-01T10:00:00Z",
    "endTime": "2024-02-01T10:30:00Z",
    "typeId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
  }'
```

**Nota**: El campo `price` en la respuesta de cita NO se devuelve en el DTO actual, pero se guarda en BD.

### 3. Marcar cita como completada

```bash
curl -X PATCH http://localhost:8080/tenant/123e4567-e89b-12d3-a456-426614174000/appointments/cita-uuid/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "status": "COMPLETED"
  }'
```

### 4. Obtener total de ingresos del mes

```bash
curl -X GET 'http://localhost:8080/tenant/123e4567-e89b-12d3-a456-426614174000/appointments/revenue?startDate=2024-02-01T00:00:00Z&endDate=2024-02-29T23:59:59Z' \
  -H "Authorization: Bearer TOKEN"
```

**Respuesta**:
```
150.00
```

(3 citas completadas × 50.00 = 150.00)

---

## 🔐 Seguridad

- **Endpoint de ingresos** (`GET /appointments/revenue`): Requiere permiso `VIEW_REVENUE` en el tenant (asignado a roles **ADMIN** y **NUTRITIONIST**)
- **Crear/Actualizar tipo consulta**: Requiere permiso `MANAGE_APPOINTMENTS` en el tenant
- Los datos están filtrados por `tenantId` automáticamente (multitenancy)
- El permiso `VIEW_REVENUE` se asignó mediante migración `V21__add_view_revenue_permission.sql`

---

## 📱 Consideraciones para Frontend

### Mostrar o Ocultar Precio

El precio se debe mostrar/ocultar basándose en `TenantPreferences.showPrice`:

```typescript
// En TypeScript/Angular
const tenant = this.tenantService.getTenant();
const shouldShowPrice = tenant.preferences.show_price;

if (shouldShowPrice) {
  // Mostrar precio en la UI
  console.log(`Precio: $${appointmentType.price}`);
} else {
  // Ocultar precio
  console.log('Precio no disponible para este tenant');
}
```

### Formateo de Moneda

Usar un pipe de moneda para formatear los precios:

```typescript
// Angular
{{ appointmentType.price | currency }}
```

O en JavaScript puro:

```javascript
const formatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR'
});

console.log(formatter.format(75.50)); // €75,50
```

### Campos Nuevos en Formularios

Al crear o editar un tipo de consulta, añadir un campo de entrada para el precio:

```html
<!-- Template HTML -->
<form [formGroup]="appointmentTypeForm">
  <input formControlName="name" placeholder="Nombre del tipo de consulta">
  <input formControlName="durationMinutes" type="number" placeholder="Duración (minutos)">
  <input formControlName="price" type="number" step="0.01" placeholder="Precio (€)">
  <button type="submit">Guardar</button>
</form>
```

### Gráficos de Ingresos

#### Patrón Básico: Ingresos por Mes/Período

Para mostrar ingresos por período, hacer llamadas al endpoint `/revenue`:

```typescript
// Service
getRevenueByMonth(tenantId: string, year: number, month: number): Observable<number> {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
  
  return this.http.get<number>(
    `/tenant/${tenantId}/appointments/revenue?startDate=${startDate}&endDate=${endDate}`
  );
}

// Componente
getMonthlyRevenue() {
  this.appointmentService.getRevenueByMonth(this.tenantId, 2024, 2).subscribe(
    revenue => {
      console.log('Ingresos de febrero:', revenue);
      // Actualizar gráfico
    }
  );
}
```

#### Llamadas Paralelas para Gráficos Anuales

Para mostrar un gráfico de 12 meses, se realizarán **12 peticiones paralelas** (una por cada mes). Usar `forkJoin` (RxJS) o `Promise.all()` para gestionar un único estado de carga (loading) y manejar errores parciales:

**Recomendación con RxJS/Angular:**

```typescript
getAnnualRevenue(tenantId: string, year: number): Observable<{ month: number; revenue: number }[]> {
  const requests = [];
  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    
    requests.push(
      this.http.get<number>(
        `/tenant/${tenantId}/appointments/revenue?startDate=${startDate}&endDate=${endDate}`
      ).pipe(
        map(revenue => ({ month, revenue })),
        catchError(error => {
          console.error(`Error fetching revenue for month ${month}:`, error);
          return of({ month, revenue: 0 }); // Fallback a 0 en caso de error
        })
      )
    );
  }
  
  return forkJoin(requests);
}

// Componente
isLoading = false;

loadAnnualRevenue(year: number) {
  this.isLoading = true;
  this.appointmentService.getAnnualRevenue(this.tenantId, year).subscribe(
    monthlyData => {
      this.chartData = monthlyData;
      this.isLoading = false;
    },
    error => {
      console.error('Error loading annual revenue:', error);
      this.isLoading = false;
    }
  );
}
```

#### Filtro por Nutricionista

El endpoint `/revenue` ahora acepta un parámetro opcional `nutritionistId` para filtrar ingresos por nutricionista específica:

```typescript
getRevenueByNutritionist(
  tenantId: string,
  nutritionistId: string,
  year: number,
  month: number
): Observable<number> {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
  
  return this.http.get<number>(
    `/tenant/${tenantId}/appointments/revenue?startDate=${startDate}&endDate=${endDate}&nutritionistId=${nutritionistId}`
  );
}

// Componente con filtro
getRevenueWithFilter(year: number, month: number, nutritionistId?: string) {
  const request = nutritionistId
    ? this.appointmentService.getRevenueByNutritionist(this.tenantId, nutritionistId, year, month)
    : this.appointmentService.getRevenueByMonth(this.tenantId, year, month);
  
  request.subscribe(revenue => {
    console.log(`Ingresos: ${revenue}`);
    // Actualizar UI
  });
}
```

#### Zonas Horarias (Timezones)

**⚠️ Consideración Importante:** Los "buckets" de fechas se calculan en la **zona horaria local del cliente**. El frontend debe:

1. **Generar rangos de fechas basándose en la zona horaria local**, por ejemplo:
   - Inicio del mes: `new Date(year, month - 1, 1, 0, 0, 0)` (medianoche en hora local)
   - Fin del mes: `new Date(year, month, 0, 23, 59, 59)` (casi medianoche siguiente en hora local)

2. **Convertir a UTC (ISO 8601)** antes de enviar al backend:
   ```typescript
   const localDate = new Date(2024, 0, 1); // 1 de enero, hora local
   const utcString = localDate.toISOString(); // Convertir a UTC
   ```

3. **El agrupamiento visual de ingresos ocurre en la zona horaria del cliente**, no en UTC. Esto significa:
   - Si el cliente está en `CET (UTC+1)`, los ingresos se agruparán en ese huso horario.
   - Si se implementa un endpoint agregado en el futuro (ej. `/revenue/breakdown?groupBy=month`), el backend deberá recibir la zona horaria del cliente para agrupar consistentemente.

**Documentación para Casos Edge:**
- Un usuario en `UTC+0` verá el mes de enero del `2024-01-01T00:00:00Z` al `2024-01-31T23:59:59Z`.
- Un usuario en `UTC+8` verá el mes de enero del `2023-12-31T16:00:00Z` al `2024-01-31T15:59:59Z` (en términos UTC).

#### Escalabilidad Futura

Si la carga de dashboards crece significativamente en el futuro, se recomienda implementar un **endpoint de agregación nativa** en el backend:

```
GET /tenant/{tenantId}/appointments/revenue/breakdown?groupBy=month&year=2024&nutritionistId={id}
```

Ventajas:
- ✅ Una sola petición en lugar de 12
- ✅ Agregación directa en base de datos (más eficiente)
- ✅ Estandarización de criterios temporales (no depende de la zona horaria del cliente)
- ✅ Mejor manejo de edge cases

Estructura de respuesta propuesta:
```json
{
  "year": 2024,
  "groupBy": "month",
  "data": [
    { "period": "2024-01", "revenue": 1250.50, "count": 5 },
    { "period": "2024-02", "revenue": 2100.75, "count": 8 }
  ]
}
```

---

## 🧪 Casos de Prueba

### Test Case 1: Crear tipo de consulta con precio

```
Given: Usuario con permiso MANAGE_APPOINTMENTS
When: POST /tenant/{id}/appointment-types con price=75.50
Then: Response 201 con price=75.50 en el objeto
```

### Test Case 2: Precio se copia al crear cita

```
Given: Tipo de consulta con price=50.00
When: Crear nueva cita con ese tipo
Then: El campo appointment.price en BD = 50.00
```

### Test Case 3: Cambiar precio no afecta citas pasadas

```
Given: Cita creada con price=50.00
When: Cambiar precio del AppointmentType a 100.00
Then: La cita sigue con price=50.00 (inmutable)
```

### Test Case 4: Calcular ingresos de rango

```
Given: 3 citas completadas en febrero con price=50.00 cada una
When: GET /revenue?start=2024-02-01&end=2024-02-29
Then: Response = 150.00
```

### Test Case 5: Ocultar precio a clientes

```
Given: TenantPreferences.showPrice = false
When: Cliente obtiene lista de AppointmentTypes
Then: El frontend oculta el campo price (depende del cliente)
```

---

## ✅ Checklist de Implementación

- [x] Migración Flyway V20 creada
- [x] Entidades actualizadas (AppointmentType, Appointment, TenantPreferences)
- [x] DTOs y Requests actualizados
- [x] Servicios implementados (mapeo de price, getTotalRevenue)
- [x] Endpoint de revenue creado
- [x] Validaciones añadidas
- [x] Documentación completa
- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] Deploy a producción

---

## 📞 Soporte

Para dudas o problemas de integración, consultar con el equipo backend.
