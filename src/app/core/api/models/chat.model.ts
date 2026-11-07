/** Chat 1:1 paciente ↔ nutricionista (`doc/contrato-api/chat/chat-frontend.md`). */

export type ChatMessageKind = 'TEXT' | 'IMAGE';

/** Participante tal y como lo devuelve el backend (sólo nombre y apellidos). */
export interface ChatParticipantDto {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ChatMessagePreviewDto {
  id: string;
  kind: ChatMessageKind;
  preview: string | null;
  senderId: string;
  createdAt: string;
}

export interface ChatThreadDto {
  id: string;
  patient: ChatParticipantDto;
  nutritionist: ChatParticipantDto;
  lastMessage: ChatMessagePreviewDto | null;
  lastMessageAt: string | null;
  unreadCount: number;
  archived: boolean;
}

/** El backend expone el mismo objeto para lista y detalle. */
export type ChatThreadSummaryDto = ChatThreadDto;

export interface ChatAttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** URL firmada de MinIO. Caduca en `urlExpiresAt` (TTL ~10 min). */
  url: string;
  urlExpiresAt: string;
}

export interface ChatMessageDto {
  id: string;
  threadId: string;
  senderId: string;
  kind: ChatMessageKind;
  content: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  attachment: ChatAttachmentDto | null;
}

export interface ChatMessagePageDto {
  /** Del más reciente al más antiguo. */
  items: ChatMessageDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreateChatThreadRequest {
  /** Obligatorio para profesionales (`MANAGE_CHAT`). */
  patientId?: string | null;
  /** Sólo se usa del lado del paciente. */
  nutritionistId?: string | null;
}

export interface MarkChatReadRequest {
  lastReadMessageId: string;
}

export interface ArchiveChatThreadRequest {
  archived: boolean;
}

/** Eventos del stream SSE del hilo (`GET .../threads/{id}/stream`). */
export type ChatStreamEvent =
  | { type: 'connected'; threadId: string }
  | { type: 'message'; message: ChatMessageDto }
  | { type: 'message-deleted'; messageId: string; threadId: string }
  | { type: 'read'; userId: string; lastReadMessageId: string; readAt: string };
