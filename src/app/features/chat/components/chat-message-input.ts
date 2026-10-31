import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';

/** Mismos límites que valida el backend. */
export const CHAT_MAX_TEXT_LENGTH = 2000;
export const CHAT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

@Component({
  selector: 'app-chat-message-input',
  standalone: true,
  imports: [TranslocoDirective, TuiButton, TuiTextfield, TuiTextarea],
  templateUrl: './chat-message-input.html',
  styleUrl: './chat-message-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageInput {
  disabled = input(false);

  sendText = output<string>();
  sendImage = output<File>();

  readonly text = signal('');
  readonly localError = signal<string | null>(null);
  readonly maxLength = CHAT_MAX_TEXT_LENGTH;

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  write(value: string): void {
    this.text.set(value);
    if (this.localError()) this.localError.set(null);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.submit();
  }

  submit(): void {
    const value = this.text().trim();
    if (!value || this.disabled()) return;
    this.sendText.emit(value);
  }

  chooseImage(): void {
    if (this.disabled()) return;
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!CHAT_IMAGE_TYPES.includes(file.type as (typeof CHAT_IMAGE_TYPES)[number])) {
      this.localError.set('chat.error_unsupported_image');
      return;
    }
    if (file.size > CHAT_MAX_IMAGE_BYTES) {
      this.localError.set('chat.error_image_too_large');
      return;
    }

    this.localError.set(null);
    this.sendImage.emit(file);
  }

  /** El padre lo llama tras un envío correcto; si falla, el texto se conserva. */
  clear(): void {
    this.text.set('');
    this.localError.set(null);
    this.textarea()?.nativeElement.focus();
  }
}
