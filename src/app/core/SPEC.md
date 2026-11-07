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
  `authGuard` waits for the tenant to load before it lets navigation through. **Angular does not
  chain a route's `canActivate` array** — it subscribes to every guard at once and combines the
  results (`prioritizedGuardValue` is a `combineLatest`). A guard listed after `authGuard` therefore
  does *not* inherit its wait: on a cold refresh it runs while user, tenant and permissions are
  still empty, and whatever it decides there is final. Any guard that reads that state must go
  through `afterTenantLoaded()` (`core/auth/tenant-ready.ts`).
- **Permissions.** `PermissionsService.has(code)`, the `*appIfPermission` directive and
  `permission.guard`. Always go through `has()`, never through the raw `permissions()` set: a
  platform superadmin belongs to no tenant and its synthetic membership carries `permissions: []`,
  so reading the set directly locks it out of everything.
- **Backend access.** Typed models (`api/models/`) and one client per backend resource
  (`api/services/*.api.ts`). Each client takes `tenantId` as its first argument and builds
  `${apiUrl}/tenant/{tenantId}/…`. The SSE channels (menus, notifications, chat, assistant) all go
  through `sse-stream.ts`. It renews the JWT before each (re)connect, waits 3 s before reconnecting
  after a drop, and closes for good on 403/404, because retrying a permission denial would never
  succeed.
- **HTTP interceptors.** auth, billing, error and loading (see `architecture` for the order and the
  error mapping).
- **Billing status.** `BillingStatusService` (`core/billing/`) keeps the tenant's subscription state
  in signals. `billingInterceptor` feeds it the `X-Billing-*` headers that ride on every
  `/api/tenant/**` response, so the banner costs no extra request; `GET /billing/status` is only
  fetched when those headers say the state changed. A `403 TENANT_SUSPENDED` marks it suspended and
  sends the user to `/billing`, the one area that still answers.
- **Runtime config** (`ConfigService`, reading `window.ENV`), **i18n** (`AppLangService`, Transloco
  loader) and **branding** (`ThemeService`, `brandingResolver`, branding store).
- **UI wrappers.** `NotificationService`, `ModalService` and `ConfirmService` (`core/ui`) are the
  only way features show toasts, dialogs and confirms. They keep the Taiga UI usage consistent.

## Boundary

- May depend on Angular, Taiga, Keycloak, Transloco and `shared/`. Never imports from `features/` or
  `layout/`.
- API clients carry no UI concerns. The only exception is per-request context tokens such as
  `IGNORE_NOT_FOUND`, which tell the global error interceptor what to do with that request. Those
  tokens live in `core/http/http-context.tokens.ts`, not in the interceptor: the error interceptor
  depends on API-facing services (billing status), and the import cycle would leave the tokens
  uninitialised.
- Holds no feature state. Feature-specific stores live with their feature.
