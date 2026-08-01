import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MenuTemplate, MealTemplate } from '../models/menu-template.model';
import { Menu } from '../models/menu.model';
import { Page } from '../models/page.model';
import {ConfigService} from '../../config/config.service';

export interface CreateMealTemplateRequest {
  dayOfWeek?: string;
  mealType?: string;
  description?: string;
}

export interface UpdateMealTemplateRequest {
  dayOfWeek: string;
  mealType: string;
  description: string;
}

export interface CreateMenuTemplateRequest {
  name?: string;
  description?: string;
  meals?: CreateMealTemplateRequest[];
}

export interface InstantiateMenuTemplateRequest {
  appUserId?: string;
  name?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MenuTemplateService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  search(
    tenantId: string,
    page = 0,
    size = 10,
    sort: string[] = ['name,ASC']
  ): Observable<Page<MenuTemplate>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(s => params = params.append('sort', s));

    return this.http.get<Page<MenuTemplate>>(`${this.baseUrl}/tenant/${tenantId}/menu-template`, { params });
  }

  create(tenantId: string, request: CreateMenuTemplateRequest): Observable<MenuTemplate> {
    return this.http.post<MenuTemplate>(`${this.baseUrl}/tenant/${tenantId}/menu-template`, request);
  }

  getById(tenantId: string, id: string): Observable<MenuTemplate> {
    return this.http.get<MenuTemplate>(`${this.baseUrl}/tenant/${tenantId}/menu-template/${id}`);
  }

  delete(tenantId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/menu-template/${id}`);
  }

  instantiate(tenantId: string, id: string, request: InstantiateMenuTemplateRequest): Observable<Menu> {
    return this.http.post<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu-template/${id}/instantiate`, request);
  }

  addMeal(tenantId: string, templateId: string, request: UpdateMealTemplateRequest): Observable<MealTemplate> {
    return this.http.post<MealTemplate>(`${this.baseUrl}/tenant/${tenantId}/menu-template/${templateId}/meals`, request);
  }

  updateMeal(tenantId: string, templateId: string, mealId: string, request: UpdateMealTemplateRequest): Observable<MealTemplate> {
    return this.http.put<MealTemplate>(`${this.baseUrl}/tenant/${tenantId}/menu-template/${templateId}/meals/${mealId}`, request);
  }

  deleteMeal(tenantId: string, templateId: string, mealId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/menu-template/${templateId}/meals/${mealId}`);
  }

  upload(tenantId: string, file: File, name?: string, description?: string): Observable<MenuTemplate> {
    const formData = new FormData();
    formData.append('file', file);

    let params = new HttpParams();
    if (name) params = params.set('name', name);
    if (description) params = params.set('description', description);

    return this.http.post<MenuTemplate>(
      `${this.baseUrl}/tenant/${tenantId}/menu-template/upload`,
      formData,
      { params }
    );
  }
}
