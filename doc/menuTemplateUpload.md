# Endpoint POST — Upload PDF/imagen para crear MenuTemplate

## Resumen

Nuevo endpoint `POST /tenant/{tenantId}/menu-template/upload` que permite subir un archivo PDF o imagen de una dieta semanal, extraer los platos mediante OCR/parser, y crear automáticamente una `MenuTemplate` con sus `MealTemplate`.

**Permiso requerido:** `MANAGE_TEMPLATE`

**Propósito:** Que el nutricionista pueda crear plantillas de menú semanal a partir de los mismos formatos de archivo que usa para crear menús reales (PDF de clínica, foto de un menú impreso, etc.), ahorrando la introducción manual de cada plato.

---

## Endpoint

| Método | Ruta | Permiso | Content-Type |
|---|---|---|---|
| `POST` | `/tenant/{tenantId}/menu-template/upload` | `MANAGE_TEMPLATE` | `multipart/form-data` |

### Parámetros

| Parámetro | Tipo | ¿Requerido? | Descripción |
|---|---|---|---|
| `file` | `MultipartFile` (PDF o imagen) | Sí | Archivo de la dieta semanal a parsear |
| `name` | `string` | No | Nombre de la plantilla. Si no se envía, usa el nombre detectado del documento o "Dieta Semanal" |
| `description` | `string` | No | Descripción de la plantilla |

### Response

`201 Created` — Devuelve el `MenuTemplate` creado con vista `@JsonView(JsonViews.Full.class)`:

```json
{
  "id": "uuid",
  "name": "Plantilla Semana 1",
  "description": "Dieta baja en hidratos",
  "createdAt": "2026-06-14T10:00:00Z",
  "updatedAt": "2026-06-14T10:00:00Z",
  "mealTemplates": [
    {
      "id": "uuid",
      "dayOfWeek": "LUNES",
      "mealType": "COMIDA",
      "description": "Pechuga de pollo con arroz y verduras"
    },
    {
      "id": "uuid",
      "dayOfWeek": "LUNES",
      "mealType": "CENA",
      "description": "Merluza a la plancha con ensalada"
    }
  ]
}
```

---

## Códigos de respuesta

| Código | Descripción |
|---|---|
| `200 OK` | Plantilla creada correctamente |
| `400 Bad Request` | Tipo de archivo no soportado o error de extracción |
| `403 Forbidden` | El usuario autenticado no tiene permiso `MANAGE_TEMPLATE` en el tenant |
| `404 Not Found` | Tenant no encontrado |

---

## Ejemplos

### Subir PDF con nombre personalizado

```bash
curl -X POST "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/menu-template/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@dieta_semanal.pdf" \
  -F "name=Plantilla Enero 2026" \
  -F "description=Dieta equilibrada para pacientes con colesterol"
```

### Subir imagen sin nombre (usa valor por defecto)

```bash
curl -X POST "http://localhost:8081/tenant/00000000-0000-0000-0000-000000000001/menu-template/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@menu_foto.jpg"
```

---

## Flujo interno

```
MenuTemplateUploadController
       ↓
MenuTemplateUploadService.uploadAndProcess()
       ↓
  1. FileTextExtractorService.extractText(file)    ← compartido con MenuUploadService
       ├── PDF  → PdfTextExtractor.extractText()
       └── image → ImageTextExtractor.extractText() (OCR con Tesseract español)
       ↓
  2. MenuTextParser.parse(text) → ExtractedMenuDto
       ├── Detecta si hay cabeceras de día (PDF) o asigna secuencial (imagen OCR)
       ├── Reconocimiento robusto con/los acentos (LUNES, MARTES...)
       └── Filtra ruido (desayuno, merienda, teléfonos, etc.)
       ↓
  3. Construye CreateMenuTemplateRequest
       - name: nameOverride ? extracted name ? "Dieta Semanal"
       - description: descriptionOverride
       - meals: mapea cada MealDto → CreateMealTemplateRequest
       ↓
  4. MenuTemplateService.create(tenantId, request)
       - Persiste MenuTemplate + MealTemplates (con cascade ALL)
```

---

## Cambios en el código

### Archivos creados

- `src/main/java/com/carajillolabs/tusdietas/controller/MenuTemplateUploadController.java`
- `src/main/java/com/carajillolabs/tusdietas/service/MenuTemplateUploadService.java`
- `src/main/java/com/carajillolabs/tusdietas/service/FileTextExtractorService.java`

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `MenuUploadService.java` | Refactor: reemplaza `PdfTextExtractor` + `ImageTextExtractor` por `FileTextExtractorService` compartido |

---

## Notas técnicas

- **Formatos soportados:** PDF (`application/pdf`) e imágenes (`image/*`).
- **Parser:** El mismo `MenuTextParser` que se usa para los menús reales. Reconoce días de la semana en español, tipos de comida (`Comida`, `Cena`) y filtra líneas de ruido como "desayuno", "merienda", teléfonos, etc.
- **Refactor:** La lógica de detección de content-type + extracción de texto se movió a `FileTextExtractorService` para que tanto `MenuUploadService` como `MenuTemplateUploadService` la reutilicen sin duplicación.
- **Sin userId:** A diferencia del upload de menús, las plantillas no se asignan a un usuario concreto.
- **Persistencia:** Se reutiliza `MenuTemplateService.create()` que ya maneja el guardado de `MealTemplate` mediante `cascade = CascadeType.ALL`.
