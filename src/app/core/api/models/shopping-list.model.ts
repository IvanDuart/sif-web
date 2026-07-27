export interface ShoppingListItemDto {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimatedPrice: number;
  checked: boolean;
  notes: string;
  sortOrder: number;
}

export interface ShoppingListDto {
  id: string;
  menuId: string;
  appUserId: string;
  name: string;
  supermarket: string;
  totalEstimatedPrice: number;
  aiModel: string;
  createdAt: string;
  items: ShoppingListItemDto[];
}

export interface GenerateShoppingListRequest {
  supermarket: string;
}

export interface UpdateShoppingListItemRequest {
  checked: boolean;
}
