# Fase 1 — Planificar mejor

> **Duración estimada:** 8-9 semanas con 1 backend dedicado.  
> **Objetivo:** dotar al producto de las capacidades de planificación dietética más avanzadas: intercambios/raciones, recetario gestionable, diario del paciente y adherencia, y un PDF de menú enriquecido.  
> **Entregable:** backend con soporte para intercambios (opcional por centro), CRUD de recetas, registro de diario/adherencia y PDF de menú mejorado.

---

## 1. Decisiones de producto aplicables en esta fase

- Intercambios: configurable por centro (`exchangeGroupsEnabled`, default `false`).
- Recetario: biblioteca propia del centro + importación CSV/JSON.
- Nutrientes: `HIDDEN` por defecto; respetar `nutrientDisplayMode` en todos los cálculos.

---

## 2. Prerrequisitos (deben venir de la Fase 0)

- T6 (enums `DayOfWeek`/`MealType`) cerrado.
- T3/T4 (errores y OpenAPI) estable como base.
- T21 (MinIO) operativo con `StorageService` reutilizable.
- P2 (toggle de nutrientes) funcional.
- Redis disponible.

---

## 3. Tareas

### T9 — Paginación en listados largos

**Problema:** Varios endpoints devuelven `List` sin límite; crecimiento sin control.

**Endpoints a paginar:**
- `GET /appointments/nutritionist/{id}`
- `GET /appointments/patient/{id}`
- `GET /calendar-notes`
- `GET /meal/menu/{menuId}` (comidas de un menú)
- `GET /menu/history`
- `GET /patients/{id}/events`
- `GET /user/{id}/shopping-lists`
- `GET /tenant/{id}/food/nutrient`

**Solución:**
- Usar `Page<T>` de Spring Data con `Pageable` (`page`, `size`, `sort`).
- Mantener respuesta `PagedModel` acorde al formato actual:
  ```json
  {
    "content": [...],
    "page": { "size": 20, "number": 0, "totalElements": 100, "totalPages": 5 }
  }
  ```

**Archivos a tocar:**
- Repositorios afectados.
- Servicios afectados.
- Controladores afectados.
- Tests y documentación OpenAPI.

**Criterios de aceptación:**
- [ ] Todos los listados anteriores soportan paginación.
- [ ] Se mantiene compatibilidad con clientes que no envíen parámetros (default size razonable, ej. 50).
- [ ] El frontend Flutter es informado de los cambios.

---

### T10 — ETag/`If-Match` en menús y comidas

**Problema:** Dos profesionales pueden editar el mismo menú/comida; el último gana.

**Solución:**
1. Añadir `@Version` a `Menu` y `Meal`.
2. En GET de menú/comida, devolver header `ETag` con la versión.
3. En PUT/PATCH, exigir header `If-Match` y devolver `409 Conflict` si no coincide.

**Archivos a tocar:**
- `models/entity/Menu.java`
- `models/entity/Meal.java`
- `service/MenuService.java`, `MealService.java`
- `controller/MenuController.java`, `MealController.java`
- Migración Flyway: columnas `version`.

**Criterios de aceptación:**
- [ ] GET devuelve `ETag`.
- [ ] PUT/PATCH sin `If-Match` o con versión obsoleta devuelve `409`.
- [ ] El frontend es capaz de manejar el conflicto (releer y reconciliar).

---

### T11 — `tenant.timezone` + hora de recordatorio

**Problema:** `AppointmentReminderService` se ejecuta a las 08:00 hora del servidor (`Europe/Madrid` o UTC), no hora local del centro.

**Solución:**
1. Añadir `timezone` y `reminderHour` (int 0-23) a `Tenant`.
2. Refactorizar el job para:
   - Agrupar citas por `tenant.timezone`.
   - Ejecutar envío cuando la hora local del tenant coincida con `reminderHour`.
3. Default: `Europe/Madrid`, hora 8.

**Archivos a tocar:**
- `models/entity/Tenant.java`
- `service/AppointmentReminderService.java`
- `controller/TenantProfileController.java` — actualizar perfil.
- Migración Flyway.

**Criterios de aceptación:**
- [ ] Cada centro recibe recordatorios a su hora local configurada.
- [ ] El job no depende de la zona horaria del servidor.
- [ ] Se manejan cambios de horario verano/invierno.

---

### T12 — `Idempotency-Key` en POST críticos

**Problema:** Reintentos desde la app móvil pueden duplicar citas, menús, mediciones o listas de compra.

**Solución:**
1. Implementar middleware/filtro que lea header `Idempotency-Key`.
2. Almacenar en Redis con TTL (ej. 24h): clave → respuesta ya calculada.
3. Aplicar a:
   - `POST /appointments`
   - `POST /menu`
   - `POST /meal`
   - `POST /tenant/{id}/users/{userId}/measurements`
   - `POST /menu/{id}/shopping-list/generate`

**Archivos a tocar:**
- Nuevo `config/IdempotencyConfig.java` o interceptor.
- Nuevo servicio/utilidad `IdempotencyService`.
- Controladores afectados.

**Criterios de aceptación:**
- [ ] Reenviar mismo `Idempotency-Key` devuelve la misma respuesta sin crear duplicados.
- [ ] Claves distintas crean recursos distintos.
- [ ] TTL limpia claves antiguas.

---

### T13 — Buzón de notificaciones + replay SSE

**Problema:** SSE es efímero; notificaciones perdidas si el cliente está offline.

**Solución:**
1. Crear tabla `notification` con:
   - `id`, `user_id`, `tenant_id`, `type`, `title`, `body`, `data` (JSON), `read_at`, `created_at`.
2. Cada vez que se envía una notificación push/SSE, persistirla.
3. Endpoint `GET /notifications` con paginación y filtro `unreadOnly`.
4. Endpoint `PATCH /notifications/{id}/read`.
5. SSE soporta `Last-Event-ID` para replay.
6. Usar Redis pub/sub para distribuir SSE en múltiples nodos.

**Archivos a tocar:**
- `models/entity/Notification.java` (nuevo)
- `repository/NotificationRepository.java` (nuevo)
- `service/NotificationService.java` (nuevo)
- `controller/NotificationController.java` (nuevo)
- `service/NotificationStreamService.java` — soporte `Last-Event-ID`.
- `service/PushNotificationService.java` — persistir al enviar.
- Migración Flyway.

**Criterios de aceptación:**
- [ ] Las notificaciones se persisten.
- [ ] `GET /notifications` devuelve historial paginado.
- [ ] `Last-Event-ID` permite recuperar eventos perdidos.
- [ ] Redis pub/sub distribuye SSE si hay varias instancias.

---

### P3 — Intercambios v1 + planificador por raciones

**Problema:** No hay soporte para planificación por raciones/intercambios.

**Solución:**
1. Preferencia `exchangeGroupsEnabled` (default `false`) en `TenantPreferences`.
2. Modelo de datos:
   - `exchange_group` (id, tenant_id, code, name, sort_order)
   - `exchange_equivalent` (id, group_id, food_id, rations_per_unit, household_measure, grams_per_ration)
3. Endpoints:
   - `GET /tenant/{id}/exchange-groups`
   - `GET /tenant/{id}/exchange-groups/{groupId}/equivalents`
   - `POST /tenant/{id}/exchange-groups/{groupId}/equivalents`
   - `PUT /tenant/{id}/meal/{mealId}/exchanges`
4. Lógica:
   - Un `Meal` puede tener `items` (gramos) y/o `exchanges` (raciones).
   - Al guardar intercambios, el sistema opcionalmente genera/actualiza `MealItem` en gramos.
   - Validar macros contra objetivos y devolver `warnings[]`.

**Archivos a tocar:**
- Nuevas entidades, repos, servicios, controladores.
- `models/entity/Meal.java` — relación con intercambios.
- `service/MealService.java` — guardado con intercambios.
- `service/MenuNutritionService.java` — cálculo nutricional teniendo en cuenta intercambios.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Se pueden definir grupos y equivalentes por centro.
- [ ] Se puede planificar una comida por raciones.
- [ ] El cálculo nutricional considera tanto `items` como intercambios.
- [ ] Si el centro no tiene habilitados intercambios, los endpoints no son visibles/operativos.

**Notas:**
- Mantener `MealItem` en gramos como capa de persistencia; los intercambios son capa de autoría.
- El planificador v1 puede ser una validación simple de macros; no es necesario un motor de optimización.

---

### P4 — Recetario CRUD + importación + recetas públicas

**Problema:** Existe `RecipeDto` en búsqueda de alimentos pero no hay CRUD ni biblioteca. Además, debe haber recetas públicas para todos los tenants y recetas particulares de cada centro.

**Solución:**
1. Modelo:
   - `recipe` (id, tenant_id nullable, scope, name, servings, allergens[], created_by, created_at)
   - `recipe_item` (id, recipe_id, food_id, quantity_g, sort_order)
   - `recipe_step` (id, recipe_id, order, text)
   - `recipe_household_measure` (id, recipe_id, label, grams)
   - `recipe_image` (id, recipe_id, stored_file_id, sort_order) — imagen principal y galería.
2. `scope`:
   - `PUBLIC`: receta de plataforma, visible para todos los tenants. `tenant_id = null`. Gestionada por superadmin con permiso `MANAGE_PUBLIC_RECIPES`.
   - `TENANT`: receta propia de un tenant. Visible y editable solo por ese tenant.
3. Recetas públicas:
   - Los tenants pueden **verlas e instanciarlas**, pero no modificarlas ni eliminarlas.
   - Endpoint `POST /tenant/{id}/recipes/{recipeId}/clone` para clonar una receta pública como receta `TENANT` propia y editable.
4. Imágenes y archivos de receta:
   - Se almacenan en **MinIO** usando el `StorageService` de T21.
   - Se sirven como URLs firmadas; no se guardan binarios en PostgreSQL.
5. Endpoints de tenant:
   - `GET /tenant/{id}/recipes` — devuelve recetas `TENANT` del centro + recetas `PUBLIC` (paginado, filtro por `scope`).
   - `POST /tenant/{id}/recipes` — crea receta `TENANT`.
   - `GET /tenant/{id}/recipes/{recipeId}` — permite ver propias y públicas.
   - `PUT /tenant/{id}/recipes/{recipeId}` — solo recetas `TENANT` del centro.
   - `DELETE /tenant/{id}/recipes/{recipeId}` — solo recetas `TENANT` del centro.
   - `POST /tenant/{id}/recipes/{recipeId}/clone` — clona pública (o propia) a receta `TENANT`.
   - `POST /tenant/{id}/recipes/import` — importación CSV/JSON crea recetas `TENANT`.
   - `POST /tenant/{id}/recipes/{recipeId}/instantiate` — vuelca la receta en una comida de menú.
6. Endpoints de plataforma (superadmin):
   - `GET /platform/recipes`
   - `POST /platform/recipes`
   - `PUT /platform/recipes/{recipeId}`
   - `DELETE /platform/recipes/{recipeId}`
   - `POST /platform/recipes/{recipeId}/publish` / `unpublish` (si se quiere separar borrador/publicada).
7. Alérgenos: array de strings o enum (definir catálogo).

**Archivos a tocar:**
- Nuevas entidades, repos, servicios, controladores.
- `service/MealService.java` — `instantiateRecipe`.
- `service/StorageService.java` — imágenes de receta (creado en T21).
- `controller/FoodController.java` — ajustar `RecipeDto` existente.
- Nuevo `controller/PlatformRecipeController.java` — CRUD de recetas públicas.
- Permisos nuevos: `MANAGE_RECIPES`, `MANAGE_PUBLIC_RECIPES`.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] CRUD completo de recetas propias del tenant.
- [ ] CRUD de recetas públicas por superadmin.
- [ ] `GET /tenant/{id}/recipes` devuelve propias + públicas.
- [ ] Una receta pública no puede editarse desde el tenant; solo clonarse.
- [ ] La clonación crea una receta `TENANT` editable.
- [ ] Las imágenes se almacenan en MinIO y se sirven por URL firmada.
- [ ] Instanciación en una comida real.
- [ ] Importación CSV/JSON básica.
- [ ] Cálculo nutricional por porción.

**Notas:**
- Las recetas públicas no pertenecen a ningún tenant; no deben aparecer en listados administrativos de un centro como si fueran propias.
- Al clonar, copiar ítems, pasos, medidas caseras y alérgenos; las imágenes pueden referenciarse o copiarse en MinIO según coste.
- Si un tenant elimina una receta clonada, la receta pública original no se ve afectada.

---

### P5 — Diario y adherencia v1

**Problema:** No hay registro diario del paciente ni medición de adherencia.

**Solución:**
1. Modelo:
   - `patient_diary_entry` (id, tenant_id, user_id, date, meal_id, status, stored_file_id nullable, notes, created_at)
   - `diary_entry_item` (id, entry_id, food_id, quantity_g, notes)
2. Status: `DONE | SWAPPED | SKIPPED | PARTIAL`.
3. Endpoints:
   - `POST /tenant/{id}/users/{userId}/diary/{date}`
   - `GET /tenant/{id}/users/{userId}/diary?from=&to=`
   - `GET /tenant/{id}/users/{userId}/adherence?from=&to=`
4. Adherencia: calculada como `loggedMeals / plannedMeals` por día/rango.
5. Fotos del diario: se almacenan en **MinIO** mediante `StorageService` (T21) y se sirven por URL firmada.

**Archivos a tocar:**
- Nuevas entidades, repos, servicios, controladores.
- `service/MealService.java` / `MenuService.java` — obtener comidas planificadas para una fecha.
- `service/StorageService.java` — fotos del diario.
- Migraciones Flyway.

**Criterios de aceptación:**
- [ ] Paciente puede registrar estado de cada comida.
- [ ] Staff puede ver diario y adherencia de sus pacientes.
- [ ] Adherencia se calcula correctamente por rango.
- [ ] Las fotos del diario se almacenan en MinIO y se sirven por URL firmada.

**Notas:**
- El diario puede iniciarse sin intercambios; basta comparar con las comidas del menú activo.

---

### P6 — PDF de menú enriquecido + almacenamiento en MinIO

**Problema:** El PDF actual no muestra ingredientes, medidas caseras ni alérgenos, y no hay almacén común para los PDFs generados.

**Solución:**
1. Enriquecer el servicio de generación de PDF para incluir:
   - Ingredientes de cada comida (de `MealItem`).
   - Medidas caseras (de recetas/alimentos).
   - Alérgenos.
   - Resumen nutricional (solo si `nutrientDisplayMode` lo permite).
2. Respetar `nutrientDisplayMode` del tenant.
3. Almacenar el PDF generado en **MinIO** mediante `StorageService` (T21) y devolver una URL firmada.
4. Registrar el archivo en `stored_file` con `entity_type = MENU_PDF` y `entity_id = menuId`.

**Archivos a tocar:**
- Servicio de generación de PDF (buscar clase que genere menú PDF).
- `models/dto/MenuNutritionDto.java`.
- `models/entity/Recipe.java` / `Food.java`.
- `service/StorageService.java` — subida del PDF.
- `controller/MenuController.java` — endpoint de descarga con URL firmada.

**Criterios de aceptación:**
- [ ] PDF incluye ingredientes y medidas caseras.
- [ ] Alérgenos visibles cuando existan.
- [ ] Nutrientes respetan el modo configurado por centro.
- [ ] El PDF se almacena en MinIO y se sirve por URL firmada.
- [ ] No se regenera el PDF si ya existe y el menú no ha cambiado (cache por versión).

---

## 4. Dependencias internas de la fase

```
T9, T10, T11  ->  mejoras transversales, pueden paralelizarse
T12, T13      ->  infraestructura, requieren Redis
P3            ->  requiere T6 (enums) y P2 (nutrientes)
P4            ->  requiere T21 (MinIO) para imágenes; P3 solo si se usa instantiate desde receta a comida (no obligatorio)
P5            ->  puede depender de P3 pero no es obligatorio
P6            ->  depende de P4 (recetas), T21 (MinIO) y P2 (nutrientes)
```

## 5. Checklist de cierre de fase

- [ ] Paginación implementada en listados críticos.
- [ ] ETag/`If-Match` funciona en menús y comidas.
- [ ] Recordatorios usan `tenant.timezone` y `reminderHour`.
- [ ] `Idempotency-Key` protege POST críticos.
- [ ] Buzón de notificaciones + replay SSE funcionan.
- [ ] Intercambios implementados y deshabilitables por centro.
- [ ] Recetario CRUD + importación + instanciación.
- [ ] Recetas públicas gestionadas por superadmin y clonables por tenants.
- [ ] Imágenes de recetas almacenadas en MinIO con URLs firmadas.
- [ ] Diario y adherencia v1 operativos, con fotos en MinIO.
- [ ] PDF de menú enriquecido y almacenado en MinIO.
- [ ] Tests pasan y aplicación compila.
- [ ] `doc/contrato-api/breaking-changes.md` actualizado.
