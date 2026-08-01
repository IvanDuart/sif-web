# Guía de Integración Frontend - MenuTemplateUpload con IA

## 📋 Descripción Rápida

El endpoint de carga de plantillas de menú (`POST /tenant/{tenantId}/menu-template/upload`) ahora:
- ✅ Requiere que la IA esté habilitada para el tenant
- ✅ Usa Google Gemini para extraer información del menú
- ✅ Retorna `403 Forbidden` si la IA no está disponible

---

## 🔧 Cambios de API

### Endpoint
```
POST /tenant/{tenantId}/menu-template/upload
Content-Type: multipart/form-data
```

### Headers Requeridos
```
Authorization: Bearer {token}
```

### Parámetros
```javascript
{
  file: File,                    // PDF o Imagen (JPG, PNG)
  name?: string,                 // (Opcional) Nombre del template
  description?: string           // (Opcional) Descripción del template
}
```

### Respuesta Exitosa (200 OK)
```json
{
  "id": "uuid",
  "name": "Dieta Semanal",
  "description": "Template uploadado",
  "meals": [
    {
      "dayOfWeek": "LUNES",
      "mealType": "COMIDA",
      "description": "Arroz con pollo"
    }
  ],
  "createdAt": "2026-01-15T10:30:00Z"
}
```

### Respuesta Error - IA No Habilitada (403 Forbidden)
```json
{
  "status": 403,
  "message": "AI functionality is not enabled for this tenant",
  "error": "Forbidden"
}
```

### Respuesta Error - API Key No Configurada (403 Forbidden)
```json
{
  "status": 403,
  "message": "No Gemini API key configured for this tenant",
  "error": "Forbidden"
}
```

---

## 🎯 Flujo Recomendado para Frontend

### 1. Verificar Disponibilidad de IA (ANTES de mostrar formulario)

```typescript
// Opción A: Usar endpoint de branding existente
async function checkAIEnabled(tenantId: string): Promise<boolean> {
  const response = await fetch(`/tenant/${tenantId}/branding`);
  const data = await response.json();
  return data.aiEnabled === true;
}

// Opción B: Usar un endpoint dedicado (recomendado, por implementar)
async function checkMenuUploadAvailable(tenantId: string): Promise<boolean> {
  try {
    const response = await fetch(`/tenant/${tenantId}/menu-template/check-availability`);
    return response.ok;
  } catch {
    return false;
  }
}
```

### 2. Mostrar/Ocultar Interfaz de Carga

```typescript
export function MenuTemplateUploadForm() {
  const [aiAvailable, setAiAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const { tenantId } = useParams();

  useEffect(() => {
    async function check() {
      const available = await checkAIEnabled(tenantId);
      setAiAvailable(available);
      setLoading(false);
    }
    check();
  }, [tenantId]);

  if (loading) return <div>Verificando disponibilidad...</div>;
  
  if (!aiAvailable) {
    return (
      <Alert type="info">
        La funcionalidad de carga de plantillas con IA no está disponible.
        Contacte al administrador para habilitarla.
      </Alert>
    );
  }

  return <UploadForm tenantId={tenantId} />;
}
```

### 3. Implementar Carga de Archivo

```typescript
async function handleFileUpload(
  tenantId: string,
  file: File,
  name?: string,
  description?: string
) {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  if (description) formData.append('description', description);

  try {
    const response = await fetch(
      `/tenant/${tenantId}/menu-template/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      // Error de red
      throw new Error('Error de conexión. Intente nuevamente.');
    }
    throw error;
  }
}
```

### 4. Componente Completo de Carga

```typescript
export function MenuTemplateUploadForm() {
  const { tenantId } = useParams();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);

  // Verificar IA disponible al montar
  useEffect(() => {
    async function check() {
      try {
        const available = await checkAIEnabled(tenantId);
        setAiAvailable(available);
      } catch {
        setAiAvailable(false);
      }
    }
    check();
  }, [tenantId]);

  // Manejo de envío
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Por favor selecciona un archivo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await handleFileUpload(
        tenantId,
        file,
        name || undefined,
        description || undefined
      );

      setSuccess(true);
      setFile(null);
      setName('');
      setDescription('');

      // Opcional: redirigir o mostrar resultado
      console.log('Template creado:', result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!aiAvailable) {
    return (
      <Alert type="warning" className="mb-4">
        ⚠️ La funcionalidad de IA no está habilitada para tu cuenta.
        <br />
        Contacta al administrador de tu tenant para activarla.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Input de archivo */}
      <div>
        <label className="block text-sm font-medium">
          Archivo (PDF o Imagen)
        </label>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={loading}
          required
          className="mt-1 block w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          Soportados: PDF, JPG, PNG (máx 10MB)
        </p>
      </div>

      {/* Nombre (opcional) */}
      <div>
        <label className="block text-sm font-medium">
          Nombre de la Plantilla (opcional)
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Dieta Proteica"
          disabled={loading}
          className="mt-1 block w-full"
        />
      </div>

      {/* Descripción (opcional) */}
      <div>
        <label className="block text-sm font-medium">
          Descripción (opcional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Plantilla para ganancia muscular"
          disabled={loading}
          rows={3}
          className="mt-1 block w-full"
        />
      </div>

      {/* Mensajes */}
      {error && (
        <Alert type="error">
          {error}
        </Alert>
      )}
      {success && (
        <Alert type="success">
          ✅ Plantilla creada exitosamente!
        </Alert>
      )}

      {/* Botón de envío */}
      <button
        type="submit"
        disabled={loading || !file}
        className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Procesando con IA...' : 'Subir Plantilla'}
      </button>
    </form>
  );
}
```

---

## ⏱️ Tiempos Esperados

| Operación | Tiempo |
|-----------|--------|
| Carga de archivo | <1s |
| Extracción de texto (PDF/OCR) | <2s |
| Procesamiento con Gemini | 1-3s |
| **Total** | **2-6 segundos** |

**Recomendación**: Mostrar barra de progreso/spinner durante el procesamiento.

---

## 🚨 Manejo de Errores

### Errores Comunes

```typescript
function handleUploadError(error: any) {
  const status = error.response?.status;
  const message = error.response?.data?.message;

  switch (status) {
    case 403:
      if (message?.includes('AI')) {
        return {
          title: 'IA No Habilitada',
          message: 'Contacta al administrador para habilitar la IA',
          action: 'contact-admin'
        };
      }
      if (message?.includes('Gemini')) {
        return {
          title: 'Configuración Incompleta',
          message: 'La API de Gemini no está configurada correctamente',
          action: 'contact-admin'
        };
      }
      return {
        title: 'Acceso Denegado',
        message: 'No tienes permisos para esta acción',
        action: 'go-back'
      };

    case 400:
      return {
        title: 'Archivo Inválido',
        message: 'Por favor sube un PDF o imagen válida',
        action: 'retry'
      };

    case 500:
      return {
        title: 'Error del Servidor',
        message: 'Hubo un error procesando tu archivo. Intenta de nuevo.',
        action: 'retry'
      };

    default:
      return {
        title: 'Error Desconocido',
        message: 'Algo salió mal. Intenta nuevamente.',
        action: 'retry'
      };
  }
}
```

---

## 📊 Estados de la Aplicación

```
┌─────────────────────┐
│   Inicializando     │
└──────────┬──────────┘
           │
      ↓ check AI
┌──────────────────────┐
│ ¿IA Disponible?      │
└──────────┬──────────┘
           │
      NO ↓    YES
      │       │
  Mostrar  Mostrar
  mensaje  formulario
  de error       │
                 ↓ Usuario selecciona archivo
            ┌────────────────┐
            │ Archivo OK?    │
            └────────┬───────┘
                     │
                NO↓  YES
                │     │
            Error  Enviando
                     │
                     ↓
            ┌──────────────────┐
            │ Procesando IA... │  (1-3s)
            └────────┬─────────┘
                     │
            ↓ Respuesta
       ┌────────────────────┐
       │  ¿Éxito?           │
       └────────┬───────────┘
                │
            YES│ NO
              │   │
            ✅    ❌
            OK   Error
```

---

## 💡 Tips de UX

1. **Feedback Visual**
   - Mostrar spinner mientras se procesa
   - Desactivar botón de envío durante procesamiento
   - Mostrar estimación de tiempo

2. **Validación de Archivo**
   ```typescript
   const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
   
   if (file.size > MAX_FILE_SIZE) {
     throw new Error('Archivo muy grande (máx 10MB)');
   }
   
   const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
   if (!validTypes.includes(file.type)) {
     throw new Error('Tipo de archivo no soportado');
   }
   ```

3. **Reintentos Automáticos**
   ```typescript
   async function uploadWithRetry(
     tenantId: string,
     file: File,
     maxRetries = 3
   ) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await handleFileUpload(tenantId, file);
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // Exponential backoff
       }
     }
   }
   ```

---

## 🔐 Seguridad

⚠️ **Importante:**
- Nunca guardes o muestres la API key de Gemini en el frontend
- La API key se gestiona completamente en backend
- Todos los cálculos de IA ocurren en el servidor
- Las solicitudes deben ir siempre autenticadas

---

## 📱 Responsive Design

```typescript
// En mobile, considerar reducir tamaño de archivo
const MAX_FILE_SIZE = window.innerWidth < 768 ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

// En mobile, mostrar más feedback
const showProgressSteps = window.innerWidth < 768;
```

---

## 🎨 Componentes UI Sugeridos

```typescript
// Badge de estado
<Badge color={aiAvailable ? 'green' : 'red'}>
  {aiAvailable ? '✓ IA Disponible' : '✗ IA No Disponible'}
</Badge>

// Progress bar
<ProgressBar 
  steps={[
    { label: 'Subiendo...', progress: 0 },
    { label: 'Extrayendo texto...', progress: 33 },
    { label: 'Procesando con IA...', progress: 66 },
    { label: 'Guardando...', progress: 100 }
  ]}
/>

// Toast notification
showToast({
  type: 'success',
  message: 'Plantilla creada exitosamente',
  duration: 3000
});
```

---

## 🧪 Testing Frontend

```typescript
// Mock del endpoint
mockFetch.post('/tenant/:tenantId/menu-template/upload', {
  status: 200,
  body: {
    id: 'mock-uuid',
    name: 'Test Template',
    meals: []
  }
});

// Test de flujo
test('Should show IA not available message', async () => {
  mockFetch.get('/tenant/:tenantId/branding', {
    status: 200,
    body: { aiEnabled: false }
  });

  render(<MenuTemplateUploadForm />);
  expect(screen.getByText(/IA no está habilitada/i)).toBeInTheDocument();
});
```

---

## ✅ Checklist de Implementación Frontend

- [ ] Endpoint actualizado en cliente HTTP
- [ ] Verificación de IA antes de mostrar formulario
- [ ] Validación de archivo (tipo y tamaño)
- [ ] Spinner/loader durante procesamiento
- [ ] Manejo de errores 403 específicos
- [ ] Reintentos automáticos
- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] Mensaje de éxito/error al usuario
- [ ] Documentación de componentes

