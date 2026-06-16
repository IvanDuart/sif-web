import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TenantBrandingDto } from '../models/branding.model';
import { TenantPreferences } from '../models/tenant.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TenantBrandingService {
  private readonly baseUrl = environment.apiBaseUrl;
  private http = inject(HttpClient);

  getBranding(tenantId: string): Observable<TenantBrandingDto> {
    return this.http.get<TenantBrandingDto>(`${this.baseUrl}/tenant/${tenantId}/branding`);
  }

  updatePreferences(tenantId: string, request: TenantPreferences): Observable<TenantPreferences> {
    return this.http.put<TenantPreferences>(`${this.baseUrl}/tenant/${tenantId}/branding/preferences`, request);
  }

  getLogo(tenantId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tenant/${tenantId}/branding/logo`, {
      responseType: 'blob'
    });
  }

  updateLogo(tenantId: string, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put<void>(`${this.baseUrl}/tenant/${tenantId}/branding/logo`, formData);
  }
}
