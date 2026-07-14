# PDF de menú y datos de contacto del centro

## 1. Resumen

Se añade la posibilidad de imprimir un menú en PDF con el logo del centro (o un logo específico para PDF), datos de contacto y las comidas del menú. Se incorporan campos de contacto básicos (dirección, teléfono) en la ficha del tenant.

---

## 2. Cambios en el modelo de datos

### 2.1 Tenant — nuevos campos

| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| `tenant_logo_pdf` | `BYTEA` | Sí | Logo específico para el PDF. Si no se sube, se usa `tenant_logo` como fallback. |
| `address` | `VARCHAR(255)` | Sí | Dirección del centro |
| `phone` | `VARCHAR(255)` | Sí | Teléfono del centro |

**El email del nutricionista** no se guarda en tenant. Se obtiene del campo `assigned_by` del menú (email del profesional que asignó/creó el menú).

### 2.2 Migración SQL (V16)

```sql
ALTER TABLE tenant
    ADD COLUMN tenant_logo_pdf BYTEA,
    ADD COLUMN address VARCHAR(255),
    ADD COLUMN phone VARCHAR(255);
```

---

## 3. Branding — nuevos campos en DTO público

`GET /tenant/{tenantId}/branding` ahora devuelve:

```json
{
  "name": "Clínica Ejemplo",
  "primaryColor": "#005ac2",
  "defaultLanguage": "es-ES",
  "logoUrl": "/api/tenant/{tenantId}/branding/logo",
  "logoPdfUrl": "/api/tenant/{tenantId}/branding/logo-pdf",
  "address": "Calle Mayor 1, 28001 Madrid",
  "phone": "+34 912345678"
}
```

---

## 4. Nuevos endpoints

### 4.1 Gestión del logo PDF del centro

| Método | Ruta | Permiso | Body | Response | Códigos |
|---|---|---|---|---|---|
| `GET` | `/tenant/{tenantId}/branding/logo-pdf` | Público | — | `byte[]` (imagen PNG) | 200, 404 |
| `PUT` | `/tenant/{tenantId}/branding/logo-pdf` | `MANAGE_TENANT_BRANDING` | `multipart/form-data` (campo `file`) | — | 204, 403 |

**Ejemplo subida:**

```bash
curl -X PUT "http://localhost:8081/tenant/{tenantId}/branding/logo-pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@logo-pdf.png"
```

- El logo se sirve con `Content-Type: image/png`.
- Si no se ha subido un logo específico para PDF, `GET /logo-pdf` devuelve `404`.

### 4.2 Generación de PDF del menú

| Método | Ruta | Permiso | Response | Códigos |
|---|---|---|---|---|
| `GET` | `/tenant/{tenantId}/menu/{menuId}/pdf` | `VIEW_MENU` | `byte[]` (`application/pdf`) | 200, 404, 500 |

**Ejemplo:**

```bash
curl "http://localhost:8081/tenant/{tenantId}/menu/{menuId}/pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -o menu.pdf
```

El PDF se devuelve con `Content-Disposition: inline` para que el navegador lo muestre directamente.

---

## 5. Contenido del PDF

El PDF generado incluye:

1. **Cabecera:**
   - Nombre del centro (tenant)
   - Logo del centro (usa `tenant_logo_pdf` si existe, si no `tenant_logo` como fallback)
   - Dirección (si está configurada)
   - Teléfono (si está configurado)
   - Email del nutricionista (`assigned_by` del menú)
2. **Información del paciente:**
   - Nombre y apellidos
   - Nombre del menú
3. **Comidas:**
   - Agrupadas por día de la semana
   - Tipo de comida (desayuno, comida, cena, etc.)
   - Descripción detallada

---

## 6. Actualización de datos de contacto (super-admin)

Los campos `address` y `phone` se gestionan a través de los endpoints ya existentes de `TenantController` (super-admin):

| Método | Ruta | Request |
|---|---|---|
| `POST` | `/tenants` | `CreateTenantRequest` (ahora acepta `address`, `phone`) |
| `PUT` | `/tenants/{id}` | `UpdateTenantRequest` (ahora acepta `address`, `phone`) |

**Ejemplo de creación:**

```json
{
  "name": "Clínica Nueva",
  "cif": "B12345678",
  "address": "Avda. de la Salud 42",
  "phone": "+34 911223344"
}
```

**Ejemplo de actualización parcial:**

```json
{
  "address": "Calle Mayor 1, 28001 Madrid",
  "phone": "+34 912345678"
}
```

---

## 7. Reglas de negocio

| Regla | Comportamiento |
|---|---|
| **Logo PDF opcional** | Si no se ha subido `tenant_logo_pdf`, se usa `tenant_logo` como fallback. Si tampoco hay logo web, el PDF se genera sin logo (no falla). |
| **Email del nutricionista** | Se obtiene de `menu.assigned_by`. Si el menú fue creado por sistema, aparecerá `"system"`. |
| **Contacto opcional** | Si address o phone son `null`, simplemente no se renderizan en el PDF. |
| **PDF en streaming** | El endpoint devuelve `inline` para que el navegador muestre el PDF directamente. El frontend puede cambiar a `attachment` forzando la descarga. |
