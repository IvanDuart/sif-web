# Mascota procedural — contrato y guía de frontend

> **Estado:** contrato v2 (mascotas procedurales).
> **Base:** `context-path` `/api`.
> **Autenticación:** `Authorization: Bearer <JWT>`.
> **Regla de oro:** ninguna escritura se aplica sin `pending_action` confirmada.

---

## 1. Resumen

La mascota sigue siendo un asistente administrativo conversacional, pero su
cara ya no es un SVG subido por el centro: es un **personaje procedural** con
skins definidas por el producto, vida propia y vestuario por usuario.

- El catálogo de skins lo controla el producto.
- El centro elige la skin por defecto y qué personalización permite.
- Cada usuario puede elegir su skin y accesorios.
- El backend solo sirve datos; el dibujo vive en el frontend.
- **Solo la ven nutricionistas y administradores** (`userType === 'STAFF'` y
  `roleCode` `ADMIN` o `NUTRITIONIST`). Los pacientes no ven la mascota ni el
  FAB, y el panel no se monta para ellos.

---

## 2. Catálogo de skins

Las skins se empaquetan en el frontend (`src/app/features/assistant/mascot/skins`).

| Id | Nombre | Forma |
|---|---|---|
| `manzana` | Manzana | Cuerpo rojo redondeado, con rabillo y hoja. |
| `naranja` | Naranja | Esfera naranja, con rabillo y hoja. |
| `pina` | Piña | Esfera dorada con enrejado y penacho verde. |
| `melon` | Melón | Óvalo verde con rayas y rabillo rizado. |

Accesorios iniciales: `orejas` (orejas de gato).

---

## 3. Configuración del tenant

### 3.1 Obtener configuración

```http
GET /api/tenant/{tenantId}/assistant/config
```

```json
{
  "enabled": true,
  "apiKeyConfigured": true,
  "name": "Nuti",
  "tone": "CERCANO",
  "defaultSkinId": "manzana",
  "greeting": "¡Hola! Soy Nuti. ¿Te ayudo a completar tu perfil?",
  "suggestedPrompts": ["Completar mis datos", "¿Qué me falta?", "Registrar mi peso"],
  "consentRequired": false,
  "consentText": null,
  "lookPolicy": {
    "allowUserLook": true,
    "allowedSkinIds": ["manzana", "naranja", "pina", "melon"],
    "allowedAccessories": ["orejas"]
  }
}
```

- `defaultSkinId`: skin por defecto del centro.
- `lookPolicy.allowUserLook`: si es `false`, todos ven `defaultSkinId` y no hay vestuario.
- `lookPolicy.allowedSkinIds` vacío = todas permitidas.
- Ya **no** existen `avatarUrl`, `avatarExpiresAt` ni `animations`.

### 3.2 Actualizar configuración

```http
PUT /api/tenant/{tenantId}/assistant/config
Content-Type: application/json

{
  "name": "Nuti",
  "persona": "Cercana y breve",
  "tone": "CERCANO",
  "defaultSkinId": "melon",
  "enabled": true,
  "consentText": "Voy a usar un asistente de IA...",
  "lookPolicy": {
    "allowUserLook": true,
    "allowedSkinIds": ["manzana", "naranja", "pina", "melon"],
    "allowedAccessories": ["orejas"]
  }
}
```

Requiere `MANAGE_TENANT`.

### 3.3 Catálogo

```http
GET /api/tenant/{tenantId}/assistant/pets
```

```json
[
  {
    "id": "manzana",
    "name": "Brócoli",
    "category": "VEGETABLE",
    "order": 1,
    "supports": {
      "accessories": ["orejas"],
      "expressions": ["idle", "listening", "thinking", "happy", "confused", "sleeping"]
    }
  }
]
```

El backend no envía SVG: el frontend ya conoce cada skin.

---

## 4. Look del usuario

### 4.1 Obtener

```http
GET /api/tenant/{tenantId}/assistant/look
```

```json
{
  "skinId": "melon",
  "accessories": ["orejas"],
  "updatedAt": "2026-10-31T09:15:00Z"
}
```

`skinId: null` = usar `defaultSkinId`.

### 4.2 Guardar

```http
PUT /api/tenant/{tenantId}/assistant/look
Content-Type: application/json

{
  "skinId": "manzana",
  "accessories": ["orejas"]
}
```

- `skinId` debe existir en el catálogo y estar permitido.
- `accessories` debe estar permitido y soportado por la skin.
- Cualquier usuario autenticado puede cambiar su propio look.

### 4.3 Borrar

```http
DELETE /api/tenant/{tenantId}/assistant/look
```

Vuelve al `defaultSkinId`. Responde `204`.

---

## 5. Sesión y conversación

Sin cambios respecto a v1:

```http
POST   /api/tenant/{tenantId}/assistant/sessions
POST   /api/tenant/{tenantId}/assistant/sessions/{sessionId}/consent
DELETE /api/tenant/{tenantId}/assistant/sessions/{sessionId}
POST   /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages
GET    /api/tenant/{tenantId}/assistant/sessions/{sessionId}/messages?before=<cursor>&limit=30
POST   /api/tenant/{tenantId}/assistant/pending-actions/{actionId}/confirm
POST   /api/tenant/{tenantId}/assistant/pending-actions/{actionId}/reject
```

---

## 6. Estados visuales

El orb (`MascotOrb`) combina tres capas:

1. **Modo del asistente** (`orbMode`): `idle`, `listening`, `thinking`, `confirm`.
2. **Vida propia** (`MascotLifeService`): `peek`, `spin`, `dizzy`, `blush`, `angry`, `phone`, `sleep`.
3. **Moods** (`MascotMoodService`): `worried`, `cheer`, `highfive`, `welcome`, `proud`; condiciones `offline`, `tired`.

Prioridad: vida propia > mood > condición.

### 6.1 Vida propia

- **Peek**: medio dormida, abre un ojo y mira alrededor.
- **Spin**: giro completo sobre sí misma.
- **Dizzy**: cinco pulsaciones rápidas.
- **Blush**: acariciarla rápido (movimiento de vaivén).
- **Angry**: seguir pulsando mientras está mareada.
- **Phone**: esperar más de 20 s una confirmación.
- **Sleep**: pestaña oculta.

### 6.2 Moods

- `cheer`: al confirmar una acción o aceptar el consentimiento.
- `worried`: ante un error del asistente.
- `welcome`: primera apertura del panel en la sesión.
- `proud`, `highfive`: reservados para eventos propios de la mascota.

---

## 7. Vestuario

- Se abre desde el header del panel de chat (icono de camiseta).
- Solo aparece si `lookPolicy.allowUserLook`.
- Muestra las skins permitidas y los accesorios permitidos.
- Guarda al instante con `PUT /assistant/look`.
- Mientras el backend v2 no esté desplegado, el look se guarda en
  `localStorage` (`sif-mascota`) y el wardrobe sigue funcionando.

---

## 8. Acceso por rol

El frontend decide la visibilidad con `MascotStateService.visible()`:

```text
visible = roleAllowed && config.enabled
roleAllowed = membership.userType === 'STAFF'
              && (membership.roleCode === 'ADMIN' || membership.roleCode === 'NUTRITIONIST')
```

- Si el usuario es paciente, no se carga la configuración del asistente y el
  launcher no renderiza nada.
- Al cambiar de tenant o de rol, un `effect` recalcula la visibilidad y
  recarga la configuración si el nuevo rol está permitido.
- **Nota de seguridad:** ocultar la mascota es solo la capa de UI. Si los
  endpoints del asistente deben quedar cerrados a pacientes, el backend debe
  validar el rol en `POST /assistant/sessions` y en el resto de endpoints.

---

## 9. Accesibilidad

- Todo el movimiento no esencial se desactiva con `prefers-reduced-motion`.
- Los orbs decorativos llevan `aria-hidden="true"`.
- El FAB mantiene `aria-expanded`, `aria-controls` y `aria-label`.
- Las notas de la mascota usan `role="status"`.

---

## 10. Errores nuevos

| Código | HTTP | Cuándo |
|---|---|---|
| `error.assistant_pet_not_found` | 422 | `skinId` no existe en el catálogo. |
| `error.assistant_invalid_accessory` | 422 | Accesorio no soportado o no permitido. |
| `error.assistant_look_disabled` | 403 | `lookPolicy.allowUserLook` es `false`. |
| `error.assistant_look_not_allowed` | 403 | `skinId` no está permitido por el tenant. |

El frontend trata un `404` de `/look` como “backend antiguo” y cae a
`localStorage` sin mostrar error.

---

## 11. Migración desde v1

- Se eliminan `PUT /assistant/avatar`, `PUT /assistant/avatar/preset/{petId}`
  (como subida) y `PUT/DELETE /assistant/animations/{name}`.
- `avatarUrl`, `avatarExpiresAt` y `animations` desaparecen del contrato.
- Los tenants con avatar predefinido se mapean a `defaultSkinId`.
- Los tenants con SVG propio pasan al default del producto.
- El frontend deja de cargar `lottie-web`.
