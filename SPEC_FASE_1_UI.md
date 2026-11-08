# Especificación de UI — Nuevas Funcionalidades Fase 1 en sif-web

Los servicios y modelos API ya están implementados en `src/app/core/api/`. El objetivo de esta tarea es crear las interfaces de usuario (UI), componentes standalone, navegación y flujos correspondientes a la Fase 1.

## 1. Recetario (`/recipes`)
- **Rutas en `app.routes.ts`**:
  - `recipes`: `loadComponent` apuntando a `RecipesListPage`
  - `recipes/:id`: `loadComponent` apuntando a `RecipeDetailPage`
- **Catálogo (`recipes-list.page.ts`)**:
  - Filtro por tabs: "Todas", "Propias del centro" (`TENANT`), "Públicas" (`PUBLIC`).
  - Barra de búsqueda por nombre y paginación con `PagedModel`.
  - Tarjetas de receta con foto de portada (URL prefirmada), nombre, tiempo/porciones, alérgenos y badge (Pública / Propia).
  - Botón "Crear receta" (abre diálogo/formulario).
  - Botón "Importar recetas" (permite seleccionar archivo CSV o JSON y enviarlo a `RecipeApi.importRecipes`).
- **Detalle y Edición (`recipe-detail.page.ts` / `recipe-form.dialog.ts`)**:
  - Vista completa: lista de ingredientes (`quantityG`), pasos ordenados, medidas caseras y fotos.
  - Si la receta es `PUBLIC`: botón visible "Clonar a mi centro" (`RecipeApi.cloneRecipe`) que genera una copia `TENANT` editable. Deshabilitar edición y borrado directo.
  - Si la receta es `TENANT`: botones para editar campos, eliminar receta y botón para subir imágenes adicionales o de portada (`RecipeApi.uploadImage(file, cover)`).
  - Botón "Instanciar en comida": modal para seleccionar menú y comida y volcar los ingredientes con `RecipeApi.instantiateRecipe(mealId)`.
- **Navegación**:
  - Añadir ícono/enlace "Recetas" en la barra de navegación lateral en `src/app/layout/shell/shell.ts`.

## 2. Grupos de Intercambio y Planificador por Raciones
- **Configuración (`settings` o subpanel)**:
  - Si `tenant.preferences.exchangeGroupsEnabled` es `true`:
    - Sección para listar grupos de intercambio (`ExchangeGroup`) con su color y código.
    - CRUD de equivalencias por grupo (`ExchangeEquivalent`: alimento, medida casera, gramos por ración).
- **Planificador en Menús (`menu-detail.page.ts`)**:
  - Al editar una comida (`Meal`), si `exchangeGroupsEnabled` está activo:
    - Mostrar panel/pestaña de "Raciones e Intercambios" permitiendo asignar número de raciones por grupo.
    - Botón para sincronizar gramos (`syncItems=true`) llamando a `ExchangeApi.updateMealExchanges`.

## 3. Diario y Adherencia del Paciente
- **En la ficha de paciente (`user-detail.page.ts`)**:
  - Nueva pestaña/sección "Diario y Adherencia":
    - Selector de rango de fechas (desde / hasta).
    - Métricas: tasa de adherencia (`adherenceRate` en %), total de comidas planificadas vs registradas.
    - Calendario o lista de días mostrando las comidas registradas con su estado (`DONE`, `SWAPPED`, `SKIPPED`, `PARTIAL`), notas y miniatura de la foto si existe.
- **En el portal del paciente (`my-diet.page.ts`)**:
  - Sección "Diario de hoy": para cada comida del menú del día, botones rápidos para marcar estado (`DONE`, `SKIPPED`, etc.), campo de notas y opción de adjuntar fotografía.

## 4. Buzón de Notificaciones en Shell
- **En `src/app/layout/shell/shell.ts`**:
  - Ícono de campana en la barra superior/header con badge reactivo mostrando el total de no leídas (`unreadCount`).
  - Menú desplegable o diálogo lateral al pulsar:
    - Lista de notificaciones recientes con título, mensaje, fecha y estado de lectura.
    - Opción de marcar como leída (`NotificationApi.markAsRead`).
    - Enlace de "Marcar todas como leídas" o navegación al recurso asociado según `data`.

## 5. Control de Conflictos Concurrencia (409 / 428) en Menús
- En `menu-detail.page.ts`:
  - En las operaciones de guardado de menú o comida, capturar errores con los helpers `isVersionConflict` e `isPreconditionRequired` de `src/app/core/api/services/etag-store.ts`.
  - Si ocurre un 409: mostrar diálogo informativo indicando que el menú ha sido modificado por otro profesional, ofreciendo recargar la versión actual para no pisar cambios.

## 6. Validación de Calidad
- Ejecutar `tsc -p tsconfig.app.json --noEmit` y `ng build` para asegurar 0 errores de compilación TypeScript.
