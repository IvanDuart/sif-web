---
id: features-module
type: module-design
title: features — business areas
status: draft
parent: architecture
depends-on: [core-module]
---

# features

## Responsibility

There is one folder per business area. Each folder owns its pages (lazy-loaded, default-exported
`*.page.ts`), its dialogs (`*.dialog.ts`) and its local components:

- **Staff side:** `patients`, `users` (patient/user detail), `staff`, `menus`, `templates`,
  `shopping-lists`, `appointments`, `chat` (staff-only, enforced by `chatGuard`), `revenue`,
  `settings` (tenant branding), `tenant` (dashboard), `admin` (platform admins create tenants),
  `help`.
- **Patient side** (read-mostly): `my-diet`, `evolution`, `shopping-lists`.
- **Infrastructure:** `error` (not-authorized / not-found) and `sandbox` (an unauthenticated
  playground that boneyard uses to capture skeletons; production builds swap its routes for an empty
  file).

The `assistant` folder lives here too, but it is its own module: see `assistant-module`.

## Boundary

- Features reach the backend only through `core/api` clients, with the tenant id taken from
  `TenantContextService`. Features never call `HttpClient` against ad-hoc URLs.
- Features may reuse each other's dialogs and components. For example, patient and staff detail
  pages embed appointment and menu pieces, and `users` aggregates several areas. Keep that reuse to
  components; a feature does not reach into another feature's private state.
- A form that the assistant can fill registers a *fill surface* from
  `assistant/mascot/fill/surfaces`. That is the only sanctioned dependency from a feature into the
  assistant.
- Every mutation is gated by a permission code. Every user-visible string is a Transloco key in
  `src/assets/i18n/{es,en}.json`.
