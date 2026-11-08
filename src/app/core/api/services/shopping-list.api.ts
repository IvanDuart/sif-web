import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ShoppingListDto, ShoppingListItemDto, GenerateShoppingListRequest, UpdateShoppingListItemRequest } from '../models/shopping-list.model';
import { DEFAULT_PAGE_SIZE, Page } from '../models/page.model';
import { idempotencyHeaders } from '../idempotency';
import { ConfigService } from '../../config/config.service';
import { IGNORE_NOT_FOUND } from '../../http/error.interceptor';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  /**
   * Genera la lista de la compra de un menú. Admite `Idempotency-Key` para que
   * un reintento no cree una segunda lista.
   */
  generateFromMenu(
    tenantId: string,
    menuId: string,
    request: GenerateShoppingListRequest,
    idempotencyKey?: string
  ): Observable<ShoppingListDto> {
    return this.http.post<ShoppingListDto>(
      `${this.baseUrl}/tenant/${tenantId}/menu/${menuId}/shopping-list/generate`,
      request,
      { headers: idempotencyHeaders(idempotencyKey) }
    );
  }

  getByMenuId(tenantId: string, menuId: string): Observable<ShoppingListDto> {
    return this.http.get<ShoppingListDto>(
      `${this.baseUrl}/tenant/${tenantId}/menu/${menuId}/shopping-list`,
      { context: new HttpContext().set(IGNORE_NOT_FOUND, true) }
    );
  }

  /**
   * Listas del paciente. El endpoint está paginado (`PagedModel`, 50 por
   * defecto) desde la Fase 1.
   */
  getByUserId(
    tenantId: string,
    userId: string,
    page = 0,
    size = DEFAULT_PAGE_SIZE,
    sort: string[] = ['createdAt,DESC']
  ): Observable<Page<ShoppingListDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(value => params = params.append('sort', value));

    return this.http.get<Page<ShoppingListDto>>(
      `${this.baseUrl}/tenant/${tenantId}/user/${userId}/shopping-lists`,
      { params }
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
