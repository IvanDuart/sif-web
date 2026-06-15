# Tus Dietas - Frontend Blueprint

Este documento describe la arquitectura, modelo de datos y lógica de negocio del backend de **Tus Dietas**. Está diseñado para servir como contexto completo (prompt) para la creación del frontend (SPA/PWA, por ejemplo, en React, Angular, o Vue).

## 1. Visión General de la Arquitectura (Multitenant)

La plataforma está diseñada con una arquitectura **Multitenant (múltiples inquilinos)**.
Un "Tenant" representa a una clínica, un profesional nutricionista independiente o una empresa.
- **Aislamiento de Datos**: Todos los datos (menús, usuarios, plantillas) están aislados por tenant. El backend garantiza esto exigiendo el ID del tenant en casi todas las peticiones a la API.
- **Roles y Permisos**: Un usuario puede pertenecer a varios tenants, pero dentro de cada tenant tiene un único **Rol**. Ese rol le confiere una serie de **Permisos** (RBAC).
- **Personalización (Branding)**: Cada tenant puede configurar sus preferencias visuales (colores, logo, idioma) para que la interfaz web sea una marca blanca.

## 2. Autenticación y Contexto

- **Auth System**: Basado en JWT (Keycloak, Auth0, etc.). El frontend obtendrá un token de acceso estándar e incluirá un header `Authorization: Bearer <token>`.
- **Identidad**: El correo electrónico (extraído del token) es el identificador universal del usuario en la plataforma.
- **Login Inicial y Contexto**:
  Al iniciar sesión, el frontend debe consultar el endpoint `GET /users/me`.
  Este endpoint devuelve los datos básicos del usuario y un array con todos los tenants a los que tiene acceso (`memberships`), incluyendo qué rol y permisos tiene en cada uno.
  Si el usuario pertenece a un solo tenant, el frontend entrará directo. Si pertenece a varios, debe mostrar un selector.

## 3. Estructura de Endpoints (API)

Casi toda la API sigue el patrón: `/api/tenant/{tenantId}/...`
Este prefijo es obligatorio. Al seleccionar un tenant, el frontend debería mantener este `tenantId` en memoria o en la URL para construir todas las peticiones posteriores.

### 3.1 Endpoints Globales y Públicos
- `GET /api/users/me` -> Obtiene el usuario actual y la lista de todos sus tenants accesibles.
- `GET /api/tenant/{tenantId}/branding` -> **PÚBLICO**. Devuelve `name`, `primaryColor`, `defaultLanguage`, `logoUrl`. Útil para cargar estilos y logo en la pantalla de Login *antes* de autenticarse, si se entra por subdominio o URL directa.
- `GET /api/tenant/{tenantId}/branding/logo` -> **PÚBLICO**. Devuelve el byte stream de la imagen.

### 3.2 Endpoints del Tenant
*Todos asumen el prefijo `/api/tenant/{tenantId}`*

**Branding & Settings**
- `PUT /branding/preferences` -> Actualiza colores e idioma. (Permiso: `MANAGE_TENANT_BRANDING`)
- `PUT /branding/logo` -> (Multipart) Sube un nuevo logo. (Permiso: `MANAGE_TENANT_BRANDING`)

**Usuarios del Tenant**
- `GET /users` -> Lista miembros del tenant. (Permiso: `VIEW_USER`)
- `POST /users/invite` -> `{ email, firstName, lastName, roleCode }`. Invita a alguien. Si no existe, se crea su cuenta base. (Permiso: `INVITE_USER`)
- `PUT /users/{userId}/role` -> Cambia el rol a un miembro. (Permiso: `MANAGE_USER`)
- `DELETE /users/{userId}` -> Expulsa al usuario del tenant. (Permiso: `MANAGE_USER`)

**Menús y Comidas**
- `GET /menu`, `POST /menu`, `GET /menu/{id}`, `DELETE /menu/{id}` -> CRUD de menús de dieta. (Permisos: `VIEW_MENU`, `MANAGE_MENU`)
    - *Nota*: Al hacer un POST a menú pasando `isActive: true`, automáticamente desactiva el menú anterior de ese paciente.
- `GET /meal`, `POST /meal`, `GET /meal/menu/{menuId}`, `DELETE /meal/{id}` -> CRUD de comidas. (Permisos: `VIEW_MENU`, `MANAGE_MEAL`)
- `POST /menu/upload` -> (Multipart). Pasa un parámetro extra `?userId=xxx`. Sube una imagen u hoja PDF con una dieta. El backend ejecuta OCR / Parsing por IA, y devuelve el `Menu` con todas sus `Meal` ya creadas en base de datos de manera automática.

**Plantillas de Menú (Templates)**
- `GET /menu-template`, `POST /menu-template`, `GET /menu-template/{id}`, `DELETE /menu-template/{id}` -> CRUD plantillas maestras. (Permiso: `MANAGE_TEMPLATE`)
- `POST /menu-template/{id}/instantiate` -> Payload: `{appUserId, name, isActive}`. Clona una plantilla y genera un menú real para el usuario indicado, copiando todas las comidas. (Permiso: `INSTANTIATE_TEMPLATE`)

### 3.3 Endpoints Administrativos Globales (Superadmin)
- `/api/tenants` -> Para gestionar la plataforma y dar de alta nuevas clínicas. Solo disponible para usuarios cuyo rol resida en un tenant configurado con `adminTenant=true` y tengan el permiso `MANAGE_TENANT`.

## 4. Modelo de Datos y Entidades Frontend (Tipos Sugeridos)

### `AppUser`
```typescript
interface AppUser {
  id: string; // UUID
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string; // ISO-8601
  memberships: TenantMembership[]; // Disponible solo en GET /users/me
}

interface TenantMembership {
  tenantId: string;
  tenantName: string;
  roleCode: string; // 'ADMIN', 'NUTRITIONIST', 'USER'
  permissions: string[]; // Ej: ['VIEW_MENU', 'MANAGE_MENU']
}
```

### `Tenant` y `Branding`
```typescript
interface TenantBranding {
  name: string;
  primaryColor: string;
  defaultLanguage: string;
  logoUrl: string; // usar en tag <img>
}

interface TenantPreferences {
  enable_vacation_module: boolean;
  enable_clock_in_module: boolean;
  default_language: string;
  primary_color: string;
  keycloak_sync_mode: string;
  from_email: string;
  standard_vacation_days: number;
}
```

### `Menu` y `Meal`
```typescript
interface Menu {
  id: string; // UUID
  name: string;
  isActive: boolean; // Solo un menú activo por paciente
  createdAt: string;
  meals?: Meal[]; // En la llamada detallada
}

interface Meal {
  id: string; // UUID
  dayOfWeek: string; // Lunes, Martes, etc.
  mealType: string; // Desayuno, Almuerzo, Cena, etc.
  description: string; // Contenido real del plato
}
```

### `MenuTemplate` y `MealTemplate`
```typescript
interface MenuTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  mealTemplates?: MealTemplate[];
}

interface MealTemplate {
  id: string;
  dayOfWeek: string;
  mealType: string;
  description: string;
}
```

## 5. Casos de Uso del Frontend y Lógica Clave

1. **Resolución Inicial (Branding dinámico)**
    - Si la web se abre mediante una URL dedicada (`clinicax.tusdietas.com` o `app.tusdietas.com/tenant/UUID`), el frontend debe hacer una petición a `GET /api/tenant/{UUID}/branding`.
    - Modificará las variables CSS globales (`--primary-color`) e inyectará el `logoUrl` en la pantalla de Login *antes* de que el usuario inicie sesión.

2. **Acceso al Dashboard**
    - Una vez autenticado, tras hacer `GET /users/me`, buscará a qué tenants tiene acceso el usuario.
    - Guardar el listado de permisos (`permissions`) y el `tenantId` seleccionado en el State Manager (Zustand, Redux, Context).
    - Crear una función auxiliar o Hook `useHasPermission('MANAGE_MENU')` que verifique contra el array en memoria si puede mostrar botones de Editar/Borrar.

3. **Flujo de Asignación de Dietas**
    - El Nutricionista ve el listado de usuarios de su clínica.
    - Selecciona a un usuario.
    - Puede hacerlo de tres maneras:
        1. **Manualmente**: Creando un Menú desde cero y añadiendo "Comidas" (Meals) por día de la semana.
        2. **Por Plantilla**: Elige una plantilla y llama a `/instantiate` para clonar todo el régimen en un segundo.
        3. **Por Subida de Archivo (Upload)**: Sube una foto o un PDF. El backend realiza la magia por debajo y el frontend simplemente refresca la vista del Menú con la data parseada.

4. **Flujo de Invitación de Pacientes**
    - En la pestaña de Usuarios, el administrador o nutricionista inserta el mail, nombre y le asigna el rol `USER`.
    - Llama a `POST /api/tenant/{tenantId}/users/invite`.

## 6. Manejo de Errores
El backend usa un formato de error unificado: `{ "error": "User not found" }`.
HTTP 403 Forbidden significa que el usuario actual no tiene el permiso (`permissionCode`) requerido o no pertenece a ese tenant.
HTTP 404 significa que la entidad no existe (o no pertenece al tenant actual y se oculta deliberadamente).