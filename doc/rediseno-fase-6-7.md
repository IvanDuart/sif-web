# Rediseño SIF-Web — Fases 6 y 7

**Estado:** Fase 6 ✅ · Fase 7 ✅ (validación automática; ver §7.4 para la
comprobación manual con backend + Keycloak).

Estas fases cierran el rediseño iniciado en las Fases 0–5: la 6 es la puesta a
punto (limpieza, accesibilidad y consolidación) y la 7 prepara y valida la
integración real.

---

## 1. Fase 6 — QA, limpieza y accesibilidad

### 1.1 Código y CSS muerto eliminado

Archivos que no se usaban en ninguna plantilla ni se importaban:

- `src/test-styles.css` (sobrante de una prueba de Tailwind v4; no estaba en
  `angular.json`).
- Hojas de estilo de componente **vacías o sólo con comentarios**, y su
  referencia en el decorador:
  - `src/app/app.scss` (`App`).
  - `src/app/features/appointments/appointments.page.scss`.
  - `src/app/features/settings/components/assignment-form.dialog.scss`.
  - `src/app/features/settings/components/holiday-form.dialog.scss`.
  - `src/app/features/tenant/dashboard/tenant-dashboard.component.scss`.
  - `src/app/features/users/user-detail.page.scss`.
- `src/app/features/help/help.page.scss`: se reescribe. Sólo sobrevive la regla
  real (`app-help-accordion`); fuera `.help-page` (nunca aplicada), los
  overrides de `tui-tab`/`tui-tab[ng-reflect-active]` (Taiga 5 usa
  `button[tuiTab]`) y el `html { scroll-behavior }` que se mueve a `styles.less`
  bajo `prefers-reduced-motion`.

Utilidades de `src/styles.less` sin ningún uso en plantillas, fuera:

- Tintes `bg-brand-tint-02`, `-04`, `-05`, `-50`.
- Borde `border-brand-tint-15`.
- `text-brand-contrast`.
- Gradientes `from-brand-tint-10` / `to-brand-tint-10`.
- El helper `.hidden\.sm\:table-cell` (clase inexistente; ninguna plantilla la
  usaba).

### 1.2 Accesibilidad

**Teclado en cabeceras de tabla.** Las columnas ordenables eran `<th
(click)>` sin foco. Ahora el control es un `<button class="sort-header">` dentro
del `<th>` (foco visible, `Enter`/`Espacio`), y el `<th>` publica
`aria-sort="ascending|descending"`. Aplicado a los cuatro listados ordenables:
menús, plantillas, pacientes y equipo. La utilidad `.sort-header` vive en
`styles.less`.

**Nombre accesible de las tablas.** Las 18 tablas de datos (`patients-list`,
`staff-list`, `menus-list`, `templates-list`, `shopping-lists`, detalle de menú
y plantilla, `revenue`, ajustes de horarios y tipos de cita, panel de admin,
cartera de equipo, mediciones…) reciben `aria-label` reutilizando las claves de
título ya existentes.

**Estados y carga.**

- Los iconos decorativos de `app-empty-state` pasan a `aria-hidden="true"`.
- Los contenedores de carga (`.table-loading`, `revenue`, widget de agenda)
  publican `role="status"` con etiqueta `common.loading`.
- El *skip link* del shell decía «Volver»; ahora usa `common.skip_to_content`
  («Saltar al contenido principal») y apunta al `<main id="main-content">` que ya
  existía.

**Diálogos.** Se verificó que todas las aperturas vía `ModalService` pasan
`label` (Taiga lo usa como nombre accesible del diálogo). Los botones de icono
(kebab de tabla, paginación, menú de usuario) ya llevaban `aria-label`, con los
iconos `aria-hidden`.

**Movimiento.** El desplazamiento suave (anclas de la ayuda) queda bajo
`@media (prefers-reduced-motion: no-preference)`; se mantienen los cortes de
animación ya existentes.

### 1.3 Consolidación de utilidades repetidas

- **`PaginationFooter`** (`src/app/shared/ui/pagination-footer.*`): el pie de
  paginación estaba copiado en cuatro listados. El nuevo componente recibe
  `[page]`, `[size]`, `[total]`, `[busy]` y emite `(prev)`/`(next)`; calcula
  «mostrando X a Y» y el habilitado de los botones en un solo sitio. Sustituye
  el bloque duplicado en `menus-list`, `templates-list`, `patients-list` y
  `staff-list`.
- **`.sort-header`**: una única definición del botón de orden en lugar de
  repetir `inline-flex items-center gap-1.5` en cada cabecera.

### 1.4 Verificación

- `ng build` (producción) y `ng build --configuration development`: OK.
- `ng lint`: *All files pass linting*.
- Sandbox: el pie del listado de equipo muestra «Mostrando 1 a 25 de 30
  elementos · Página 1»; con foco de teclado en «Nombre» y `Enter`, el
  `aria-sort` pasa a `descending` y reordena; «Página 2» muestra «26 a 30 de 30».

---

## 2. Fase 7 — Validación de integración

### 2.1 Aislamiento del `sandbox` respecto a producción

El banco de pruebas `/sandbox` y su *bypass* de Keycloak eran alcanzables en
cualquier build. Ahora:

- La ruta se movió a `src/app/features/sandbox/sandbox.routes.ts`, y
  `angular.json` la sustituye en `production` por
  `sandbox.routes.prod.ts` (array vacío) mediante `fileReplacements`.
  Comprobado: el bundle de producción **ya no contiene** ni la ruta ni el
  componente (`path:"sandbox"` y `Clínica Sandbox` ausentes de `dist`).
- `InitService` sólo omite el `keycloak.login()` cuando
  `!environment.production` y la ruta empieza por `/sandbox`.

### 2.2 Rutas y guardias

- Todas las vistas de la app cuelgan del `Shell`, protegido por `authGuard`
  (Keycloak + espera a que cargue el contexto de centro).
- `/admin` añade `adminGuard`: exige `MANAGE_TENANT` y `profile.adminTenant`; si
  no, redirige a `/not-authorized`.
- El comodín `**` redirige a `dashboard` (protegido), de modo que una ruta
  desconocida cae en el guardia de autenticación.
- `/sandbox` (sólo dev) y `/not-authorized` son las únicas rutas públicas.

### 2.3 Build de producción

- `npx ng build` limpio: total inicial **1,02 MB** (presupuesto de aviso 1,1 MB /
  error 1,5 MB).
- Sin el chunk del sandbox en la salida.

### 2.4 Checklist de validación manual (con backend + Keycloak)

Pendiente de ejecutar contra un entorno real. Recorrer con un usuario de cada
rol (administrador de centro y nutricionista):

1. **Login y contexto.** Entrar, confirmar redirección a `/dashboard`, que el
   nombre del centro y el usuario aparecen en el shell, y que el *refresh* de
   token no expulsa la sesión.
2. **Permisos por rol.** Con nutricionista, comprobar que se ocultan «Invitar
   Miembro», «Revocar acceso», la creación de menús/plantillas y las acciones de
   admin; con administrador de centro, que aparecen y funcionan.
3. **Listados y paginación.** En pacientes, equipo, menús y plantillas: buscar,
   filtrar, ordenar (ratón y teclado) y cambiar de página contra datos reales;
   verificar que el pie coincide con el total devuelto por el servidor.
4. **Kebab y navegación.** En cada tabla, abrir el kebab sin que la fila navegue
   y usar «Ver detalle / Editar / Revocar»; hacer clic en la fila y comprobar el
   destino.
5. **Alta de equipo.** Invitar un miembro y editar un usuario existente; ver los
   *toasts* de éxito.
6. **Menús y plantillas.** Crear/duplicar, editar comidas en línea (foco
   automático), arrastrar comidas entre días y generar la lista de la compra
   (comprobar el diálogo en móvil y escritorio).
7. **Modo oscuro.** Recorrer las mismas pantallas en oscuro y confirmar
   contraste de textos, cabeceras *sticky*, badges y estados vacíos.
8. **Errores.** Forzar un 403/401 y comprobar la vista `/not-authorized` y los
   *toasts* de error; probar una ruta inexistente (debe caer en `dashboard`).
9. **Móvil.** Repasar los listados en ancho de móvil (tarjetas en vez de tabla,
   diálogos a pantalla completa, *touch targets* ≥ 44 px).

---

## 3. Resultado

Con las Fases 6 y 7 cerradas, el rediseño queda funcionalmente completo:
sin CSS ni componentes muertos, con las tablas y estados operables por teclado y
etiquetados para lectores de pantalla, con las utilidades repetidas
consolidadas, y con el banco de pruebas fuera del build de producción. Sólo
resta la lista de comprobación manual de §2.4 en un entorno con backend y
Keycloak, y el PR a la rama principal.
