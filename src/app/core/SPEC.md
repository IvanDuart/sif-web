---
id: core-module
type: module-design
title: core — cross-cutting services
status: draft
parent: architecture
---

# core

## Responsibility

`core` owns everything that every feature needs and nobody should re-implement:

- **Identity and tenant context.** Keycloak wiring, `InitService`, `AuthService` (user and selected
  tenant signals), `TenantContextService`, and the guards (`authGuard`, `adminGuard`, `chatGuard`).
  `authGuard` waits for the tenant to load before it lets navigation through.
- **Permissions.** `PermissionsService.has(code)`, the `*appIfPermission` directive and
  `permission.guard`.
- **Backend access.** Typed models (`api/models/`) and one client per backend resource
  (`api/services/*.api.ts`). Each client takes `tenantId` as its first argument and builds
  `${apiUrl}/tenant/{tenantId}/…`. The SSE channels (menus, notifications, chat, assistant) all go
  through `sse-stream.ts`. It renews the JWT before each (re)connect, waits 3 s before reconnecting
  after a drop, and closes for good on 403/404, because retrying a permission denial would never
  succeed.
- **HTTP interceptors.** auth, error and loading (see `architecture` for the order and the error
  mapping).
- **Runtime config** (`ConfigService`, reading `window.ENV`), **i18n** (`AppLangService`, Transloco
  loader) and **branding** (`ThemeService`, `brandingResolver`, branding store).
- **UI wrappers.** `NotificationService`, `ModalService` and `ConfirmService` (`core/ui`) are the
  only way features show toasts, dialogs and confirms. They keep the Taiga UI usage consistent.

## Boundary

- May depend on Angular, Taiga, Keycloak, Transloco and `shared/`. Never imports from `features/` or
  `layout/`.
- API clients carry no UI concerns. The only exception is per-request context tokens such as
  `IGNORE_NOT_FOUND`, which tell the global error interceptor what to do with that request.
- Holds no feature state. Feature-specific stores live with their feature.
