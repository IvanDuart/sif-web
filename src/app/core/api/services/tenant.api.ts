import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tenant, TenantPreferences } from '../models/tenant.model';
import { Page } from '../models/page.model';
import {ConfigService} from '../../config/config.service';

export interface CreateTenantRequest {
  name: string;
  cif?: string;
  address?: string;
  phone?: string;
  countryCode?: string;
  stateCode?: string;
  city?: string;
  preferences?: TenantPreferences;
}

export interface UpdateTenantRequest {
  name?: string;
  cif?: string;
  address?: string;
  phone?: string;
  countryCode?: string;
  stateCode?: string;
  city?: string;
  preferences?: TenantPreferences;
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.configService.apiUrl}/tenants`;
  }

  private get profileUrl(): string {
    return this.configService.apiUrl;
  }

  search(page = 0, size = 10, sort: string[] = ['name,ASC']): Observable<Page<Tenant>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(s => params = params.append('sort', s));

    return this.http.get<Page<Tenant>>(this.baseUrl, { params });
  }

  create(request: CreateTenantRequest): Observable<Tenant> {
    return this.http.post<Tenant>(this.baseUrl, request);
  }

  getById(id: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.baseUrl}/${id}`);
  }

  update(id: string, request: UpdateTenantRequest): Observable<Tenant> {
    return this.http.put<Tenant>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getProfile(tenantId: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.profileUrl}/tenant/${tenantId}/profile`);
  }

  updateProfile(tenantId: string, request: UpdateTenantRequest): Observable<Tenant> {
    return this.http.put<Tenant>(`${this.profileUrl}/tenant/${tenantId}/profile`, request);
  }
}
