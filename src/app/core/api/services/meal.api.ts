import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Meal, MealItem } from '../models/meal.model';
import { Page } from '../models/page.model';
import {ConfigService} from '../../config/config.service';

export interface MealItemRequest {
  foodId: string;
  /** Gramos de porción comestible, > 0. */
  quantityG: number;
  notes?: string | null;
  /** Si va null, el servidor usa la posición en el array. */
  sortOrder?: number | null;
}

export interface CreateMealRequest {
  menuId?: string;
  dayOfWeek?: string;
  mealType?: string;
  /** Obligatoria si no se mandan `items`. Sin ninguna de las dos → 400. */
  description?: string;
  items?: MealItemRequest[];
}

/**
 * Todos los campos son opcionales: lo que no se manda no se toca. Dos avisos:
 * - `items` **reemplaza la lista completa**, así que siempre va entera.
 * - si se mandan `items`, no mandar `description`: el servidor la regenera y
 *   sobrescribiría el texto enviado.
 */
export interface UpdateMealRequest {
  description?: string;
  items?: MealItemRequest[];
  dayOfWeek?: string;
  mealType?: string;
}

/**
 * Convierte los ítems que devuelve el servidor en ítems de petición. El
 * `sortOrder` se recalcula desde la posición: es lo que hace falta tanto al
 * reordenar como al copiar una comida a otro sitio.
 */
export function toMealItemRequests(items: readonly MealItem[]): MealItemRequest[] {
  return items.map((item, index) => ({
    foodId: item.food.id,
    quantityG: item.quantityG,
    notes: item.notes ?? null,
    sortOrder: index,
  }));
}

@Injectable({ providedIn: 'root' })
export class MealService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  search(
    tenantId: string,
    page = 0,
    size = 10,
    sort: string[] = ['dayOfWeek,ASC'],
    menuId?: string,
    dayOfWeek?: string,
    mealType?: string
  ): Observable<Page<Meal>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    sort.forEach(s => params = params.append('sort', s));
    
    if (menuId) params = params.set('menuId', menuId);
    if (dayOfWeek) params = params.set('dayOfWeek', dayOfWeek);
    if (mealType) params = params.set('mealType', mealType);

    return this.http.get<Page<Meal>>(`${this.baseUrl}/tenant/${tenantId}/meal`, { params });
  }

  create(tenantId: string, request: CreateMealRequest): Observable<Meal> {
    return this.http.post<Meal>(`${this.baseUrl}/tenant/${tenantId}/meal`, request);
  }

  getById(tenantId: string, id: string): Observable<Meal> {
    return this.http.get<Meal>(`${this.baseUrl}/tenant/${tenantId}/meal/${id}`);
  }

  delete(tenantId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/meal/${id}`);
  }

  update(tenantId: string, id: string, request: UpdateMealRequest): Observable<Meal> {
    return this.http.put<Meal>(`${this.baseUrl}/tenant/${tenantId}/meal/${id}`, request);
  }

  getByMenuId(tenantId: string, menuId: string): Observable<Meal[]> {
    return this.http.get<Meal[]>(`${this.baseUrl}/tenant/${tenantId}/meal/menu/${menuId}`);
  }
}
