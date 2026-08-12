# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**sif-web** is a multi-tenant Angular 21 SPA for managing physiotherapy and nutrition clinics (patient files, body measurements, diet menus, appointment scheduling, revenue, clinic branding). A "tenant" is a clinic/professional; users can belong to multiple tenants, each with one role and a set of RBAC permissions. The backend is a separate Spring Boot service (not in this repo); the frontend consumes its REST API.

- **UI stack:** Taiga UI v5 (`@taiga-ui/*`) for all components, Tailwind CSS for layout/spacing only, Font Awesome 7 icons, Chart.js, FullCalendar, Maskito input masks.
- **State management:** Angular signals everywhere (`signal`, `computed`, `effect`) — no NgRx/Redux.
- **Package manager:** npm (node_modules is npm-based, `package-lock.json` is the live lockfile; `pnpm-lock.yaml` is stale).
- **Design rules are binding:** `DESIGN.md` and `PRODUCT.md` at the repo root define the Emerald/Slate palette, typography (Poppins display + system-ui body), and what is banned (serif fonts, emojis in labels, native `<table>`/switch sliders, mixing Tailwind buttons with `tuiButton`, custom `.data-table` styles). Every table, button, badge, input, and dialog must use the Taiga UI component — see `DESIGN.md` before styling anything.

## Commands

```bash
npm start              # dev server on http://localhost:4200 (ng serve, default development config)
npm run build          # production build to dist/sif-web/browser
npm run watch          # rebuild on change (development config)
npm test               # Karma + Jasmine unit tests (opens headless Chrome; needs Chrome installed)
npm run lint           # eslint via angular-eslint
npx boneyard-js build  # regenerate src/bones/registry.ts from the *.bones.json files
```

- Run a single test file: Karma is configured without a file filter flag, so use `npm test -- --include=<path-glob>` (e.g. `npm test -- --include=**/menu*.spec.ts`), or temporarily focus with `fdescribe`/`fit`. Tests are Jasmine `*.spec.ts` colocated with source.
- E2E: none configured (`ng e2e` has no framework installed).

## Architecture

### Standalone components + lazy-loaded pages
- Everything is standalone (no NgModules). Routes in `src/app/app.routes.ts` lazy-load pages via `loadComponent`. Feature "pages" are **default-exported** standalone components named `*.page.ts` (e.g. `features/patients/patients-list.page.ts` exports `default class PatientsListPage`) — this default export is required by the lazy imports.
- App root is `src/main.ts` → `bootstrapApplication(App, appConfig)`; providers are all centralized in `src/app/app.config.ts`.
- Route tree: `Shell` (layout) wraps authenticated tenant routes, guarded by `authGuard` and resolved by `brandingResolver`; `/admin` additionally uses `adminGuard`. `sandbox` is an unauthenticated playground route used by boneyard to capture skeletons.

### Directory layout (`src/app/`)
- `core/` — cross-cutting concerns:
  - `api/` — typed models (`models/`) and one HTTP service per backend resource (`services/*.api.ts`). Services take `tenantId` as the first arg and build URLs as `${apiUrl}/tenant/{tenantId}/...`.
  - `auth/` — Keycloak wiring (`keycloak.config.ts`, `auth.guard.ts`, `admin.guard.ts`, `auth.interceptor.ts`, `auth.service.ts`, `init.service.ts`).
  - `http/` — functional interceptors: `auth`, `error`, `loading`.
  - `branding/` — `theme.service.ts` (dark mode + tenant primary color CSS vars), `branding.resolver.ts`.
  - `config/` — `config.service.ts` (runtime env config).
  - `i18n/` — Transloco loader + `app-lang.service.ts`.
  - `permissions/` — `permissions.service.ts`, `if-permission.directive.ts`, `permission.guard.ts`.
  - `tenant/` — `tenant-context.service.ts` (derives current tenantId/membership/permissions).
  - `ui/` — `NotificationService` (toasts), `ModalService`, `ConfirmService` — all thin wrappers over Taiga UI, exported from `index.ts`.
- `features/<domain>/` — one folder per business area (patients, staff, users, menus, shopping-lists, templates, appointments, revenue, settings, tenant, admin, sandbox, error). List pages, detail pages, and `*.dialog.ts` modal components live here.
- `layout/shell/` — the authenticated app shell: sidebar nav (permission-filtered `NAV_ITEMS`), tenant switcher, theme toggle, appointment-proposal bell.
- `shared/` — `ui/` (PageHeader, EmptyState, TenantLogo), `utils/` (bmi, chart-config, date), `pipes/`.
- `bones/` — boneyard skeleton definitions (see below).

### Auth & tenant context flow
1. `getKeycloakProvider()` builds `provideKeycloak` from `ConfigService` (realm `master`, client `localhost-frontend`, `check-sso`).
2. `InitService` watches Keycloak events (`Ready`, `AuthSuccess`). On auth it calls `GET /users/me`, stores the user in `AuthService.user` (a signal), picks the active tenant (from `localStorage['active-tenant']` or the first membership) into `AuthService.selectedTenant`, then signals `isTenantLoaded$`.
3. `authGuard` forces login if unauthenticated, then **waits for `isTenantLoaded$`** before allowing navigation.
4. `TenantContextService` derives `currentTenantId`, `currentMembership`, and a `Set` of `permissions` from those signals. `PermissionsService.has(code)` and the `*appIfPermission` structural directive gate UI elements.
5. Tenant switching is a full page reload (`selectTenant` sets the tenant and calls `location.reload()`). Persist `localStorage['active-tenant']` and `['active-user']`.

### HTTP & configuration
- Three interceptors in `app.config.ts` order: `authInterceptor` (attaches `Authorization: Bearer`, refreshing the Keycloak token first if stale), `errorInterceptor`, `loadingInterceptor`.
- `errorInterceptor` maps status codes globally: 401 → token refresh/login, 403 → toast + redirect `/not-authorized`, 404 → warning toast (suppressible per-request via `IGNORE_NOT_FOUND` context token), anything else → toast with `error.error?.error`. Use the `IGNORE_NOT_FOUND` token when 404s are expected.
- `loadingInterceptor` increments `globalLoadingSignal` per in-flight request — the shell shows a top progress bar from it.
- `ConfigService` reads a `window.ENV` global (set at container runtime) and resolves placeholders like `___API_URL___`; outside Docker it falls back to localhost defaults. In production the Docker `entrypoint.sh` `sed`-replaces those placeholders in `index.html` at startup. Keep default values dev-friendly; don't hardcode real URLs into code.

### Runtime-config & Docker
- `Dockerfile` is multi-stage: node:22 build → nginx:alpine serve of `dist/sif-web/browser`. `docker/entrypoint.sh` substitutes `API_URL`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` into the served HTML, so runtime config never lives in the bundle. `nginx.conf` does SPA `try_files` fallback.

### i18n (Transloco)
- Languages: `es` (default) and `en`, JSON files in `src/assets/i18n/{es,en}.json`. Loaded via `TranslocoHttpLoader`.
- `AppLangService` persists the choice in `localStorage['preferredLanguage']` and sets the active Transloco lang. `brandingResolver` re-resolves it from tenant branding.
- Taiga UI's own language (`TUI_LANGUAGE`) is **synced to the active Transloco lang** in `app.config.ts` (`provideTuiLanguage`) — when adding a locale, update both.
- Use the `*transloco="let t"` directive with `t('key')` in templates (strings are in the JSON files, not inlined).

### Boneyard skeleton loaders
- `<boneyard-skeleton name="<bone-name>" [loading]="...">` wraps loading content; bones are pixel-precise skeleton layouts captured from the real rendered page.
- Bone JSON lives in `src/bones/*.bones.json`; `src/bones/registry.ts` is **auto-generated** by `npx boneyard-js build` (do not edit by hand — the header says so). To add/update a skeleton for a page: ensure the page is reachable and matches `boneyard.config.json` routes, then run the build.

### Backend API conventions (Spring Boot, external)
- Nearly all endpoints are `/api/tenant/{tenantId}/...`; the backend enforces tenant isolation, so the tenantId must always be supplied from `TenantContextService.currentTenantId()`.
- Pagination responses use **PagedModel** format: `{ content: [...], page: { size, number, totalElements, totalPages } }` — NOT the old Spring `PageImpl` shape. See `doc/breaking-changes.md` (also documents the `users/by-type/STAFF|PATIENT` route change).
- Errors return `{ "error": "message" }`. HTTP 403 = missing permission for the current tenant; 404 = entity missing (or deliberately hidden for another tenant).
- Users come from `GET /users/me` as `AppUserDto` with `memberships: TenantMembershipDto[]` (`{ tenantId, tenantName, roleCode, permissions[], userType }`).
- `doc/` holds backend feature specs and frontend integration guides (e.g. `API.md`, `FRONTEND_INTEGRATION_GUIDE.md`, `menu-template-upload-frontend-guide.md`) — consult the relevant one before implementing against a feature.

### Design tokens & theming
- `ThemeService` toggles the `dark` class on `<html>` (Tailwind `darkMode: 'class'`) and sets per-tenant brand colors as CSS variables: `--p-primary-*` (Tailwind `primary` palette) and `--tui-primary` / `--tui-background-accent-1` (Taiga tokens). `brandingResolver` calls `themeService.setPrimary()` from tenant branding before the Shell renders.
- The base Emerald/Slate theme is defined in `src/styles.less` (Tailwind directives + Taiga theme imports + `--p-*` / `--tui-*` token overrides). `tailwind.config.js` maps `surface` (slate ramp) and `primary` (var-driven) colors — use `text-surface-500`, `bg-surface-0`, etc. for neutral styling.

## Conventions & gotchas
- **Permissions everywhere**: gate any mutation behind `*appIfPermission="'PERMISSION_CODE'"` (or `PermissionsService.has`) — e.g. `MANAGE_MENU`, `VIEW_USER`, `VIEW_APPOINTMENTS`, `VIEW_REVENUE`, `MANAGE_TENANT_BRANDING`, `MANAGE_TENANT`. Nav items are permission-filtered in `shell.ts` `NAV_ITEMS`.
- **Signals, not subjects**: new state should be `signal()`/`computed()`; avoid adding BehaviorSubjects to the signal-based services.
- **UI services**: use `NotificationService`, `ModalService`, `ConfirmService` from `core/ui` instead of Taiga UI directly — they standardize toasts/dialogs/confirms across the app.
- **Default exports for pages**: keep `export default` on lazy-loaded page components or route imports break.
- **No custom native controls**: a `<table>`, `<button>`, `<input>`, `<span tuiBadge>` etc. must come from Taiga UI (`tuiTable`/`tuiTh`/`tuiTr`/`tuiTd`, `tuiButton`/`tuiIconButton`, `tui-textfield` wrapper with `tuiLabel`/`tuiInput`).
- **Lint**: ESLint enforces `app` selector prefixes (kebab-case components, camelCase attributes) and prefers Angular control flow (`@if`/`@for`) over `*ngIf`/`*ngFor` (warn).
