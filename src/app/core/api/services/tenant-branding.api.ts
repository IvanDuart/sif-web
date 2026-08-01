import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TenantBrandingDto } from '../models/branding.model';
import { TenantPreferences } from '../models/tenant.model';
import {ConfigService} from '../../config/config.service';

@Injectable({ providedIn: 'root' })
export class TenantBrandingService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

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
    formData.append('file', file, file.name);
    return this.http.put<void>(`${this.baseUrl}/tenant/${tenantId}/branding/logo`, formData);
  }

  getLogoPdf(tenantId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tenant/${tenantId}/branding/logo-pdf`, {
      responseType: 'blob'
    });
  }

  updateLogoPdf(tenantId: string, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.put<void>(`${this.baseUrl}/tenant/${tenantId}/branding/logo-pdf`, formData);
  }
}
