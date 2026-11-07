---
id: superadmin-frontend-contract
type: submodule-design
title: SUPERADMIN — cambios para frontend
status: implemented
parent: security
---

# SUPERADMIN — cambios para frontend

> **Estado:** backend implementado (migración `V62__superadmin.sql`).
> **Base:** `context-path` `/api`.
> **Autenticación:** sin cambios — `Authorization: Bearer <JWT>` como siempre.

---

## 1. Resumen en una línea

Existe un nuevo tipo de usuario, el **superadministrador**, con acceso a **todos los tenants** sin
ser miembro de ninguno. Se identifica por un campo booleano nuevo en `GET /users/me`.

**Si no vais a construir el panel de operador, el único cambio que os afecta es el punto 3**: el
array `memberships` puede venir **vacío** para un usuario que sí tiene acceso. Si vuestro código
asume «sin memberships ⇒ sin acceso», hay que tocarlo.

---

## 2. Qué NO cambia

Esto es importante para acotar el trabajo:

- **Ningún endpoint existente cambia de ruta, de verbo ni de forma de respuesta.**
- **No hay cambios en el login ni en el JWT.** El superadmin se resuelve en el backend a partir del
  email del token; en el token no hay ningún claim nuevo.
- **La URL sigue llevando el tenant.** Todas las llamadas de negocio siguen siendo
  `/api/tenant/{tenantId}/...`, también para el superadmin. **No existe** un modo «todos los tenants
  a la vez»: el superadmin trabaja sobre un tenant cada vez, igual que cualquier otro usuario.
- **Los usuarios normales no notan nada.** Para ellos el comportamiento es idéntico al de antes.

---

## 3. El cambio que sí afecta a todos: `GET /users/me`

La respuesta incluye un campo nuevo, `superAdmin`:

```json
{
  "id": "uuid",
  "email": "root@example.com",
  "firstName": "Iván",
  "lastName": "Duart",
  "superAdmin": true,
  "timezone": "Europe/Madrid",
  "language": "es",
  "memberships": []
}
```

- Es **siempre** booleano y **siempre** viene (`false` para el 99,9 % de los usuarios).
- Solo aparece en `GET /users/me` y en `GET /tenant/{tenantId}/users/me`. **No** aparece en los
  listados de usuarios de un tenant, a propósito: no se revela quién es superadmin.

### ⚠️ `memberships` puede venir vacío

Un superadmin normalmente **no es miembro de ningún tenant**, así que `memberships` llega como `[]`
aunque tenga acceso total.

```ts
// ❌ Antes
const puedeEntrar = me.memberships.length > 0;

// ✅ Ahora
const puedeEntrar = me.superAdmin || me.memberships.length > 0;
```

Revisad cualquier sitio donde se derive de `memberships`: el guard de arranque, la redirección
post-login, la selección automática de tenant cuando solo hay uno, y el cálculo de rol/permisos
para pintar menús.

---

## 4. Cómo elige tenant un superadmin

Como `memberships` está vacío, el selector de tenant habitual no sirve. El superadmin usa el
listado global, que ya existía y al que ahora tiene acceso:

```http
GET /api/tenants?page=0&size=20
```

Solo acepta paginación (`page`, `size`, `sort`); **no tiene parámetro de búsqueda** por ahora, así
que el filtrado por nombre es cosa vuestra en cliente. Viene ordenado por `name` ascendente.

Respuesta en formato `PagedModel` estándar:

```json
{
  "content": [
    { "id": "uuid", "name": "Clínica Ejemplo", "adminTenant": false }
  ],
  "page": { "size": 20, "number": 0, "totalElements": 42, "totalPages": 3 }
}
```

Flujo recomendado tras el login:

1. `GET /users/me`.
2. Si `superAdmin === true` → pantalla de selección de tenant alimentada por `GET /api/tenants`.
3. Al elegir uno, guardar su `id` y seguir con el flujo normal: a partir de ahí todas las llamadas
   van a `/api/tenant/{tenantId}/...` exactamente igual que para un `ADMIN`.

---

## 5. Permisos: asumid que los tiene todos

Dentro de un tenant, el superadmin pasa **todos** los chequeos de permiso del backend
(`VIEW_MENU`, `MANAGE_TENANT`, `VIEW_BILLING`…), incluidos los globales.

Como `memberships` viene vacío, **no hay una lista de permisos de la que derivar la UI**. Si
pintáis menús y botones a partir de los permisos de la membresía, tratad `superAdmin === true` como
«todos los permisos»:

Recordad la forma de una membership —`permissions` es un array plano de códigos, no objetos—:

```json
{
  "tenantId": "uuid",
  "tenantName": "Clínica Ejemplo",
  "userType": "STAFF",
  "roleCode": "ADMIN",
  "permissions": ["VIEW_MENU", "MANAGE_MENU", "MANAGE_TENANT"],
  "clinicalStatus": "ACTIVE"
}
```

```ts
function tienePermiso(me: Me, tenantId: string, code: string): boolean {
  if (me.superAdmin) return true;          // ← añadir esta línea
  const m = me.memberships.find(x => x.tenantId === tenantId);
  return m?.permissions.includes(code) ?? false;
}
```

Lo mismo con `userType` y `roleCode`: para un superadmin **no existen** (no hay membership de la
que leerlos). Si la UI se ramifica por `userType === 'STAFF'`, añadid `me.superAdmin` a esa rama.

Hay **una excepción**: las funciones de IA siguen dependiendo de la preferencia `aiEnabled` del
tenant, no del usuario. Si el centro tiene la IA apagada, el superadmin tampoco la ve. Es
deliberado: esa preferencia protege la clave de Gemini del centro, que se le factura a él.

---

## 6. Tenants suspendidos por impago

Hoy, un tenant con la suscripción `SUSPENDED` responde `403` con `code: "TENANT_SUSPENDED"` en todo
salvo `billing`, `branding` y `profile`.

**Para un superadmin eso ya no ocurre**: entra con normalidad en un tenant suspendido.

Las cabeceras de aviso se siguen enviando, así que el banner de «suscripción suspendida» **se sigue
pintando igual** — y conviene que se pinte, porque es la señal de que ese centro está impagado:

```
X-Billing-Status: SUSPENDED
X-Billing-Grace-Ends-At: 2026-12-11T00:00:00Z
```

No hace falta ningún cambio por vuestra parte. Solo tenedlo en cuenta si en algún punto habéis
atado el banner a «la petición ha fallado con 403» en lugar de a la cabecera: para el superadmin la
petición va a ir bien y el banner tiene que salir igualmente.

---

## 7. Chat: el superadmin mira, no participa

Es el único módulo donde el superadmin **no** puede hacer todo, y hay que reflejarlo en la UI.

| Acción | Superadmin | Respuesta si lo intenta |
|---|---|---|
| Listar hilos del tenant | ✅ Ve **todos** los del centro | — |
| Abrir un hilo y leer sus mensajes | ✅ | — |
| Ver adjuntos (URL firmada) | ✅ | — |
| **Enviar un mensaje** | ❌ | `403` · `error.chat_superadmin_read_only` |
| **Marcar como leído** | ❌ | `403` · `error.chat_superadmin_read_only` |
| **Archivar un hilo** | ❌ | `403` · `error.chat_superadmin_read_only` |
| **Borrar un mensaje ajeno** | ❌ | `403` · `error.chat_not_message_owner` |

El motivo: el mensaje quedaría atribuido al operador de la plataforma dentro de una conversación
clínica, y tanto el estado de leído como el archivado van por lado (paciente / nutricionista), lado
que el superadmin no ocupa.

**Qué hacer en la UI:** cuando `me.superAdmin === true`, abrir el chat en **modo lectura** —ocultar
el compositor de mensajes y el botón de archivar— en lugar de dejar que el usuario lo intente y se
coma un 403.

### Detalles del listado de hilos para un superadmin

- Devuelve **todos** los hilos del tenant, no solo los suyos (no tiene ninguno).
- `unreadCount` es **siempre `0`**. No tiene estado de lectura en el hilo, así que no hay «no leído»
  que contar. No pintéis el badge de pendientes en este modo.
- El filtro `archived` se resuelve por el lado del **nutricionista** (es decir: «hilos que el centro
  ha dado por cerrados»).

### Crear un hilo

Un nutricionista abre el hilo consigo mismo, así que hoy `nutritionistId` es opcional. **Para un
superadmin es obligatorio**, porque el valor por defecto lo metería a él dentro de la conversación:

```http
POST /api/tenant/{tenantId}/chat/threads
{ "patientId": "uuid", "nutritionistId": "uuid" }   // ← nutritionistId obligatorio
```

Si se omite:

```json
HTTP 409
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "A superadmin must name the nutritionist of the thread explicitly",
  "code": "error.chat_superadmin_needs_nutritionist"
}
```

---

## 8. Resumen de cambios a implementar

| # | Cambio | Quién lo necesita |
|---|---|---|
| 1 | Leer `superAdmin` de `GET /users/me` | Todos |
| 2 | Dejar de asumir que `memberships` vacío ⇒ sin acceso | Todos |
| 3 | `tienePermiso()` devuelve `true` si `superAdmin` | Todos |
| 4 | Pantalla de selección de tenant vía `GET /api/tenants` | Panel de operador |
| 5 | Chat en modo lectura (sin compositor ni archivar) | Panel de operador |
| 6 | Ocultar el badge de no leídos en el chat | Panel de operador |
| 7 | `nutritionistId` obligatorio al crear hilo | Panel de operador |

Los puntos 1–3 son los imprescindibles. Del 4 al 7 solo hacen falta cuando construyáis la vista de
operador de plataforma.

---

## 9. Nuevos códigos de error

Ambos llegan en el campo `code` del `ProblemDetail`, como el resto:

| `code` | HTTP | Cuándo |
|---|---|---|
| `error.chat_superadmin_read_only` | 403 | Un superadmin intenta escribir, marcar leído o archivar un hilo en el que no participa |
| `error.chat_superadmin_needs_nutritionist` | 409 | Un superadmin crea un hilo sin indicar `nutritionistId` |

---

## 10. Cómo probarlo

El flag se concede en base de datos, no hay endpoint para ello:

```sql
UPDATE app_user SET super_admin = TRUE WHERE lower(email) = lower('tu.email@ejemplo.com');
```

Hay que volver a hacer login (o recargar `GET /users/me`) para que el frontend vea el cambio.

Para volver atrás, el mismo `UPDATE` con `FALSE`.

---

## Ver también

- [`../../README.md`](../../README.md) — sección «Resumen de roles y permisos → SUPERADMIN».
- [`userType.md`](userType.md) — clasificación `STAFF` / `PATIENT`, que el superadmin no usa.
- [`../assistant/chat-frontend.md`](../assistant/chat-frontend.md) — contrato completo del chat 1:1.
