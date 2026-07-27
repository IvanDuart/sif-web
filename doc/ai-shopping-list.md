# AI Shopping List Generation

## Overview

Generates a shopping list from a menu using Google Gemini AI (gemini-2.0-flash).
All meals from the menu are sent to Gemini, which returns a consolidated shopping list
with estimated prices for the selected supermarket.

If a shopping list already exists for the same menu and user it is **overwritten**.

## Prerequisites

AI must be enabled and a Gemini API key must be configured for the tenant.
Both fields live inside `tenant.preferences` (JSONB column):

```http
PATCH /tenant/{tenantId}
Content-Type: application/json

{
  "preferences": {
    "ai_enabled": true,
    "gemini_api_key": "your-gemini-api-key"
  }
}
```

If `ai_enabled` is `false` or the key is missing, the endpoint returns 403 Forbidden
before any business logic runs (enforced at @PreAuthorize level via HasAccess.withAiEnabled).

All shopping list endpoints are unified under **`ShoppingListController`** (base path `/tenant/{tenantId}`).

## Endpoints

### GET — Retrieve shopping list by menu

```
GET /tenant/{tenantId}/menu/{id}/shopping-list
```

#### Required permission

VIEW_MENU on the tenant.

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| tenantId | UUID | Tenant identifier |
| id | UUID | Menu identifier |

#### Response

Returns the existing shopping list for the menu, or 404 if no list has been generated yet.

```json
{
  "id": "a1b2c3d4-...",
  "menuId": "7c9e6679-...",
  "appUserId": "f47ac10b-...",
  "name": "Shopping list - Menu semanal - Mercadona",
  "supermarket": "MERCADONA",
  "totalEstimatedPrice": 48.75,
  "aiModel": "gemini-2.0-flash",
  "createdAt": "2026-07-21T10:00:00Z",
  "items": [
    {
      "id": "b2c3d4e5-...",
      "name": "Pechuga de pollo",
      "quantity": 1.50,
      "unit": "kg",
      "category": "Carnes",
      "estimatedPrice": 8.50,
      "checked": false,
      "notes": "",
      "sortOrder": 0
    }
  ]
}
```

#### Error responses

| HTTP status | Condition |
|---|---|
| 404 Not Found | No shopping list found for the given menu |

---

### GET — List shopping lists for a user

```
GET /tenant/{tenantId}/user/{userId}/shopping-lists
```

#### Required permission

VIEW_MENU on the tenant (or self-access for the given userId).

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| tenantId | UUID | Tenant identifier |
| userId | UUID | User identifier |

#### Response

Returns all shopping lists for the user, ordered by creation date descending (newest first). Each list includes its items.

```json
[
  {
    "id": "a1b2c3d4-...",
    "menuId": "7c9e6679-...",
    "appUserId": "f47ac10b-...",
    "name": "Shopping list - Menu semanal - Mercadona",
    "supermarket": "MERCADONA",
    "totalEstimatedPrice": 48.75,
    "aiModel": "gemini-2.0-flash",
    "createdAt": "2026-07-21T10:00:00Z",
    "items": [
      {
        "id": "b2c3d4e5-...",
        "name": "Pechuga de pollo",
        "quantity": 1.50,
        "unit": "kg",
        "category": "Carnes",
        "estimatedPrice": 8.50,
        "checked": false,
        "notes": "",
        "sortOrder": 0
      }
    ]
  }
]
```

#### Error responses

| HTTP status | Condition |
|---|---|
| 403 Forbidden | Insufficient permissions |

---

### POST — Generate AI shopping list

```
POST /tenant/{tenantId}/menu/{id}/shopping-list/generate
```

#### Required permission

MANAGE_MENU on the tenant.

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| tenantId | UUID | Tenant identifier |
| id | UUID | Menu identifier |

#### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| supermarket | Supermarket | Yes | Target supermarket for price estimation |

**Available supermarket values:**

| Value | Display name |
|---|---|
| MERCADONA | Mercadona |
| CARREFOUR | Carrefour |
| LIDL | Lidl |
| ALCAMPO | Alcampo |
| DIA | Dia |
| EL_CORTE_INGLES | El Corte Ingles |
| ALDI | Aldi |
| EROSKI | Eroski |
| CONSUM | Consum |
| HIPERCOR | Hipercor |

**Example request:**

```http
POST /tenant/3fa85f64-5717-4562-b3fc-2c963f66afa6/menu/7c9e6679-7425-40de-944b-e07fc1f90ae7/shopping-list/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "supermarket": "MERCADONA"
}
```

#### Response

```json
{
  "id": "a1b2c3d4-...",
  "menuId": "7c9e6679-...",
  "appUserId": "f47ac10b-...",
  "name": "Shopping list - Menu semanal - Mercadona",
  "supermarket": "MERCADONA",
  "totalEstimatedPrice": 48.75,
  "aiModel": "gemini-2.0-flash",
  "createdAt": "2026-07-21T10:00:00Z",
  "items": [
    {
      "id": "b2c3d4e5-...",
      "name": "Pechuga de pollo",
      "quantity": 1.50,
      "unit": "kg",
      "category": "Carnes",
      "estimatedPrice": 8.50,
      "checked": false,
      "notes": "",
      "sortOrder": 0
    }
  ]
}
```

#### Error responses

| HTTP status | Condition |
|---|---|
| 403 Forbidden | AI not enabled for tenant, missing API key, or insufficient permissions |
| 404 Not Found | Tenant or menu not found |
| 500 Internal Server Error | Gemini call failed or response could not be parsed |

---

### PATCH — Update item checked status

```
PATCH /tenant/{tenantId}/shopping-list/{listId}/item/{itemId}
```

#### Required permission

VIEW_MENU on the tenant.

#### Path parameters

| Parameter | Type | Description |
|---|---|---|
| tenantId | UUID | Tenant identifier |
| listId | UUID | Shopping list identifier |
| itemId | UUID | Item identifier |

#### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| checked | Boolean | Yes | New checked status (`true` = purchased, `false` = pending) |

**Example request:**

```http
PATCH /tenant/3fa85f64-5717-4562-b3fc-2c963f66afa6/shopping-list/a1b2c3d4-4711-4562-b3fc-2c963f66afa6/item/b2c3d4e5-4811-4562-b3fc-2c963f66afa6
Authorization: Bearer <token>
Content-Type: application/json

{
  "checked": true
}
```

#### Response

Returns the updated item.

```json
{
  "id": "b2c3d4e5-...",
  "name": "Pechuga de pollo",
  "quantity": 1.50,
  "unit": "kg",
  "category": "Carnes",
  "estimatedPrice": 8.50,
  "checked": true,
  "notes": "",
  "sortOrder": 0
}
```

#### Error responses

| HTTP status | Condition |
|---|---|
| 403 Forbidden | Insufficient permissions |
| 404 Not Found | Shopping list or item not found |

## Behaviour

### Generation (POST)

- If an AI-generated shopping list already exists for the same menu and user it is **overwritten** — items are deleted and regenerated.
- The prompt includes all meals from the menu (day, meal type, description) so Gemini can consolidate ingredients.
- The language used in the generated list is Spanish (the meal descriptions are stored in the dietitian's language).
- The supermarket used for generation is persisted in shopping_list.supermarket.

### Retrieval (GET by menu)

- Returns the previously generated shopping list for a specific menu.
- Does **not** call Gemini — it only reads from the database.
- If no list has been generated yet, returns **404 Not Found**.

### List by user (GET)

- Returns all shopping lists for a user, newest first.
- Items are loaded eagerly in a single query (`JOIN FETCH`) to avoid N+1.
- Does **not** call Gemini.

### Update item status (PATCH)

- Toggles the `checked` field on a shopping list item.
- Validates that the item belongs to the specified list and tenant.
- Does **not** call Gemini.

## Architecture

All endpoints are served by the unified **`ShoppingListController`** (base `/tenant/{tenantId}`).

### POST — Generation

```
POST /tenant/{tenantId}/menu/{id}/shopping-list/generate
  @PreAuthorize: MANAGE_MENU + HasAccess.withAiEnabled(tenantId)  -> 403 if AI disabled
    -> ShoppingListService.generateFromMenu(tenantId, menuId, supermarket)
          -> TenantRepository.findById()          check ai_enabled + gemini_api_key
          -> MenuRepository.findById()             load menu with meals
          -> buildPrompt()                         compose Gemini prompt
          -> callGemini(apiKey, prompt)            Gemini API call with tenant key
          -> objectMapper.readValue()              parse JSON response
          -> ShoppingListRepository.save()         persist (overwrite if exists)
                + ShoppingListItemRepository.saveAll()
```

### GET — Retrieval by menu

```
GET /tenant/{tenantId}/menu/{id}/shopping-list
  @PreAuthorize: VIEW_MENU
    -> ShoppingListService.getByMenuId(tenantId, menuId)
          -> MenuRepository.findById()             validate menu belongs to tenant
          -> ShoppingListRepository.findByMenuId()  load existing shopping list
```

### GET — List by user

```
GET /tenant/{tenantId}/user/{userId}/shopping-lists
  @PreAuthorize: VIEW_MENU (or self)
    -> ShoppingListService.getShoppingListsByUser(tenantId, userId)
          -> ShoppingListRepository.findByTenantIdAndAppUserIdWithItems()
               (LEFT JOIN FETCH s.items, single query)
```

### PATCH — Update item status

```
PATCH /tenant/{tenantId}/shopping-list/{listId}/item/{itemId}
  @PreAuthorize: VIEW_MENU
    -> ShoppingListService.updateItemStatus(tenantId, listId, itemId, checked)
          -> ShoppingListItemRepository.findById()       load item
          -> validate item.shoppingList.id == listId     item belongs to list
          -> validate item.shoppingList.tenant.id == tenantId  tenant scope
          -> item.setChecked(checked) + save
```

## Relevant files

| File | Description |
|---|---|
| models/entity/Supermarket.java | Enum with supported supermarkets and display names |
| models/entity/ShoppingList.java | Entity — persists the generated list |
| models/entity/ShoppingListItem.java | Entity — one item per product (has `checked` field) |
| models/entity/TenantPreferences.java | Record — added ai_enabled and gemini_api_key fields |
| models/dto/ShoppingListDto.java | Response record (includes ShoppingListItemDto) |
| controller/dto/GenerateShoppingListRequest.java | Request record for AI generation |
| controller/dto/UpdateShoppingListItemRequest.java | Request record for item status update |
| controller/ShoppingListController.java | Unified controller — all shopping list endpoints |
| service/ShoppingListService.java | Business logic — prompt, Gemini, CRUD |
| security/HasAccess.java | withAiEnabled(tenantId) used in @PreAuthorize |
| repository/ShoppingListRepository.java | JPA repository for shopping lists |
| repository/ShoppingListItemRepository.java | JPA repository for shopping list items |
| db/migration/V17__shopping_list.sql | Creates shopping_list and shopping_list_item tables |
