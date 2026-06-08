import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MenuTemplate } from '../models/menu-template.model';
import { Menu } from '../models/menu.model';
import { Page } from '../models/page.model';
import { environment } from '../../../../environments/environment';

export interface CreateMealTemplateRequest {
  dayOfWeek?: string;
  mealType?: string;
  description?: string;
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
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  search(
    tenantId: string,
    page: number = 0,
    size: number = 10,
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
}
