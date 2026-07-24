import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ShoppingListDto, GenerateShoppingListRequest } from '../models/shopping-list.model';

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
}
