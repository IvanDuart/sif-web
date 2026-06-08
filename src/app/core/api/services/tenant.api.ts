import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tenant, TenantPreferences } from '../models/tenant.model';
import { Page } from '../models/page.model';
import { environment } from '../../../../environments/environment';

export interface CreateTenantRequest {
  name: string;
  cif?: string;
  preferences?: TenantPreferences;
}

export interface UpdateTenantRequest {
  name?: string;
  cif?: string;
  preferences?: TenantPreferences;
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tenants`;

  constructor(private http: HttpClient) {}

  search(page: number = 0, size: number = 10, sort: string[] = ['name,ASC']): Observable<Page<Tenant>> {
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
}
