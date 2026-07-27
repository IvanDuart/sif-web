import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ShoppingListDto, ShoppingListItemDto, GenerateShoppingListRequest, UpdateShoppingListItemRequest } from '../models/shopping-list.model';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);

  generateFromMenu(
    tenantId: string,
    menuId: string,
    request: GenerateShoppingListRequest
  ): Observable<ShoppingListDto> {
    return this.http.post<ShoppingListDto>(
      `${this.baseUrl}/tenant/${tenantId}/menu/${menuId}/shopping-list/generate`,
      request
    );
  }

  getByMenuId(tenantId: string, menuId: string): Observable<ShoppingListDto> {
    return this.http.get<ShoppingListDto>(
      `${this.baseUrl}/tenant/${tenantId}/menu/${menuId}/shopping-list`
    );
  }

  getByUserId(tenantId: string, userId: string): Observable<ShoppingListDto[]> {
    return this.http.get<ShoppingListDto[]>(
      `${this.baseUrl}/tenant/${tenantId}/user/${userId}/shopping-lists`
    );
  }

  updateItemStatus(
    tenantId: string,
    listId: string,
    itemId: string,
    request: UpdateShoppingListItemRequest
  ): Observable<ShoppingListItemDto> {
    return this.http.patch<ShoppingListItemDto>(
      `${this.baseUrl}/tenant/${tenantId}/shopping-list/${listId}/item/${itemId}`,
      request
    );
  }
}
