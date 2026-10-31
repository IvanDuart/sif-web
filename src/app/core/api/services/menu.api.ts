import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Menu } from '../models/menu.model';
import { Meal } from '../models/meal.model';
import { MenuNutritionDto } from '../models/food.model';
import { Page } from '../models/page.model';
import { normalizeMeal, normalizeMenu } from '../models/meal-normalizers';
import { toApiDayOfWeek } from '../models/meal-enums';
import {ConfigService} from '../../config/config.service';

export interface CreateMenuRequest {
  appUserId?: string;
  name?: string;
  isActive?: boolean;
}

export interface CopyDayRequest {
  from: string;
  to: string;
  /** `true` borra lo que hubiera en el destino; ausente o `false` añade. */
  overwrite?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  search(
    tenantId: string,
    page = 0,
    size = 10,
    sort: string[] = ['name,ASC'],
    userId?: string,
    name?: string,
    isActive?: boolean
  ): Observable<Page<Menu>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    sort.forEach(s => params = params.append('sort', s));
    
    if (userId) params = params.set('userId', userId);
    if (name) params = params.set('name', name);
    if (isActive !== undefined) params = params.set('isActive', String(isActive));

    return this.http.get<Page<Menu>>(`${this.baseUrl}/tenant/${tenantId}/menu`, { params }).pipe(
      map(page => ({ ...page, content: (page.content ?? []).map(normalizeMenu) }))
    );
  }

  create(tenantId: string, request: CreateMenuRequest): Observable<Menu> {
    return this.http.post<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu`, request).pipe(map(normalizeMenu));
  }

  getById(tenantId: string, id: string): Observable<Menu> {
    return this.http.get<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu/${id}`).pipe(map(normalizeMenu));
  }

  delete(tenantId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/menu/${id}`);
  }

  update(tenantId: string, id: string, request: { name?: string; isActive?: boolean; description?: string }): Observable<Menu> {
    return this.http.patch<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu/${id}`, request).pipe(map(normalizeMenu));
  }

  searchByUser(
    tenantId: string,
    userId: string,
    page = 0,
    size = 10,
    sort: string[] = ['createdAt,DESC']
  ): Observable<Page<Menu>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    sort.forEach(s => params = params.append('sort', s));

    return this.http.get<Page<Menu>>(`${this.baseUrl}/tenant/${tenantId}/menu/user/${userId}`, { params }).pipe(
      map(page => ({ ...page, content: (page.content ?? []).map(normalizeMenu) }))
    );
  }

  history(tenantId: string, userId: string): Observable<Menu[]> {
    return this.http.get<Menu[]>(`${this.baseUrl}/tenant/${tenantId}/menu/history`, {
      params: { userId }
    }).pipe(map(menus => menus.map(normalizeMenu)));
  }

  getPdf(tenantId: string, id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tenant/${tenantId}/menu/${id}/pdf`, {
      responseType: 'blob'
    });
  }

  /**
   * Totales nutricionales por comida, por día y del menú. Fuente de verdad:
   * usar al abrir el menú y tras guardar, nunca en cada tecla.
   */
  getNutrition(tenantId: string, id: string): Observable<MenuNutritionDto> {
    return this.http.get<MenuNutritionDto>(
      `${this.baseUrl}/tenant/${tenantId}/menu/${id}/nutrition`
    );
  }

  /** Clona las comidas de un día en otro. Devuelve solo las comidas creadas. */
  copyDay(tenantId: string, id: string, request: CopyDayRequest): Observable<Meal[]> {
    return this.http.post<Meal[]>(
      `${this.baseUrl}/tenant/${tenantId}/menu/${id}/copy-day`,
      {
        ...request,
        from: toApiDayOfWeek(request.from),
        to: toApiDayOfWeek(request.to),
      }
    ).pipe(map(meals => meals.map(normalizeMeal)));
  }
}
