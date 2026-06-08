import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Meal } from '../models/meal.model';
import { Page } from '../models/page.model';
import { environment } from '../../../../environments/environment';

export interface CreateMealRequest {
  menuId?: string;
  dayOfWeek?: string;
  mealType?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class MealService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  search(
    tenantId: string,
    page: number = 0,
    size: number = 10,
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

  getByMenuId(tenantId: string, menuId: string): Observable<Meal[]> {
    return this.http.get<Meal[]>(`${this.baseUrl}/tenant/${tenantId}/meal/menu/${menuId}`);
  }
}
