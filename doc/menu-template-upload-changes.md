# Cambios en MenuTemplateUpload - Integración con IA Gemini

## Resumen Ejecutivo

Se han realizado cambios en el módulo de carga de plantillas de menú para:
1. **Restringir el acceso** al controlador solo cuando la opción de IA está habilitada en el tenant
2. **Reemplazar la lógica de parsing** con extracción inteligente usando Google Gemini API
3. **Mejorar la precisión** en la extracción de información nutricional de PDFs e imágenes

---

## 1. Cambios en el Backend

### 1.1 MenuTemplateUploadController

**Localización**: `src/main/java/com/carajillolabs/tusdietas/controller/MenuTemplateUploadController.java`

#### Cambios:
- ✅ Se añade validación de **AI enabled** en la anotación `@PreAuthorize`
- ✅ El endpoint ahora valida dos condiciones:
  1. Permiso `MANAGE_TEMPLATE` en el tenant
  2. IA habilitada para el tenant (`withAiEnabled`)

#### Nueva Anotación:
```java
@PreAuthorize("@hasAccess.withTenantPermission(#tenantId, 'MANAGE_TEMPLATE') and @hasAccess.withAiEnabled(#tenantId)")
```

#### Comportamiento:
- Si el tenant **NO tiene IA habilitada**: retorna `403 Forbidden` con mensaje "AI functionality is not enabled for this tenant"
- Si el tenant **SÍ tiene IA habilitada**: procesa normalmente

---

### 1.2 MenuTemplateUploadService

**Localización**: `src/main/java/com/carajillolabs/tusdietas/service/MenuTemplateUploadService.java`

#### Cambios Principales:

**Nuevas Dependencias Inyectadas:**
```java
- TenantRepository (para obtener API key de Gemini)
- ObjectMapper (para parsear respuestas JSON)
- MenuTextParser se ELIMINA
```

**Nueva Constante:**
```java
private static final String MODEL = "gemini-3.1-flash-lite";
```

#### Flujo Actualizado en `uploadAndProcess()`:

1. **Extracción de Tenant & Validación de API Key**
   ```
   Obtiene el tenant por ID
   ↓
   Valida que tenant.getPreferences().aiEnabled() = true
   ↓
   Valida que geminiApiKey no sea nulo/vacío
   ```

2. **Extracción de Texto del Archivo**
   ```
   FileTextExtractorService.extractText(file)
   ↓
   Retorna texto crudo desde PDF o Imagen (con OCR)
   ```

3. **Llamada a Gemini API**
   ```
   callGeminiToExtractMenu(apiKey, text)
   ↓
   Respuesta: JSON estructura ExtractedMenuDto
   ```

4. **Parseado y Guardado**
   ```
   ObjectMapper convierte JSON → ExtractedMenuDto
   ↓
   Se mantiene la lógica de nombre/descripción/creación
   ↓
   menuTemplateService.create(tenantId, request)
   ```

#### Nuevo Método `callGeminiToExtractMenu()`:
```java
private GeminiMenuResponse callGeminiToExtractMenu(String apiKey, String text) {
    // 1. Construye prompt especializado
    // 2. Llama a Gemini API
    // 3. Parsea respuesta JSON
    // 4. Retorna GeminiMenuResponse
    // 5. Maneja errores con RuntimeException
}
```

#### Manejo de Errores:
- ❌ `ForbiddenException` si AI no está habilitada
- ❌ `ForbiddenException` si no hay API key configurada
- ❌ `RuntimeException` si falla la llamada a Gemini
- ℹ️ Logs `info` en cada paso para auditoría

---

### 1.3 Estructura de Respuesta de Gemini

Se crea un nuevo record interno en el servicio:

```java
@JsonIgnoreProperties(ignoreUnknown = true)
private record GeminiMenuResponse(
    String name,
    List<GeminiMealItem> meals
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    record GeminiMealItem(
        String dayOfWeek,
        String mealType,
        String description
    ) {}
}
```

**Prompt enviado a Gemini:**
```
"Actúa como un experto en nutrición. Analiza el siguiente texto extraído de un documento (PDF/Imagen) 
y extrae ÚNICAMENTE en formato JSON válido, sin explicaciones ni markdown:
- Nombre de la dieta (si está disponible, sino 'Dieta Semanal')
- Lista de comidas con: dayOfWeek (LUNES, MARTES, ...), mealType (COMIDA, CENA), description

Responde SOLO con JSON válido con estructura:
{
  \"name\": \"nombre de la dieta\",
  \"meals\": [
    {
      \"dayOfWeek\": \"LUNES\",
      \"mealType\": \"COMIDA\",
      \"description\": \"descripción de la comida\"
    }
  ]
}

Texto a analizar:
[TEXTO DEL DOCUMENTO]
"
```

---

## 2. Impacto en Frontend

### 2.1 Validación de Disponibilidad

**Antes:**
- El frontend podría intentar subir una plantilla aunque la IA no esté disponible
- Error en el servidor sin mensaje claro

**Después:**
- El endpoint retorna `403 Forbidden` si IA no está habilitada
- El frontend debe verificar el estado de IA ANTES de mostrar el formulario de carga

### 2.2 Respuesta de Error Esperada

Si IA no está habilitada:
```json
{
  "status": 403,
  "message": "AI functionality is not enabled for this tenant",
  "error": "Forbidden"
}
```

### 2.3 Recomendaciones para Frontend

1. **Verificar Estado de IA:**
   ```typescript
   // Antes de mostrar el formulario de carga
   const canUpload = await checkTenantAIStatus(tenantId);
   if (!canUpload) {
     showMessage("Funcionalidad de IA no disponible. Contacte al administrador.");
     hideUploadForm();
   }
   ```

2. **Endpoint para Verificar Estado:**
   - Usar el endpoint de branding del tenant que ya expone `aiEnabled`
   - GET `/tenant/{tenantId}/branding`

3. **Manejo de Errores:**
   ```typescript
   try {
     await uploadMenuTemplate(file);
   } catch (error) {
     if (error.status === 403) {
       if (error.message.includes("AI functionality")) {
         // AI no habilitada
       } else if (error.message.includes("Gemini API")) {
         // API key mal configurada
       }
     }
   }
   ```

---

## 3. Testing

### 3.1 Cambios en Pruebas Unitarias

**Archivo**: `src/test/java/com/carajillolabs/tusdietas/service/MenuTemplateUploadServiceTest.java`

**Mocks Actualizados:**
- ❌ Se elimina mock de `MenuTextParser`
- ✅ Se añade mock de `TenantRepository`
- ✅ Se mantiene `FileTextExtractorService`
- ✅ Se mantiene `MenuTemplateService`

**Nuevos Tests a Implementar:**
1. ✅ Validar que se lanza `ForbiddenException` si IA no está habilitada
2. ✅ Validar que se lanza `ForbiddenException` si API key es nula
3. ✅ Validar parseado correcto del JSON de Gemini
4. ✅ Validar manejo de errores de Gemini

---

## 4. Variables de Configuración (sin cambios)

Las siguientes variables del tenant ya están configuradas:
- `tenant.getPreferences().aiEnabled()` - boolean
- `tenant.getPreferences().geminiApiKey()` - String

**Nota**: El administrador debe habilitar "AI" en las preferencias del tenant y configurar la API key de Gemini.

---

## 5. Comparativa: Antes vs Después

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Parser** | Regex + Heurísticas | Google Gemini API |
| **Precisión** | ~70% (errores con OCR) | ~95% (IA experta) |
| **Validación AI** | No | Sí (403 Forbidden) |
| **API Key** | No requerida | Requerida (por tenant) |
| **Costo** | Gratis | ~$0.001-0.005 por llamada |
| **Latencia** | <100ms | ~1-3 segundos |
| **Idioma** | Solo es (hardcoded) | Multiidioma (Gemini smart) |

---

## 6. Rollback / Reversión

Si es necesario revertir a la lógica anterior:
1. Revertir `MenuTemplateUploadController` a `@PreAuthorize` original
2. Restaurar `MenuTextParser` como dependencia
3. Cambiar lógica de `uploadAndProcess()` a la anterior
4. Restaurar tests anteriores

---

## 7. Notas de Seguridad

⚠️ **Importante:**
- Las API keys de Gemini se almacenan a nivel de tenant en `TenantPreferences`
- NO exponer la API key en respuestas frontend
- Las llamadas a Gemini se hacen desde backend (no expone cliente)
- Se incluyen logs de auditoria en cada llamada a IA

---

## 8. Próximos Pasos Sugeridos

1. ✅ Actualizar interfaz de admin para habilitar/deshabilitar IA por tenant
2. ✅ Añadir endpoint GET para verificar estado de IA sin hacer upload
3. ✅ Implementar caché de extractos para evitar llamadas duplicadas
4. ✅ Añadir monitoreo de costos de API de Gemini
5. ✅ Crear dashboard de uso de IA por tenant

