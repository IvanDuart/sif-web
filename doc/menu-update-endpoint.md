# Editar Menú (Menu)

Endpoint para editar parcialmente un menú: cambiar su **nombre** y/o marcarlo como **activo/inactivo** para un paciente.

## PATCH /api/tenant/{tenantId}/menu/{menuId}

Actualiza de forma **parcial** el menú. Solo se envían los campos que se quieren modificar; los demás se conservan sin cambios.

### Permiso Requerido

Acceso con **cualquiera** de estas condiciones:

| Condición | ¿Quién? | Qué puede hacer |
|-----------|---------|-----------------|
| Permiso `MANAGE_MENU` en el tenant | Nutricionista / Admin | Cambiar `name` y `isActive` |
| Ser el **dueño** del menú (`isMenuOwner`) | El propio paciente | **Solo** cambiar `isActive` |

> Un paciente (dueño del menú) **no puede cambiar el nombre**. Si intenta enviar `name`, obtendrá un `403 Forbidden` (`PERMISSION_DENIED`). Tampoco puede modificar los platos del menú.

### Request Body

Ambos campos son **opcionales** (se puede enviar uno, otro o ambos).

```json
{
  "name": "Dieta de Invierno",
  "isActive": true
}
```

| Campo      | Tipo     | Obligatorio | Descripción |
|------------|----------|-------------|-------------|
| `name`     | string   | No          | Nuevo nombre del menú. Se ignora si viene vacío o en blanco. Solo permitido con permiso `MANAGE_MENU`. |
| `isActive` | boolean  | No          | Marca el menú como activo (`true`) o inactivo (`false`) para el paciente. |

### Response (200 OK)

```json
{
  "id": "uuid",
  "name": "Dieta de Invierno",
  "isActive": true,
  "assignedAt": "2026-08-21T09:00:00Z"
}
```

### Errores

| Status | Significado |
|--------|------------|
| 403    | No se tiene `MANAGE_MENU` **y** no se es el dueño del menú, **o** se intenta cambiar `name` sin permiso `MANAGE_MENU` |
| 404    | El menú no existe o no pertenece al tenant indicado |

### Notas

- **Actualización parcial (PATCH):** los campos no enviados en el body no se modifican.
- **Pacientes:** solo pueden enviar `isActive` (para activar/desactivar su menú). Enviar `name` devuelve `403`.
- **Un solo menú activo por paciente:** si se marca un menú como `isActive: true`, todos los demás menús de ese paciente en el tenant se desactivan automáticamente (misma regla que al crear un menú activo).
- Si se marca `isActive: false`, únicamente se desactiva ese menú, sin afectar al resto.
- Si el menú no pertenece al tenant indicado en la URL, devuelve `404` (no `403`) para no exponer información entre tenants.
