import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import Keycloak from 'keycloak-js';

import { ConfigService } from '../../config/config.service';
import { ChatMessageDto, ChatStreamEvent } from '../models/chat.model';
import { sseStream } from './sse-stream';

export interface ChatStreamOptions {
  /** `true` al abrir o reabrir el stream, `false` al perderlo. */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Stream SSE de un hilo de chat. Usa el helper compartido `sseStream`, que
 * renueva el JWT en cada intento: el backend cierra la conexión a los 30 min y
 * para entonces el token puede haber caducado.
 *
 * No hay replay de eventos: al reconectar hay que recargar la primera página
 * de mensajes por REST (ver `ChatConversationPage`).
 */
@Injectable({ providedIn: 'root' })
export class ChatStreamService {
  private readonly keycloak = inject(Keycloak);
  private readonly configService = inject(ConfigService);

  streamThread(
    tenantId: string,
    threadId: string,
    options: ChatStreamOptions = {}
  ): Observable<ChatStreamEvent> {
    return sseStream<ChatStreamEvent>({
      url: `${this.configService.apiUrl}/tenant/${tenantId}/chat/threads/${threadId}/stream`,
      keycloak: this.keycloak,
      label: 'chat-stream',
      parse: (message) => toChatStreamEvent(message, threadId),
      onConnectionChange: options.onConnectionChange,
    });
  }
}

/** Traduce un mensaje SSE al evento tipado, o `null` si no interesa. */
function toChatStreamEvent(
  message: EventSourceMessage,
  threadId: string
): ChatStreamEvent | null {
  if (!message.data) return null;

  try {
    switch (message.event) {
      case 'connected':
        return { type: 'connected', threadId };
      case 'message':
        return { type: 'message', message: JSON.parse(message.data) as ChatMessageDto };
      case 'message-deleted': {
        const payload = JSON.parse(message.data) as { messageId: string; threadId?: string };
        return { type: 'message-deleted', messageId: payload.messageId, threadId: payload.threadId ?? threadId };
      }
      case 'read': {
        const payload = JSON.parse(message.data) as {
          userId: string;
          lastReadMessageId: string;
          readAt: string;
        };
        return {
          type: 'read',
          userId: payload.userId,
          lastReadMessageId: payload.lastReadMessageId,
          readAt: payload.readAt,
        };
      }
      default:
        return null;
    }
  } catch (error) {
    // Nunca volcar `message.data`: un mensaje con imagen lleva una URL firmada.
    console.error('[chat-stream] payload SSE inválido en el evento', message.event, error);
    return null;
  }
}
