import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Menu } from '../models/menu.model';
import {ConfigService} from '../../config/config.service';

@Injectable({ providedIn: 'root' })
export class MenuUploadService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  uploadMenu(tenantId: string, userId: string, file: File): Observable<Menu> {
    const formData = new FormData();
    formData.append('file', file);
    
    const params = new HttpParams().set('userId', userId);

    return this.http.post<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu/upload`, formData, { params });
  }
}
