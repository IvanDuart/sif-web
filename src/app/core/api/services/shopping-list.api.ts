import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ShoppingListDto, ShoppingListItemDto, GenerateShoppingListRequest, UpdateShoppingListItemRequest } from '../models/shopping-list.model';
import { ConfigService } from '../../config/config.service';
import { IGNORE_NOT_FOUND } from '../../http/error.interceptor';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

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
      `${this.baseUrl}/tenant/${tenantId}/menu/${menuId}/shopping-list`,
      { context: new HttpContext().set(IGNORE_NOT_FOUND, true) }
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
