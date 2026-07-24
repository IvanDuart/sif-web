# AI Shopping List Generation

## Overview

Generates a shopping list from a menu using Google Gemini AI (gemini-2.0-flash).
All meals from the menu are sent to Gemini, which returns a consolidated shopping list
with estimated prices for the selected supermarket.

If a shopping list already exists for the same menu and user it is **overwritten**.

## Prerequisites

AI must be enabled and a Gemini API key must be configured for the tenant.
Both fields live inside 	enant.preferences (JSONB column):

`http
PATCH /tenant/{tenantId}
Content-Type: application/json

{
  "preferences": {
    "ai_enabled": true,
    "gemini_api_key": "your-gemini-api-key"
  }
}
`

If i_enabled is alse or the key is missing, the endpoint returns 403 Forbidden
before any business logic runs (enforced at @PreAuthorize level via HasAccess.withAiEnabled).

## Endpoint

`
POST /tenant/{tenantId}/menu/{id}/shopping-list/generate
`

### Required permission

MANAGE_MENU on the tenant.

### Path parameters

| Parameter | Type | Description |
|---|---|---|
| 	enantId | UUID | Tenant identifier |
| id | UUID | Menu identifier |

### Request body

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
| DIA | Día |
| EL_CORTE_INGLES | El Corte Inglés |
| ALDI | Aldi |
| EROSKI | Eroski |
| CONSUM | Consum |
| HIPERCOR | Hipercor |

**Example request:**

`http
POST /tenant/3fa85f64-5717-4562-b3fc-2c963f66afa6/menu/7c9e6679-7425-40de-944b-e07fc1f90ae7/shopping-list/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "supermarket": "MERCADONA"
}
`

### Response

`json
{
  "id": "a1b2c3d4-...",
  "menuId": "7c9e6679-...",
  "appUserId": "f47ac10b-...",
  "name": "Shopping list - Menú semanal - Mercadona",
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
`

### Error responses

| HTTP status | Condition |
|---|---|
| 403 Forbidden | AI not enabled for tenant, missing API key, or insufficient permissions |
| 404 Not Found | Tenant or menu not found |
| 500 Internal Server Error | Gemini call failed or response could not be parsed |

## Behaviour

- If an AI-generated shopping list already exists for the same menu and user it is **overwritten** — items are deleted and regenerated.
- The prompt includes all meals from the menu (day, meal type, description) so Gemini can consolidate ingredients.
- The language used in the generated list is Spanish (the meal descriptions are stored in the dietitian's language).
- The supermarket used for generation is persisted in shopping_list.supermarket.

## Architecture

`
POST /tenant/{tenantId}/menu/{id}/shopping-list/generate
  @PreAuthorize: MANAGE_MENU + HasAccess.withAiEnabled(tenantId)  ← 403 if AI disabled
    └── ShoppingListService.generateFromMenu(tenantId, menuId, supermarket)
          ├── TenantRepository.findById()          check ai_enabled + gemini_api_key
          ├── MenuRepository.findById()             load menu with meals
          ├── buildPrompt()                         compose Gemini prompt
          ├── callGemini(apiKey, prompt)            Gemini API call with tenant key
          ├── objectMapper.readValue()              parse JSON response
          └── ShoppingListRepository.save()         persist (overwrite if exists)
                + ShoppingListItemRepository.saveAll()
`

## Relevant files

| File | Description |
|---|---|
| models/entity/Supermarket.java | Enum with supported supermarkets and display names |
| models/entity/ShoppingList.java | Entity — persists the generated list |
| models/entity/ShoppingListItem.java | Entity — one item per product |
| models/entity/TenantPreferences.java | Record — added i_enabled and gemini_api_key fields |
| models/dto/ShoppingListDto.java | Response record |
| controller/dto/GenerateShoppingListRequest.java | Request record |
| service/ShoppingListService.java | Business logic — prompt building, Gemini call, persistence |
| security/HasAccess.java | Added withAiEnabled(tenantId) used in @PreAuthorize |
| controller/MenuController.java | Added POST /{id}/shopping-list/generate endpoint |
| epository/ShoppingListRepository.java | JPA repository for shopping lists |
| epository/ShoppingListItemRepository.java | JPA repository for shopping list items |
| db/migration/V17__shopping_list.sql | Creates shopping_list and shopping_list_item tables |