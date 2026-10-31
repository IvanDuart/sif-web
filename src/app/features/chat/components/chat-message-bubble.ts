import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';

import { ChatMessageDto, ChatParticipantDto } from '../../../core/api/models/chat.model';

@Component({
  selector: 'app-chat-message-bubble',
  standalone: true,
  imports: [DatePipe, TranslocoDirective],
  templateUrl: './chat-message-bubble.html',
  styleUrl: './chat-message-bubble.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageBubble {
  message = input.required<ChatMessageDto>();
  participant = input<ChatParticipantDto | null>(null);
  own = input(false);
  /** La otra parte ya leyó este mensaje (sólo tiene sentido en los propios). */
  read = input(false);

  /** El padre renueva la URL firmada cuando la imagen caduca. */
  refreshAttachment = output<string>();
  remove = output<ChatMessageDto>();

  readonly initials = computed(() => initialsOf(this.participant()));

  readonly isImage = computed(() => !this.message().deleted && this.message().kind === 'IMAGE');

  /** Evita un bucle de refrescos si la nueva URL también falla. */
  private readonly refreshed = new Set<string>();

  onImageError(): void {
    const attachment = this.message().attachment;
    if (!attachment || this.refreshed.has(attachment.id)) return;
    this.refreshed.add(attachment.id);
    this.refreshAttachment.emit(attachment.id);
  }
}

export function initialsOf(participant: ChatParticipantDto | null | undefined): string {
  if (!participant) return '?';
  const first = participant.firstName?.trim()?.[0] ?? '';
  const last = participant.lastName?.trim()?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || participant.firstName?.[0]?.toUpperCase() || '?';
}
