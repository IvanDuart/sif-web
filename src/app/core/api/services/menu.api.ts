import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Menu } from '../models/menu.model';
import { Page } from '../models/page.model';
import {ConfigService} from '../../config/config.service';

export interface CreateMenuRequest {
  appUserId?: string;
  name?: string;
  isActive?: boolean;
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

    return this.http.get<Page<Menu>>(`${this.baseUrl}/tenant/${tenantId}/menu`, { params });
  }

  create(tenantId: string, request: CreateMenuRequest): Observable<Menu> {
    return this.http.post<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu`, request);
  }

  getById(tenantId: string, id: string): Observable<Menu> {
    return this.http.get<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu/${id}`);
  }

  delete(tenantId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/menu/${id}`);
  }

  update(tenantId: string, id: string, request: { name?: string; isActive?: boolean }): Observable<Menu> {
    return this.http.patch<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu/${id}`, request);
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

    return this.http.get<Page<Menu>>(`${this.baseUrl}/tenant/${tenantId}/menu/user/${userId}`, { params });
  }

  history(tenantId: string, userId: string): Observable<Menu[]> {
    return this.http.get<Menu[]>(`${this.baseUrl}/tenant/${tenantId}/menu/history`, {
      params: { userId }
    });
  }

  getPdf(tenantId: string, id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tenant/${tenantId}/menu/${id}/pdf`, {
      responseType: 'blob'
    });
  }
}
