# API Testing Guide - Appointment Pricing

## 🚀 Ejemplos de cURL para Probar los Endpoints

### Variables de Ejemplo

```bash
# Definir estas variables para facilitar las pruebas
TENANT_ID="123e4567-e89b-12d3-a456-426614174000"
TOKEN="tu-jwt-token-aqui"
BASE_URL="http://localhost:8080"
```

---

## 📝 Crear Tipo de Consulta con Precio

### Endpoint: `POST /tenant/{tenantId}/appointment-types`

#### Ejemplo 1: Primera Consulta

```bash
curl -X POST "$BASE_URL/tenant/$TENANT_ID/appointment-types" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Primera Consulta",
    "durationMinutes": 50,
    "price": 75.50,
    "isDefault": true
  }'
```

**Respuesta esperada (201 Created)**:
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

#### Ejemplo 2: Seguimiento

```bash
curl -X POST "$BASE_URL/tenant/$TENANT_ID/appointment-types" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Seguimiento",
    "durationMinutes": 30,
    "price": 45.00,
    "isDefault": false
  }'
```

#### Ejemplo 3: Consulta Avanzada

```bash
curl -X POST "$BASE_URL/tenant/$TENANT_ID/appointment-types" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Consulta Avanzada",
    "durationMinutes": 60,
    "price": 100.00,
    "isDefault": false
  }'
```

---

## 📝 Actualizar Tipo de Consulta (incluyendo precio)

### Endpoint: `PUT /tenant/{tenantId}/appointment-types/{typeId}`

```bash
TYPE_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X PUT "$BASE_URL/tenant/$TENANT_ID/appointment-types/$TYPE_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Primera Consulta - Actualizada",
    "durationMinutes": 55,
    "price": 85.00
  }'
```

**Respuesta esperada (200 OK)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Primera Consulta - Actualizada",
  "durationMinutes": 55,
  "price": 85.00,
  "isDefault": true,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Actualizar solo el precio

```bash
curl -X PUT "$BASE_URL/tenant/$TENANT_ID/appointment-types/$TYPE_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "price": 95.00
  }'
```

---

## 📋 Listar Tipos de Consulta

### Endpoint: `GET /tenant/{tenantId}/appointment-types?onlyActive=true`

```bash
curl -X GET "$BASE_URL/tenant/$TENANT_ID/appointment-types?onlyActive=true" \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada (200 OK)**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Primera Consulta",
    "durationMinutes": 50,
    "price": 75.50,
    "isDefault": true,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Seguimiento",
    "durationMinutes": 30,
    "price": 45.00,
    "isDefault": false,
    "isActive": true,
    "createdAt": "2024-01-15T11:00:00Z"
  }
]
```

---

## 📅 Crear Cita (con precio copiado automáticamente)

### Endpoint: `POST /tenant/{tenantId}/appointments`

```bash
NUTRITIONIST_ID="nut-uuid-123456"
PATIENT_ID="patient-uuid-789"

curl -X POST "$BASE_URL/tenant/$TENANT_ID/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nutritionistId": "'$NUTRITIONIST_ID'",
    "patientId": "'$PATIENT_ID'",
    "startTime": "2024-02-01T10:00:00Z",
    "endTime": "2024-02-01T10:50:00Z",
    "typeId": "550e8400-e29b-41d4-a716-446655440000",
    "notes": "Seguimiento de progreso"
  }'
```

**Respuesta esperada (201 Created)**:
```json
{
  "id": "app-uuid-001",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "nutritionistId": "nut-uuid-123456",
  "nutritionistName": "Dr. Juan García",
  "patientId": "patient-uuid-789",
  "patientName": "María López",
  "typeId": "550e8400-e29b-41d4-a716-446655440000",
  "typeName": "Primera Consulta",
  "startTime": "2024-02-01T10:00:00Z",
  "endTime": "2024-02-01T10:50:00Z",
  "status": "SCHEDULED",
  "notes": "Seguimiento de progreso",
  "createdAt": "2024-01-15T12:00:00Z"
}
```

**Nota**: El precio NO aparece en el DTO pero está congelado en la BD (`appointment.price = 75.50`).

---

## 🔄 Cambiar Estado de Cita a COMPLETED

### Endpoint: `PATCH /tenant/{tenantId}/appointments/{appointmentId}/status`

```bash
APPOINTMENT_ID="app-uuid-001"

curl -X PATCH "$BASE_URL/tenant/$TENANT_ID/appointments/$APPOINTMENT_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "COMPLETED"
  }'
```

**Respuesta esperada (200 OK)**:
```json
{
  "id": "app-uuid-001",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "nutritionistId": "nut-uuid-123456",
  "nutritionistName": "Dr. Juan García",
  "patientId": "patient-uuid-789",
  "patientName": "María López",
  "typeId": "550e8400-e29b-41d4-a716-446655440000",
  "typeName": "Primera Consulta",
  "startTime": "2024-02-01T10:00:00Z",
  "endTime": "2024-02-01T10:50:00Z",
  "status": "COMPLETED",
  "notes": "Seguimiento de progreso",
  "createdAt": "2024-01-15T12:00:00Z"
}
```

---

## 💰 Obtener Total de Ingresos (NEW)

### Endpoint: `GET /tenant/{tenantId}/appointments/revenue?startDate={start}&endDate={end}`

#### Ejemplo 1: Ingresos de Febrero 2024

```bash
curl -X GET "$BASE_URL/tenant/$TENANT_ID/appointments/revenue?startDate=2024-02-01T00:00:00Z&endDate=2024-02-29T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada (200 OK)**:
```
150.50
```

#### Ejemplo 2: Ingresos de enero a junio 2024

```bash
curl -X GET "$BASE_URL/tenant/$TENANT_ID/appointments/revenue?startDate=2024-01-01T00:00:00Z&endDate=2024-06-30T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada (200 OK)**:
```
2500.75
```

#### Ejemplo 3: Ingresos del año completo

```bash
curl -X GET "$BASE_URL/tenant/$TENANT_ID/appointments/revenue?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada (200 OK)**:
```
15750.00
```

---

## 🧪 Scenario: Flujo Completo de Prueba

### Paso 1: Crear dos tipos de consulta

```bash
# Crear "Primera Consulta" (€75.50)
TYPE1=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointment-types" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Primera Consulta",
    "durationMinutes": 50,
    "price": 75.50,
    "isDefault": true
  }' | jq -r '.id')

echo "Tipo 1 creado: $TYPE1"

# Crear "Seguimiento" (€45.00)
TYPE2=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointment-types" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Seguimiento",
    "durationMinutes": 30,
    "price": 45.00,
    "isDefault": false
  }' | jq -r '.id')

echo "Tipo 2 creado: $TYPE2"
```

### Paso 2: Crear 3 citas

```bash
# Cita 1: Primera Consulta
APP1=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nutritionistId": "'$NUTRITIONIST_ID'",
    "patientId": "'$PATIENT_ID'",
    "startTime": "2024-02-01T10:00:00Z",
    "typeId": "'$TYPE1'"
  }' | jq -r '.id')

echo "Cita 1 creada: $APP1"

# Cita 2: Seguimiento
APP2=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nutritionistId": "'$NUTRITIONIST_ID'",
    "patientId": "'$PATIENT_ID'",
    "startTime": "2024-02-05T14:00:00Z",
    "typeId": "'$TYPE2'"
  }' | jq -r '.id')

echo "Cita 2 creada: $APP2"

# Cita 3: Primera Consulta
APP3=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nutritionistId": "'$NUTRITIONIST_ID'",
    "patientId": "'$PATIENT_ID'",
    "startTime": "2024-02-10T11:00:00Z",
    "typeId": "'$TYPE1'"
  }' | jq -r '.id')

echo "Cita 3 creada: $APP3"
```

### Paso 3: Marcar citas como completadas

```bash
# Completar cita 1
curl -s -X PATCH "$BASE_URL/tenant/$TENANT_ID/appointments/$APP1/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "COMPLETED"}' > /dev/null

# Completar cita 2
curl -s -X PATCH "$BASE_URL/tenant/$TENANT_ID/appointments/$APP2/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "COMPLETED"}' > /dev/null

# Completar cita 3
curl -s -X PATCH "$BASE_URL/tenant/$TENANT_ID/appointments/$APP3/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "COMPLETED"}' > /dev/null

echo "Todas las citas marcadas como completadas"
```

### Paso 4: Verificar ingresos totales

```bash
# Deberá devolver: 75.50 + 45.00 + 75.50 = 196.00
curl -X GET "$BASE_URL/tenant/$TENANT_ID/appointments/revenue?startDate=2024-02-01T00:00:00Z&endDate=2024-02-29T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado esperado**:
```
196.00
```

---

## 🔍 Casos de Error

### Error 1: Precio negativo

```bash
curl -X POST "$BASE_URL/tenant/$TENANT_ID/appointment-types" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Consulta Inválida",
    "durationMinutes": 30,
    "price": -50.00,
    "isDefault": false
  }'
```

**Respuesta esperada (400 Bad Request)**:
```json
{
  "timestamp": "2024-01-15T10:35:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation error",
  "errors": [
    {
      "field": "price",
      "message": "must be greater than or equal to 0.00"
    }
  ]
}
```

### Error 2: Tipo de consulta no encontrado

```bash
curl -X POST "$BASE_URL/tenant/$TENANT_ID/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nutritionistId": "'$NUTRITIONIST_ID'",
    "patientId": "'$PATIENT_ID'",
    "startTime": "2024-02-01T10:00:00Z",
    "typeId": "invalid-type-id"
  }'
```

**Respuesta esperada (404 Not Found)**:
```json
{
  "timestamp": "2024-01-15T10:36:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Appointment type not found"
}
```

### Error 3: Rango de fechas inválido

```bash
curl -X GET "$BASE_URL/tenant/$TENANT_ID/appointments/revenue?startDate=2024-12-31T00:00:00Z&endDate=2024-01-01T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada (200 OK)** con valor 0:
```
0
```

---

## 📊 Script de Prueba Completo (Bash)

Guardar como `test_pricing_api.sh`:

```bash
#!/bin/bash

set -e

# Variables
TENANT_ID="123e4567-e89b-12d3-a456-426614174000"
TOKEN="tu-jwt-token-aqui"
BASE_URL="http://localhost:8080"
NUTRITIONIST_ID="nut-uuid-123456"
PATIENT_ID="patient-uuid-789"

echo "🧪 Iniciando pruebas de Appointment Pricing API"
echo "================================================"

# 1. Crear tipos de consulta
echo -e "\n✅ Paso 1: Crear tipos de consulta"

TYPE1=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointment-types" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Primera Consulta",
    "durationMinutes": 50,
    "price": 75.50,
    "isDefault": true
  }' | jq -r '.id')

TYPE2=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointment-types" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Seguimiento",
    "durationMinutes": 30,
    "price": 45.00,
    "isDefault": false
  }' | jq -r '.id')

echo "  Tipo 1 ID: $TYPE1"
echo "  Tipo 2 ID: $TYPE2"

# 2. Crear citas
echo -e "\n✅ Paso 2: Crear 3 citas"

APP1=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nutritionistId": "'$NUTRITIONIST_ID'",
    "patientId": "'$PATIENT_ID'",
    "startTime": "2024-02-01T10:00:00Z",
    "typeId": "'$TYPE1'"
  }' | jq -r '.id')

APP2=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nutritionistId": "'$NUTRITIONIST_ID'",
    "patientId": "'$PATIENT_ID'",
    "startTime": "2024-02-05T14:00:00Z",
    "typeId": "'$TYPE2'"
  }' | jq -r '.id')

APP3=$(curl -s -X POST "$BASE_URL/tenant/$TENANT_ID/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nutritionistId": "'$NUTRITIONIST_ID'",
    "patientId": "'$PATIENT_ID'",
    "startTime": "2024-02-10T11:00:00Z",
    "typeId": "'$TYPE1'"
  }' | jq -r '.id')

echo "  Cita 1 ID: $APP1"
echo "  Cita 2 ID: $APP2"
echo "  Cita 3 ID: $APP3"

# 3. Completar citas
echo -e "\n✅ Paso 3: Marcar citas como completadas"

curl -s -X PATCH "$BASE_URL/tenant/$TENANT_ID/appointments/$APP1/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "COMPLETED"}' > /dev/null

curl -s -X PATCH "$BASE_URL/tenant/$TENANT_ID/appointments/$APP2/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "COMPLETED"}' > /dev/null

curl -s -X PATCH "$BASE_URL/tenant/$TENANT_ID/appointments/$APP3/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "COMPLETED"}' > /dev/null

echo "  Citas actualizadas"

# 4. Consultar ingresos
echo -e "\n✅ Paso 4: Obtener total de ingresos"

REVENUE=$(curl -s -X GET "$BASE_URL/tenant/$TENANT_ID/appointments/revenue?startDate=2024-02-01T00:00:00Z&endDate=2024-02-29T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN")

echo "  Total de ingresos (febrero): €$REVENUE"
echo "  Esperado: €196.00"

if [ "$REVENUE" == "196.00" ]; then
  echo "  ✅ TEST PASSED"
else
  echo "  ❌ TEST FAILED"
fi

echo -e "\n================================================"
echo "🎉 Pruebas completadas"
```

Ejecutar:
```bash
chmod +x test_pricing_api.sh
./test_pricing_api.sh
```

---

## 📡 Postman Collection

Importar esta colección en Postman:

```json
{
  "info": {
    "name": "Appointment Pricing API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Appointment Type",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{TOKEN}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Primera Consulta\",\n  \"durationMinutes\": 50,\n  \"price\": 75.50,\n  \"isDefault\": true\n}"
        },
        "url": {
          "raw": "{{BASE_URL}}/tenant/{{TENANT_ID}}/appointment-types",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["tenant", "{{TENANT_ID}}", "appointment-types"]
        }
      }
    },
    {
      "name": "Get Total Revenue",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{TOKEN}}" }
        ],
        "url": {
          "raw": "{{BASE_URL}}/tenant/{{TENANT_ID}}/appointments/revenue?startDate=2024-02-01T00:00:00Z&endDate=2024-02-29T23:59:59Z",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["tenant", "{{TENANT_ID}}", "appointments", "revenue"],
          "query": [
            { "key": "startDate", "value": "2024-02-01T00:00:00Z" },
            { "key": "endDate", "value": "2024-02-29T23:59:59Z" }
          ]
        }
      }
    }
  ],
  "variable": [
    { "key": "BASE_URL", "value": "http://localhost:8080" },
    { "key": "TENANT_ID", "value": "123e4567-e89b-12d3-a456-426614174000" },
    { "key": "TOKEN", "value": "tu-jwt-token-aqui" }
  ]
}
```

