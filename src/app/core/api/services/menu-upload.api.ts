import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Menu } from '../models/menu.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MenuUploadService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  uploadMenu(tenantId: string, userId: string, file: File): Observable<Menu> {
    const formData = new FormData();
    formData.append('file', file);
    
    const params = new HttpParams().set('userId', userId);

    return this.http.post<Menu>(`${this.baseUrl}/tenant/${tenantId}/menu/upload`, formData, { params });
  }
}
