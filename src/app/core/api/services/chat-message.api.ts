import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ConfigService } from '../../config/config.service';
import { IGNORE_NOT_FOUND, SILENT_ERROR } from '../../http/error.interceptor';
import {
  ChatAttachmentDto,
  ChatMessageDto,
  ChatMessagePageDto,
} from '../models/chat.model';

export interface SendChatMessageRequest {
  /** Exactamente uno de `content` o `file`. */
  content?: string;
  file?: File;
}

@Injectable({ providedIn: 'root' })
export class ChatMessageService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string, threadId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/chat/threads/${threadId}/messages`;
  }

  /**
   * Sin `before` devuelve los últimos mensajes. `items` llega del más reciente
   * al más antiguo; para cargar antiguos se reenvía `nextCursor` como `before`.
   */
  list(
    tenantId: string,
    threadId: string,
    before?: string | null,
    limit = 30
  ): Observable<ChatMessagePageDto> {
    let params = new HttpParams().set('limit', String(limit));
    if (before) params = params.set('before', before);

    return this.http.get<ChatMessagePageDto>(this.endpoint(tenantId, threadId), { params });
  }

  /** Envía texto o una imagen (`multipart/form-data`, un único endpoint). */
  send(
    tenantId: string,
    threadId: string,
    request: SendChatMessageRequest
  ): Observable<ChatMessageDto> {
    const form = new FormData();
    if (request.file) {
      form.append('file', request.file, request.file.name);
    } else {
      form.append('content', (request.content ?? '').trim());
    }

    return this.http.post<ChatMessageDto>(this.endpoint(tenantId, threadId), form);
  }

  markRead(tenantId: string, threadId: string, lastReadMessageId: string): Observable<void> {
    // Un fallo al marcar leído no debe interrumpir la conversación con un toast.
    return this.http.patch<void>(
      `${this.baseUrl}/tenant/${tenantId}/chat/threads/${threadId}/read`,
      { lastReadMessageId },
      { context: new HttpContext().set(SILENT_ERROR, true) }
    );
  }

  /** Sólo el emisor puede borrar su mensaje; el borrado es lógico. */
  delete(tenantId: string, threadId: string, messageId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId, threadId)}/${messageId}`);
  }

  /** Renueva la URL firmada de un adjunto caducado. */
  refreshAttachmentUrl(tenantId: string, attachmentId: string): Observable<ChatAttachmentDto> {
    return this.http.get<ChatAttachmentDto>(
      `${this.baseUrl}/tenant/${tenantId}/chat/attachments/${attachmentId}/url`,
      {
        context: new HttpContext()
          .set(SILENT_ERROR, true)
          .set(IGNORE_NOT_FOUND, true),
      }
    );
  }
}
