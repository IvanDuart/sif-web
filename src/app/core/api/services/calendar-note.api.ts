import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CalendarNoteDto,
  CalendarNoteType,
  CreateCalendarNoteRequest,
  UpdateCalendarNoteRequest,
} from '../models/calendar-note.model';
import { ConfigService } from '../../config/config.service';

@Injectable({ providedIn: 'root' })
export class CalendarNoteService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  /**
   * Devuelve **solo las entradas propias**, ordenadas por `startTime` ascendente
   * y sin paginar.
   *
   * El filtro es por **solapamiento, no por contención** (`endTime > from AND
   * startTime < to`), así que el resultado desborda el rango pedido: unas
   * vacaciones del 28/oct al 5/nov salen al pedir noviembre. Hay que recortar
   * en cliente al rango visible en lugar de asumir que `startTime` cae dentro.
   */
  list(tenantId: string, from?: string, to?: string, type?: CalendarNoteType): Observable<CalendarNoteDto[]> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    if (type) params['type'] = type;
    return this.http.get<CalendarNoteDto[]>(`${this.baseUrl}/tenant/${tenantId}/calendar-notes`, { params });
  }

  getById(tenantId: string, noteId: string): Observable<CalendarNoteDto> {
    return this.http.get<CalendarNoteDto>(`${this.baseUrl}/tenant/${tenantId}/calendar-notes/${noteId}`);
  }

  create(tenantId: string, request: CreateCalendarNoteRequest): Observable<CalendarNoteDto> {
    return this.http.post<CalendarNoteDto>(`${this.baseUrl}/tenant/${tenantId}/calendar-notes`, request);
  }

  update(tenantId: string, noteId: string, request: UpdateCalendarNoteRequest): Observable<CalendarNoteDto> {
    return this.http.put<CalendarNoteDto>(`${this.baseUrl}/tenant/${tenantId}/calendar-notes/${noteId}`, request);
  }

  /** Borrado **físico**, no lógico: no hay papelera ni restauración. */
  delete(tenantId: string, noteId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/calendar-notes/${noteId}`);
  }
}
