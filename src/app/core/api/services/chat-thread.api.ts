import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ConfigService } from '../../config/config.service';
import { Page } from '../models/page.model';
import {
  ChatThreadDto,
  ChatThreadSummaryDto,
  CreateChatThreadRequest,
} from '../models/chat.model';

export interface ChatThreadQuery {
  /** `false` por defecto. */
  archived?: boolean;
  /** `false` por defecto. */
  unreadOnly?: boolean;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class ChatThreadService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/chat/threads`;
  }

  /** Sólo devuelve los hilos en los que participa el usuario autenticado. */
  list(tenantId: string, query: ChatThreadQuery = {}): Observable<Page<ChatThreadSummaryDto>> {
    const params = new HttpParams()
      .set('archived', String(query.archived ?? false))
      .set('unreadOnly', String(query.unreadOnly ?? false))
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? 20));

    return this.http.get<Page<ChatThreadSummaryDto>>(this.endpoint(tenantId), { params });
  }

  /**
   * Crea el hilo o devuelve el existente. El backend lo trata como idempotente
   * (mismo `(tenant, paciente, nutricionista)`), no como un 409.
   */
  create(tenantId: string, request: CreateChatThreadRequest): Observable<ChatThreadDto> {
    return this.http.post<ChatThreadDto>(this.endpoint(tenantId), request);
  }

  get(tenantId: string, threadId: string): Observable<ChatThreadDto> {
    return this.http.get<ChatThreadDto>(`${this.endpoint(tenantId)}/${threadId}`);
  }

  /** Archivar no borra mensajes: sólo oculta el hilo para el actor. */
  archive(tenantId: string, threadId: string, archived: boolean): Observable<void> {
    return this.http.patch<void>(`${this.endpoint(tenantId)}/${threadId}/archive`, { archived });
  }
}
