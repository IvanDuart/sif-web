import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CalendarNoteDto,
  CalendarNoteType,
  CreateCalendarNoteRequest,
  UpdateCalendarNoteRequest,
} from '../models/calendar-note.model';
import { DEFAULT_PAGE_SIZE, Page } from '../models/page.model';
import { ConfigService } from '../../config/config.service';

@Injectable({ providedIn: 'root' })
export class CalendarNoteService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  /**
   * Devuelve **solo las entradas propias** del autor, ordenadas por `startTime`
   * ascendente.
   *
   * Dos matices que vienen del backend:
   * - El filtro es por **solapamiento, no por contención** (`endTime > from AND
   *   startTime < to`), así que el resultado desborda el rango pedido: unas
   *   vacaciones del 28/oct al 5/nov salen al pedir noviembre. Hay que recortar
   *   en cliente al rango visible en lugar de asumir que `startTime` cae dentro.
   * - El listado está paginado (`PagedModel`, 50 por defecto): si el rango
   *   tiene más entradas hay que pedir páginas adicionales.
   */
  list(
    tenantId: string,
    from?: string,
    to?: string,
    type?: CalendarNoteType,
    page = 0,
    size = DEFAULT_PAGE_SIZE,
    sort: string[] = ['startTime,ASC']
  ): Observable<Page<CalendarNoteDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(value => params = params.append('sort', value));
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (type) params = params.set('type', type);

    return this.http.get<Page<CalendarNoteDto>>(
      `${this.baseUrl}/tenant/${tenantId}/calendar-notes`,
      { params }
    );
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
