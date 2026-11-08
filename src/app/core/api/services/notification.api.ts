import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationDto, NotificationPage } from '../models/notification.model';
import { DEFAULT_PAGE_SIZE } from '../models/page.model';
import { ConfigService } from '../../config/config.service';

/** Cabecera con el total de no leídas del buzón. */
export const UNREAD_COUNT_HEADER = 'X-Unread-Count';

/**
 * Buzón persistente de notificaciones del usuario autenticado.
 *
 * Complementa al canal SSE: lo emitido con la web cerrada queda aquí y se
 * puede recuperar paginado.
 */
@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.configService.apiUrl}/notifications`;
  }

  /**
   * Lista paginada del buzón.
   * `unreadOnly` filtra las pendientes; `unreadCount` cuenta todas, no la página.
   */
  list(
    unreadOnly = false,
    page = 0,
    size = DEFAULT_PAGE_SIZE,
    sort: string[] = ['createdAt,DESC']
  ): Observable<NotificationPage> {
    let params = new HttpParams()
      .set('unreadOnly', String(unreadOnly))
      .set('page', String(page))
      .set('size', String(size));
    sort.forEach((value) => (params = params.append('sort', value)));

    return this.http
      .get<NotificationPage['page']>(this.baseUrl, { params, observe: 'response' })
      .pipe(
        map((response: HttpResponse<NotificationPage['page']>) => ({
          page: response.body ?? { content: [], page: { size, number: page, totalElements: 0, totalPages: 0 } },
          unreadCount: Number(response.headers.get(UNREAD_COUNT_HEADER) ?? 0),
        }))
      );
  }

  /** Marca una notificación como leída y devuelve su estado actualizado. */
  markRead(id: string): Observable<NotificationDto> {
    return this.http.patch<NotificationDto>(`${this.baseUrl}/${id}/read`, {});
  }

  /** Solo el contador: pide una página mínima y lee `X-Unread-Count`. */
  unreadCount(): Observable<number> {
    return this.list(true, 0, 1).pipe(map((result) => result.unreadCount));
  }
}
