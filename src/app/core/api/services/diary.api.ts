import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdherenceDto, DiaryEntryDto, DiaryEntryRequest } from '../models/diary.model';
import { ConfigService } from '../../config/config.service';

/**
 * Diario alimentario y adherencia del paciente (`/tenant/{tenantId}/users/{userId}`).
 *
 * El registro admite JSON o `multipart/form-data` con la entrada `entry` y una
 * foto opcional en `photo`.
 */
@Injectable({ providedIn: 'root' })
export class DiaryService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string, userId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/users/${userId}`;
  }

  /** Registra o actualiza el estado de una comida planificada para la fecha. */
  register(
    tenantId: string,
    userId: string,
    date: string,
    request: DiaryEntryRequest
  ): Observable<DiaryEntryDto> {
    return this.http.post<DiaryEntryDto>(`${this.endpoint(tenantId, userId)}/diary/${date}`, request);
  }

  /**
   * Igual que `register`, pero en multipart para adjuntar la foto de la comida.
   * `entry` viaja como parte JSON y `photo` es opcional.
   */
  registerWithPhoto(
    tenantId: string,
    userId: string,
    date: string,
    request: DiaryEntryRequest,
    photo?: Blob | null
  ): Observable<DiaryEntryDto> {
    const form = new FormData();
    form.append('entry', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    if (photo) {
      form.append('photo', photo, photo instanceof File ? photo.name : 'meal-photo.jpg');
    }
    return this.http.post<DiaryEntryDto>(
      `${this.endpoint(tenantId, userId)}/diary/${date}`,
      form
    );
  }

  /** Diario cronológico del rango, con URLs prefirmadas de las fotos. */
  list(tenantId: string, userId: string, from?: string, to?: string): Observable<DiaryEntryDto[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<DiaryEntryDto[]>(`${this.endpoint(tenantId, userId)}/diary`, { params });
  }

  /** Tasa de adherencia del rango, con desglose por comida y por semana. */
  adherence(tenantId: string, userId: string, from?: string, to?: string): Observable<AdherenceDto> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<AdherenceDto>(`${this.endpoint(tenantId, userId)}/adherence`, { params });
  }
}
