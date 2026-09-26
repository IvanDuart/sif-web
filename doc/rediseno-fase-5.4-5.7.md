# Rediseño SIF-Web — Fases 5.4, 5.5, 5.6 y 5.7

> Documento de cierre de las cuatro últimas fases del rediseño.
> Regla de oro respetada: **100 % frontend**, sin pérdida de funcionalidad.
> Se mantienen las tres reglas técnicas del plan (opacidad sobre `var()`, modo
> oscuro con `primary-300`, y `design/` intacto).

**Estado:** Fase 5.4 ✅ · Fase 5.5 ✅ · Fase 5.6 ✅ · Fase 5.7 ✅
**Verificación:** `ng build --configuration development` ✅ · `ng lint` ✅ · script de clases Tailwind ✅

---

## 1. Qué se ha hecho

### Fase 5.4 — Gestor de Planes (`menus`, `templates`, `shopping-lists`)

**Listado de dietas — `src/app/features/menus/menus-list.page.{html,ts}`**
- Cabecera al patrón nuevo: título en Satoshi (`26px` / `lg:32px`), recuento
  (`diets.count`) y contador de activos en la línea de subtítulo.
- Barra de acciones con `tuiButton`: **Importar** (secundario) y **Crear menú**
  (primario), conservando `*appIfPermission="'MANAGE_MENU'"`.
- **Filtros al aire**: buscador (`tui-textfield`) + `tuiSegmented`
  **Todos / Activos / Inactivos** con **contadores por chip** (dos peticiones
  ligeras `size=1`). Nuevo estado `statusFilter` y `filterIndex` en el TS; el
  filtro viaja al backend por el parámetro `isActive` que ya exponía
  `MenuService.search`.
- Se elimina el contenedor `data-card` envolvente: la tabla vive dentro de
  `.table-wrapper` como único contenedor, tal como el prototipo `planes.html`.
- **Menú kebab** (`tuiDropdown` + `tuiDataList` + `tuiOption`) con Ver detalle,
  Activar/Desactivar (si procede), Renombrar y Eliminar. Las acciones directas
  se conservan en las tarjetas móviles.
- *Empty state* diferenciado: sin menús vs. sin resultados de búsqueda.
- **i18n**: los textos que estaban a fuego en el TS (`Crear Menú Manualmente`,
  `Subir Menú…`, `¿Estás seguro…?`, `Menú creado/eliminado`) pasan a claves
  `diets.*`. Nuevas claves: `count`, `search_placeholder`, `filter_all/active/inactive`,
  `no_results_title/no_results`, `delete_confirm`, `create_title`, `upload_title`,
  `created_success`, `menu_actions`.

**Listado de plantillas — `src/app/features/templates/templates-list.page.{html,ts}`**
- Misma cabecera, buscador al aire y tabla en `.table-wrapper` sin `data-card`.
- Menú kebab con Ver detalle / Asignar a paciente / Eliminar.
- Filas y tarjetas clicables que navegan a `/templates/:id`.
- **Bug corregido**: `createTemplate` y `uploadTemplate` hacían
  `result.id` sin comprobar el nulo, de modo que **cancelar el diálogo lanzaba
  un error**. Ahora exige `result?.id` (mismo criterio que la fase 5.3 con
  “Invitar paciente”).
- **i18n**: mensaje de borrado y de creación a claves
  (`created_success`, `deleted_success`, `upload_title`).

**Detalle de plan — `src/app/features/menus/menu-detail.page.html`**
- Cabecera reescrita al patrón nuevo: miga/volver, título display, descripción,
  y línea de metadatos con badge de estado, interruptor de activación, fecha y
  **kcal discretas** en `tabular-nums text-surface-400` (ya no en badge, según
  la *Decisión 1*).
- Se conservan **todas** las acciones: Convertir en plantilla, Imprimir,
  Descargar PDF y Lista de la compra IA, además del grid de comidas con macros
  por comida.
- `p-4` de contenedor → `space-y-6 pb-4` (el padding lo aporta ya
  `.content-viewport`).

**Detalle de plantilla — `src/app/features/templates/template-detail.page.html`**
- Cabecera al mismo patrón, con asignación como acción primaria y metadatos de
  creación/actualización.

**Listas de la compra — `src/app/features/shopping-lists/shopping-lists.page.{html,ts}`**
- Cabecera con recuento (`shopping_list.count`) y `.table-wrapper` como único
  contenedor.
- Importes con `Intl.NumberFormat('es-ES','EUR')` (antes `toFixed(2) + ' €'`);
  se elimina `font-mono` en favor de `tabular-nums` y `text-primary-600 dark:text-primary-300`.

**Diálogos y componentes de apoyo**
- `meal-cell.html` / `meal-items-editor.html`: `text-red-500 hover:text-red-700`
  → `text-err`.
- `menu-upload.dialog.html`, `template-upload.dialog.html`,
  `menu-form.dialog.html`, `meal-form.dialog.html`, `template-form.dialog.html`,
  `shopping-list.dialog.html`: `border-surface-200 dark:border-surface-700` →
  `border-line`; `bg-primary-50 dark:bg-brand-tint-20` → `bg-brand-tint-08`;
  el aviso ámbar de “IA deshabilitada” pasa al par semántico
  `bg-warn-soft` / `border-warn` / `text-warn`.
- `shopping-list.dialog.html`: título en `font-display`.

### Fase 5.5 — Finanzas y Facturación (`revenue`)

> El grueso de esta pantalla ya se había construido en la **Fase 4** (endpoint
> agregado `GET /tenant/{id}/appointments/metrics`, tabs Facturación/Asistencia,
> Chart.js nativo, conmutador gráfica/tabla, presets de periodo, desgloses por
> profesional/tipo de cita/franja y barra de resultados). En esta fase se
> homogeneiza la presentación con `metricas.html`.

- `revenue.page.html`: la cabecera deja de ser un `h2 text-xl` y pasa al patrón
  de pantalla (título `h1` en Satoshi `26/32`, subtítulo `13px`, raíz
  `space-y-6 pb-4`).
- Se conservan íntegros los KPI, las dos gráficas, las tablas de serie, la barra
  de resultados y los desgloses.

### Fase 5.6 — Ajustes y Configuración del Centro

**`src/app/features/settings/branding-settings.page.{html,ts}`**
- De `tui-tabs` a **layout maestro-detalle** como `configuracion.html`:
  rejilla `236px + 1fr` con **nav lateral pegajoso** y, por debajo de `lg`,
  **nav horizontal con scroll**. Cada sección se activa con `activeTab`
  (se retira el import de `TuiTabs`).
- Cabecera de pantalla con título display y subtítulo (`settings.subtitle`,
  `settings.nav_group`, nuevos).

**Secciones**
- `branding-settings.html`: se quita el `h2` duplicado de sección (el título ya
  está en la cabecera de página); los `font-mono` de color/cifras pasan a
  `tabular-nums`; los *dropzones* de logo usan `bg-brand-tint-08`.
- `appointment-types-settings.html`: reescrito. Cabecera de sección
  (título + subtítulo + acción primaria), `.table-wrapper` sin `data-card`,
  `font-mono` → `tabular-nums`, `text-green-500` → `text-ok`,
  `text-red-…` → `text-err`, “Activo/Inactivo” a i18n, tarjetas móviles al
  patrón nuevo.
- `schedule-settings.html`: reescrito por completo. Tres sub-vistas (Jornadas,
  Asignaciones, Festivos) con cabecera de sección, tablas en `.table-wrapper`,
  acciones destructivas en `text-err`, y el tipo de festivo como `tuiBadge`
  (`info`/`neutral`) en vez de `bg-blue-100`/`bg-purple-100`. Se añade
  `TuiBadge` a los imports del componente.
- `tenant-address-settings.html`: cabecera de sección + tarjeta
  (`data-card`) con los campos Taiga y pie de guardado en `border-line`.

**Admin — `admin-dashboard.component.html`**
- Cabecera al patrón de pantalla; `.table-wrapper` como contenedor (sin
  `data-card`); `font-mono` → `tabular-nums`; tarjetas móviles con `border-line`;
  el punto de color del centro usa como respaldo la marca de la Guía
  (`#2F5D4F`) en lugar de `#059669`.

**`create-tenant.dialog.html`**
- `font-mono` → `tabular-nums`; aviso informativo con `bg-brand-tint-08` /
  `border-brand-tint-20`.

> **`tuiAvatar`:** el avatar unificado ya está en uso en el shell
> (`shell.html`) y en los widgets del panel (`patient-quick-search`,
> `quick-schedule-widget`). **No existe campo de “foto de perfil”** ni endpoint
> de subida en el modelo, así que no se inventó: las fichas/listados siguen con
> el chip de iniciales neutro de marca (patrón asentado en 5.3).

### Fase 5.7 — Vistas de Soporte (`error`, `help`)

**Error 403 — `src/app/features/error/not-authorized/not-authorized.component.{html,ts}`**
- Página centrada con icono en `bg-brand-tint-10 text-err`, código **403** en
  `font-display text-[64px] tabular-nums`, título, descripción y botón primario
  “Volver al inicio” (`routerLink="/dashboard"`).
- Se añaden `RouterModule` y `TuiButton` al componente; claves
  `errors.not_authorized_desc` y `errors.go_dashboard`.
- *Nota:* solo existe la ruta `not-authorized` (403). **No hay rutas 404/500**
  —el comodín `**` redirige a `dashboard`—, por lo que no se crearon páginas que
  el router no sirve; cuando existan rutas se reutilizará este mismo patrón.

**Ayuda — `src/app/features/help/help.page.html` y componentes**
- Cabecera al patrón de pantalla (título display, subtítulo, buscador al lado)
  y tabs sobre `border-line`.
- `help-accordion.component.ts`: tarjetas con `border-line`, contenido expandido
  en `bg-surface-50 dark:bg-surface-900`, y los enlaces “Ir a la aplicación” con
  `bg-brand-tint-10` / `hover:bg-brand-tint-20` (antes `bg-primary-100
  dark:bg-primary-900/30`, un no-op silencioso por la Regla de Oro 2).
- `help-search.component.ts`: campo con `border-line`, foco
  `border-primary-600 dark:border-primary-300` y `aria-label` localizado
  (`clearLabel`).

### Transversal

- **`.loading-spinner`** se usaba en varios sitios pero **no estaba definido en
  ningún CSS**, así que no aparecía nada. Se define en `src/styles.less` como un
  spinner de marca (24 px, respeta `prefers-reduced-motion`). Corrige de paso
  usos previos en `revenue` y `quick-schedule-widget`.
- **i18n (`es.json` / `en.json`)**: añadidas ~25 claves nuevas y traducidas en
  ambos idiomas (ver detalle por fase arriba).

---

## 2. Hallazgos que limitan el prototipo (no implementables sin backend)

| Prototipo | Estado | Motivo |
| --- | --- | --- |
| **Duplicar plan** (`plan-detalle.html`) | Fuera de alcance | No hay endpoint de clonado. Existen `copyDay` (por día) y `convertToTemplate`; un “duplicar” completo requiere backend. |
| **Kcal en el listado de planes** (`planes.html`) | No se pinta | `Menu` (`menu.model.ts`) no trae kcal; obtenerlo por fila sería un *fan-out* (`getNutrition` por menú). Las kcal se mantienen **a la vista y discretas** en el detalle, donde ya se calculan. |
| **Estado “Nuevo/Pausa/Alta”** (`planes.html`) | Reducido | `Menu` solo tiene `isActive`; los chips quedan en Todos/Activos/Inactivos. |
| **Comparativa de periodos / deltas** (`metricas.html`) | No | El DTO de métricas no trae periodo anterior (ya recogido en el gap analysis de la Fase 0). |
| **Exportar / Generar informe** (`metricas.html`, `planes.html`) | No | No hay endpoint de informes; sí se conserva la exportación PDF de menús (individual). |
| **Foto de perfil** (`configuracion.html`) | No | Sin campo ni endpoint de subida. `tuiAvatar` ya se usa donde hay imagen/iniciales. |
| **Páginas 404/500** | No | El router solo tiene `not-authorized`; el comodín redirige a `dashboard`. |

---

## 3. Guía paso a paso para verificarlo visualmente

### 3.0 Requisitos y arranque

```bash
# En la raíz del repo
npm install          # si hace falta
npm start            # ng serve → http://localhost:4200
```

La app redirige a **Keycloak**; necesitas credenciales de un tenant con datos.
Si no dispones de ellas y solo quieres revisar el aspecto, usa el **arnés
estático** del punto 3.7.

**Comprobaciones automáticas antes de mirar:**

```bash
npx ng build --configuration development   # debe terminar en verde
npx ng lint                                # "All files pass linting."
```

### 3.1 Fase 5.4 — Planes

1. **Dietas y Menús** (`/menus`):
   - Verifica título grande en Satoshi, subtítulo “N menus · N activos”.
   - Escribe en el buscador y observa que el listado y **los contadores de los
     chips** se actualizan (con el retardo de debounce de 300 ms).
   - Pulsa **Activos** / **Inactivos** y comprueba que el backend filtra (la
     paginación se resetea y el total cambia).
   - Abre el **menú kebab** de una fila: Ver detalle, Activar/Desactivar,
     Renombrar, Eliminar. Comprueba que “Ver detalle” navega.
   - Filtra por algo sin resultados → *empty state* “Sin resultados”.
   - Estrecha la ventana por debajo de `768px` → **tarjetas** clicables con
     acciones al pie.
2. **Detalle de un menú** (`/menus/:id`):
   - Comprueba: volver, título, descripción, badge de estado, interruptor,
     fecha y **kcal discretas** (texto plano, no badge).
   - Revisa que siguen ahí: Convertir en plantilla, Imprimir, Descargar PDF,
     Lista IA; y el grid con macros por comida.
3. **Plantillas** (`/templates`):
   - Misma cabecera/buscador/tabla sin tarjeta envolvente.
   - **Prueba de regresión**: pulsa **Crear plantilla** y **cancela** el
     diálogo → no debe aparecer ningún error en consola ni toast de éxito.
     Repite con **Importar**.
   - Abre el kebab: Ver detalle / Asignar a paciente / Eliminar.
4. **Listas de la compra** (`/shopping-lists`):
   - Título, recuento y tabla con importes en formato `1.234,56 €`.
   - Clic en una fila abre el diálogo de lista; comprueba que puedes editar,
     añadir y borrar productos y que “Copiar” funciona.

### 3.2 Fase 5.5 — Finanzas / Métricas

1. Abre `/revenue`.
2. Verifica la **cabecera** nueva (título grande + subtítulo).
3. Pestaña **Facturación**:
   - Cambia granularidad (Día/Semana/Mes/Trimestre) y los presets
     Mes/Trimestre/Año → la gráfica y la tabla de la serie deben refrescarse.
   - Conmutador **Gráfica / Tabla**.
   - Si eres ADMIN del centro, cambia de profesional en el combo.
   - Revisa KPI (facturación, consultas, ticket medio, pacientes) y los
     desgloses por profesional y tipo de cita.
4. Pestaña **Asistencia**: KPIs, gráfica con línea de objetivo, barra de
   resultados y desgloses (incluidas franjas horarias).
5. Cambia a **modo oscuro** (menú de usuario → tema) y comprueba que ejes,
   tooltips y barras siguen legibles (los colores se recalculan con el tema).

### 3.3 Fase 5.6 — Configuración y Admin

1. Abre `/settings`.
   - En escritorio: **nav lateral pegajoso** (Personalización, Tipos de cita,
     Horarios y festivos, Dirección). El elemento activo se resalta con tinte de
     marca.
   - Estrecha por debajo de `lg`: el nav pasa a **fila horizontal con scroll**.
2. **Personalización**: cambia el color primario con el selector y el campo hex
   → el resaltado de marca de toda la app debe actualizarse al guardar. Revisa
   los *dropzones* del logo web y del logo PDF.
3. **Tipos de cita**: crea, edita, marca por defecto y “borra” (desactiva) un
   tipo. Comprueba la tabla en escritorio y las tarjetas en móvil, y que la
   acción destructiva se ve en color de error.
4. **Horarios y festivos**: recorre las tres pestañas; crea una jornada, una
   asignación y un festivo. Comprueba que el tipo de festivo se ve como badge
   (`info` para nacional, neutro para local).
5. **Dirección**: país/provincia/ciudad y dirección; guarda.
6. **Admin** (`/admin`, requiere `adminGuard`): cabecera nueva, tabla de centros
   con punto de color de marca y badges ADMIN/Centro.

### 3.4 Fase 5.7 — Soporte

1. **Ayuda** (`/help`): título y subtítulo, buscador; escribe algo y comprueba:
   - Resultados filtrados dentro de las secciones acordeón.
   - Búsqueda sin resultados → estado vacío con botón “Borrar búsqueda”.
   - Abre un tema: contenido con pasos y enlace **“Ir a la aplicación”** que
     navega a la pantalla correspondiente.
2. **403** (`/not-authorized`): código 403 grande, mensaje y botón
   “Volver al inicio” que lleva a `/dashboard`.

### 3.5 Modo oscuro (transversal)

Con el conmutador de tema del menú de usuario, repasa: listados de planes y
plantillas, detalle de plan, `/revenue`, `/settings` (nav + formularios),
`/help` y la 403. Comprueba en particular:
- Texto y bordes de marca usan tintes claros (`primary-300`), nunca `primary-500/600`.
- Fondos de tarjeta y bordes vienen de `surface-*` / `line`, sin “tarjetas
  blancas” ni texto invisible.

### 3.6 Responsive

Con las DevTools a **375 px**, **900 px** y **1440 px**:
- Los listados pasan a tarjetas por debajo de `768px` y la tabla aparece por
  encima.
- El nav de `/settings` cambia de columna a fila.
- Las gráficas de `/revenue` mantienen proporción y los paneles se apilan.

### 3.7 Arnés estático (sin Keycloak)

Si no hay credenciales, se puede montar un HTML suelto que enlace el CSS
compilado para revisar los estilos sin sesión:

```bash
npx ng build --configuration development
# dist/sif-web/browser/styles-*.css contiene todo el CSS compilado
```

Abre un fichero en `design/` (p. ej. `design/planes.html`) y, en DevTools,
sustituye las variables por las de `src/styles.less`, o pega el HTML de la
pantalla real junto al `<link>` al CSS compilado. Es la técnica usada en fases
anteriores para revisar claro/oscuro.

> **Aviso de la Regla de Oro 2:** al revisar, recuerda que las opacidades
> (`/10`, `/40`) sobre colores `var()` **no compilan**. Los tintes de marca deben
> usar `bg-brand-tint-NN` / `border-brand-tint-NN`. El script del punto 3.8
> detecta estos no-ops.

### 3.8 Script de comprobación de clases (opcional)

Para asegurarse de que ninguna clase Tailwind usada en las plantillas nuevas se
compila “a la nada”, se puede pegar este script en un fichero temporal y
ejecutarlo tras un build; reporta toda clase que no aparezca en el CSS
compilado (salvo clases propias de componentes como `menu-table__*`).

```python
import re, glob, os

css = "".join(open(f, encoding='utf-8', errors='ignore').read()
              for f in glob.glob('dist/sif-web/browser/styles*.css'))
SPECIAL = set('[]()!.,:/%#&>*+~=@')
esc = lambda c: ''.join(('\\' + ch if ch in SPECIAL else ch) for ch in c)

for f in glob.glob('src/app/features/**/*.html', recursive=True):
    txt = open(f, encoding='utf-8').read()
    for m in re.finditer(r'class="([^"]*)"', txt):
        for c in m.group(1).split():
            if c and '{{' not in c and esc(c) not in css:
                print(f, c)
```

---

## 4. Archivos tocados en esta entrega

```
src/styles.less                                                  (+ .loading-spinner)
src/assets/i18n/es.json                                          (nuevas claves)
src/assets/i18n/en.json                                          (nuevas claves)

src/app/features/menus/menus-list.page.html                       (rediseño)
src/app/features/menus/menus-list.page.ts                         (filtro estado + i18n + RouterModule)
src/app/features/menus/menu-detail.page.html                      (cabecera + kcal discretas)
src/app/features/menus/menu-upload.dialog.html                    (tokens)
src/app/features/menus/menu-form.dialog.html                      (tokens)
src/app/features/menus/meal-form.dialog.html                      (tokens)
src/app/features/menus/shopping-list.dialog.html                  (tokens + título)
src/app/features/menus/components/meal-cell.html                  (text-err)
src/app/features/menus/components/meal-items-editor.html          (text-err)

src/app/features/templates/templates-list.page.html               (rediseño + kebab)
src/app/features/templates/templates-list.page.ts                 (cancelación + i18n + RouterModule)
src/app/features/templates/template-detail.page.html              (cabecera)
src/app/features/templates/template-upload.dialog.html            (warn-soft + tokens)
src/app/features/templates/template-form.dialog.html              (tokens)
src/app/features/templates/instantiate-template.dialog.html       (tokens)
src/app/features/templates/meal-template-form.dialog.html         (tokens)

src/app/features/shopping-lists/shopping-lists.page.html          (rediseño)
src/app/features/shopping-lists/shopping-lists.page.ts            (formato moneda)

src/app/features/revenue/revenue.page.html                        (cabecera)

src/app/features/settings/branding-settings.page.html             (maestro-detalle)
src/app/features/settings/branding-settings.page.ts               (quita TuiTabs)
src/app/features/settings/components/branding-settings.html       (cabecera + tokens)
src/app/features/settings/components/appointment-types-settings.html  (reescrito)
src/app/features/settings/components/schedule-settings.{html,ts}  (reescrito + TuiBadge)
src/app/features/settings/components/tenant-address-settings.html (cabecera + tokens)
src/app/features/settings/components/appointment-type-form.dialog.html (tabular-nums)
src/app/features/admin/admin-dashboard/admin-dashboard.component.html  (rediseño)
src/app/features/admin/create-tenant.dialog.html                  (tokens)

src/app/features/error/not-authorized/not-authorized.component.{html,ts}  (rediseño 403)
src/app/features/help/help.page.html                              (cabecera + tokens)
src/app/features/help/components/help-accordion.component.ts      (tokens + brand-tint)
src/app/features/help/components/help-search.component.ts         (tokens + a11y)
```

---

## 5. Correcciones posteriores (feedback de revisión)

Tres incidencias detectadas al revisar la Entrega 5.4–5.7, ya resueltas:

### 5.1 Descuadre del día y las comidas en el detalle del plan

**Síntoma:** en la rejilla semanal, la columna del día y las de comida/cena no
cuadraban con la cabecera.

**Causa (confirmada reproduciendo el componente en un arnés estático y en el
`/sandbox`):**
1. Las etiquetas de cabecera («Comida», «Cena») llevaban un **icono** delante
   (`fa-utensils`, `fa-moon`) que empujaba el texto ~28 px, mientras el cuerpo
   no tenía icono → el texto de la cabecera no caía sobre el del cuerpo.
2. La celda del día tenía un **icono de calendario** delante del nombre, que la
   cabecera «Día» no tenía → mismo desfase.
3. `.menu-table__day` aplicaba `display:flex` **directamente al `<td>`**, lo que
   lo saca del modelo de tabla y hacía su comportamiento frágil frente al
   `padding`/`vertical-align` que da el estilo global de `table[tuiTable]`.

**Solución:**
- Se quitan los iconos de la cabecera y del día (el prototipo tampoco los tiene):
  ahora «Día» cae exactamente sobre el nombre del día y «Comida»/«Cena» sobre el
  texto de cada pauta.
- Se mueve el `flex` a un wrapper interno: la celda pasa a ser
  `<td class="menu-table__day-cell"><div class="menu-table__day">…</div></td>`.
- Se elimina el bloque muerto que pintaba la cabecera en verde (el estilo global
  `table[tuiTable]` ya la pinta con el patrón de la Guía §6).

**Archivos:** `src/app/features/menus/_menu-table.scss`,
`src/app/features/menus/menu-detail.page.html`,
`src/app/features/templates/template-detail.page.html`.

### 5.2 Editar una pauta pulsándola (como el prototipo)

En el prototipo (`design/plan-detalle.html`) cada pauta es un `textarea`: pulsar
el texto ya te deja editarlo. En la app había que acertar en el icono del lápiz.

**Solución:** en modo lectura, el texto de la comida es ahora un `<button>`
(`button.menu-table__meal-text`) que emite `edit` al pulsarlo. Se conserva el
botón del lápiz para quien lo busque, y en modo BEDCA el mismo clic despliega el
editor de ingredientes (comportamiento `onEditMeal`). Al abrirse el `textarea`
recibe **foco automático** (`viewChild` + `effect` en `MealCell`; se descartó
`autofocus` por accesibilidad y porque el lint lo prohíbe).

**Archivos:** `src/app/features/menus/components/meal-cell.{html,ts}`,
`src/app/features/menus/_menu-table.scss`.

### 5.3 «Duplicar plan» en plantillas

El prototipo incluye **Duplicar**. El backend no expone un endpoint de clonado,
así que la copia se compone en el cliente con los endpoints existentes:
`getById` (trae la plantilla con sus comidas) + `create`.

- Nuevo método `MenuTemplateService.duplicate(tenantId, id, name?)`:
  - Si la comida tiene `items`, se envían y se omite `description` (el servidor
    la regenera); si no, se conserva el texto libre.
  - Nombre por defecto: `«{nombre} (copia)»`.
- Botón **Duplicar** (icono `fa-clone`) en el **kebab del listado**
  (`/templates`) y en la **cabecera del detalle** (`/templates/:id`), además de
  la acción en las tarjetas móviles. Tras duplicar, navega a la copia.
- Claves i18n nuevas: `templates.duplicate`, `templates.duplicate_success`,
  `templates.duplicate_name`.

**Archivos:** `src/app/core/api/services/menu-template.api.ts`,
`src/app/features/templates/templates-list.page.{html,ts}`,
`src/app/features/templates/template-detail.page.{html,ts}`,
`src/assets/i18n/{es,en}.json`.

### 5.4 Acceso del paciente al detalle desde `/menus`

En el listado de menús, la fila de la tabla no era clicable: había que abrir el
kebab de tres puntos y pulsar «Ver detalle», poco intuitivo y especialmente
confuso para el rol Paciente.

**Solución:** la `<tr>` de escritorio ahora navega con
`[routerLink]="['/menus', menu.id]"` y `cursor-pointer` (igual que en
plantillas). El botón del kebab detiene la propagación para no navegar al
abrirlo; el kebab sigue teniendo el resto de acciones.

**Archivos:** `src/app/features/menus/menus-list.page.html`.

### 5.5 Botones «kebab» (tres puntos) que no abrían

**Síntoma:** en ninguna tabla el botón de tres puntos desplegaba el menú.

**Causa (dos cosas, confirmadas en el navegador):**
1. En Taiga UI v5, `[tuiDropdown]` **por sí solo no abre con clic**: hace falta
   `tuiDropdownAuto` (o `[tuiDropdownOpen]`). Los kebabs solo tenían
   `[tuiDropdown]`, así que nunca se abrían — no era (solo) culpa del
   `stopPropagation`.
2. Al hacer navegable la fila se había puesto
   `(click)="$event.stopPropagation()"` en el `<button>` del kebab para que no
   navegara. Eso cortaba el burbujeo antes de llegar al contenedor del dropdown.

**Solución:** `tuiDropdownAuto` en el contenedor del dropdown, y el
`stopPropagation` se mueve al `<td>` que lo envuelve (la escucha del dropdown,
que va en el `<div>`, sí se dispara; después se corta la navegación de la fila).
La columna de acciones pasa a la **izquierda**: primera columna en menús y
plantillas, y segunda (tras el checkbox de selección) en pacientes, con
`tuiDropdownAlign="start"`.

**Archivos:** `src/app/features/menus/menus-list.page.html`,
`src/app/features/templates/templates-list.page.html`,
`src/app/features/patients/patients-list.page.html`.

### 5.6 Lista de la compra: campos recortados

**Síntoma:** al generar la lista, varios campos se veían cortados («Legumbres» a
medias, la unidad sin texto…).

**Causa:** las columnas fijas eran demasiado estrechas (5/6/8 rem) y las dos
columnas `auto` (Producto y Notas) acaparaban el ancho, dejando los `input` sin
espacio; encima `.field-inline` tenía padding y tamaño de fuente grandes.

**Solución:** anchos coherentes por columna (producto 12 rem, cantidad 6, unidad
7, categoría 11, precio 7, notas 10) y `.field-inline` más compacto (14 → 13 px,
padding horizontal 0.625 rem) con relleno `--sunken` para distinguirse de la
superficie del diálogo, pasando a `--surface` al enfocar.

**Archivos:** `src/app/features/menus/shopping-list.dialog.html`,
`src/styles.less`.

### 5.7 Texto de la comida centrado y lápiz sobrante

**Síntoma:** el texto de cada pauta salía centrado y seguía apareciendo el botón
del lápiz aunque pulsar la pauta ya abre la edición.

**Causa real (medida en el navegador):** los estilos `.menu-table__meal*` vivían
en `_menu-table.scss`, que es el ámbito de la **página**, pero esos elementos
están en el template del componente `MealCell`. La encapsulación de Angular
(scoped `_ngcontent`) impide que los selectores de la página alcancen el interior
del componente; el `<button>` conservaba su `text-align: center` por defecto.

**Solución:** hoja propia `components/meal-cell.scss` con esos estilos y
`styleUrl` en `MealCell`; `:host { display: block }`; `text-align: left`
explícito en el botón; y se retira el botón del lápiz (queda solo la papelera,
que aparece al pasar por la celda).

**Archivos:** `src/app/features/menus/components/meal-cell.{scss,ts,html}`,
`src/app/features/menus/_menu-table.scss`.

### 5.8 Modo oscuro: nombres de día ilegibles

**Síntoma:** en oscuro, la columna del día apenas se leía (texto oscuro sobre
fondo oscuro).

**Causa:** el override `:host-context(.dark) .menu-table__day { color:
var(--p-surface-0) }`. En oscuro `--p-surface-0` está mapeado al **canvas**
(`#1a1917`), no a blanco. El token neutro de la rampa ya se invierte solo:
`--p-surface-700` vale `#3a3631` en claro y `#e4e0d9` en oscuro.

**Solución:** se elimina el override (el color base ya adapta). De paso, la
vista previa de arrastre pasa de `--p-surface-0` a `--p-surface-50` y usa
`--shadow-float`, por el mismo motivo (en oscuro no se distinguía de la tarjeta).

**Archivos:** `src/app/features/menus/_menu-table.scss`,
`src/app/features/menus/menu-detail.page.scss`.

### 5.9 Listado de listas de la compra: icono redundante

La fila ya navega al detalle al pulsarla, así que el botón del ojo de la última
columna sobraba. Se quita esa columna (y el import ya innecesario de
`TuiButton` en la página).

**Archivos:** `src/app/features/shopping-lists/shopping-lists.page.{html,ts}`.

### 5.10 Equipo: kebab de acciones a la izquierda

La tabla de `/staff` usaba una columna de acciones centrada a la derecha con tres
botones sueltos (ojo, lápiz, revocar), a diferencia de la de pacientes. Se
homologa: kebab (`fa-ellipsis-vertical`) en la **primera columna**, con
`tuiDropdownAuto` + `stopPropagation` en el `<td>`, y la fila ahora navega a
`/staff/:id` (`cursor-pointer`). El menú ofrece «Ver detalle» (`common.view`),
«Editar» y «Revocar acceso» (estos dos con `*appIfPermission="'MANAGE_USER'"`).

**Archivos:** `src/app/features/staff/staff-list.page.{html,ts}`.

### 5.11 Equipo: página homologada con el resto de listados

La página de equipo se quedó con el patrón antiguo (`p-4` + `data-card`, cabecera
`text-2xl` sin contador, sin filtros, cabeceras de tabla sin orden, pie simple y
tarjeta móvil distinta). Se reescribe con el patrón estándar de listado
(menús/plantillas/pacientes):

- Cabecera con `font-display text-[26px]/lg:text-[32px]`, subtítulo
  `staff.count` + activos, y botón primario a la derecha (`lg:ml-auto`).
- Fila de filtros: buscador (`tui-textfield` + `tuiInput`) y chips de estado
  (`tui-segmented`), con contadores.
- Tabla en `table-wrapper` (sin `data-card`), **cabeceras ordenables** con las
  flechas y `aria-sort` como en las demás, celdas con los tonos neutros del
  sistema y el kebab en la primera columna.
- Tarjetas móviles y pie con `pagination_report` + anterior/siguiente.
- La búsqueda, el filtro por estado, el orden y la paginación se resuelven **en
  cliente** (el backend devuelve todos los miembros con `size: 1000`), así que no
  cambia ninguna llamada al API. El término de búsqueda se expone como signal
  (`toSignal`) para que los `computed` reaccionen — `FormControl.value` no es un
  signal.

**Archivos:** `src/app/features/staff/staff-list.page.{html,ts}`,
`src/assets/i18n/{es,en}.json`.

### Verificación de estas correcciones

- `ng build --configuration development` ✅ y `ng lint` ✅.
- Comprobación visual en `/sandbox` (componente real, servicios mockeados
  temporalmente y revertidos): grid cuadrada, clic sobre pauta abre el
  `textarea` con foco y alineado a la izquierda, los tres kebabs abren su menú
  desde la izquierda y sin navegar, y la lista de la compra muestra los campos
  completos. Ver el apartado 3.9.

### 3.9 Comprobación rápida de las correcciones

1. **Detalle de un plan** (`/menus/:id`): «Día» cae sobre el nombre del día y
   «Comida»/«Cena» sobre el texto de cada pauta; el texto va alineado a la
   izquierda y no hay botón de lápiz.
2. Pulsa **sobre el texto de una comida**: debe abrir el `textarea` en línea con
   el cursor dentro; guarda con Enter y cancela con Escape.
3. **Kebab (tres puntos)** en `/menus`, `/templates` y `/patients`: está a la
   izquierda, abre el menú al pulsarlo y **no** navega al detalle.
4. **Plantillas** (`/templates`): kebab → **Duplicar**; y en el detalle
   (`/templates/:id`) botón **Duplicar**. Comprueba que se crea «X (copia)» con
   las mismas comidas y que te lleva a la copia.
5. Entra como **paciente** en `/menus`: toca una fila y debe abrir el detalle sin
   pasar por el kebab.
6. **Lista de la compra** (detalle de un plan con IA activada → «Lista IA» →
   supermercado): los campos se ven completos y con relleno; revisa también el
   modo oscuro.
7. **Modo oscuro**: en el detalle de un plan los nombres de día se leen
   perfectamente (texto claro sobre la tarjeta).
8. **Listado de listas de la compra** (`/shopping-lists`): la tabla ya no lleva
   botón de ojo; pulsar una fila abre el detalle.
9. **Equipo** (`/staff`): el kebab de acciones está en la primera columna, abre
   el menú (Ver detalle / Editar / Revocar acceso) y la fila navega al detalle.
10. **Equipo, página completa**: la cabecera muestra el contador, hay buscador y
    chips de estado que filtran, y las cabeceras de la tabla ordenan con las
    flechas. Compara el aspecto con Pacientes: deben verse igual.

---

## 6. Siguiente paso

Con 5.4–5.7 cerradas, quedan únicamente:

- **Fase 6 — QA**: limpieza de CSS muerto, accesibilidad (teclado, contraste en
  oscuro, ARIA en diálogos) y consolidación de utilidades repetidas.
- **Fase 7 — Validación de integración**: despliegue con backend + Keycloak,
  verificación de rutas protegidas y PR a la rama principal.
