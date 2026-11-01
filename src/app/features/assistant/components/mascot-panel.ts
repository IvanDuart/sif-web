import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';

import {
  ATTACHMENT_TYPES,
  AssistantAttachmentDto,
  AssistantPendingActionDto,
} from '../../../core/api/models/assistant.model';
import { MascotStateService } from '../mascot-state.service';
import { MascotActionCard } from './mascot-action-card';
import { MascotOrb } from './mascot-orb';
import { MascotQuickReplies } from './mascot-quick-replies';
import { MascotRichText } from './mascot-rich-text';

/**
 * Panel de la mascota. El estado (sesión, mensajes, acción pendiente) vive en
 * `MascotStateService`, así que cerrar y reabrir no pierde la conversación.
 */
@Component({
  selector: 'app-mascot-panel',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoDirective,
    TuiButton,
    TuiInput,
    TuiTextfield,
    MascotOrb,
    MascotActionCard,
    MascotQuickReplies,
    MascotRichText,
  ],
  templateUrl: './mascot-panel.html',
  styleUrl: './mascot-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
})
export class MascotPanel {
  readonly state = inject(MascotStateService);

  readonly text = signal('');
  /** Hay algo encima del panel esperando a que lo suelten. */
  readonly dropping = signal(false);
  protected readonly acceptedTypes = ATTACHMENT_TYPES.join(',');

  private readonly scrollHost = viewChild<ElementRef<HTMLElement>>('scrollHost');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  readonly showGreeting = computed(
    () => !this.state.consentRequired() && this.state.messages().length === 0 && !!this.state.greeting()
  );

  constructor() {
    effect(() => {
      // Cualquier cambio de conversación lleva el scroll al final.
      this.state.messages();
      this.state.sending();
      this.state.pendingAction();
      requestAnimationFrame(() => this.scrollToBottom());
    });

    // Lo que dejó escrito quien abrió el panel (un tip, por ejemplo): se pone
    // en la caja y se consume, para que no vuelva a aparecer al reabrir.
    effect(() => {
      const draft = this.state.draft();
      if (!draft) return;
      this.text.set(draft);
      this.state.draft.set('');
      requestAnimationFrame(() => {
        const input = this.input()?.nativeElement;
        if (!input) return;
        input.focus();
        input.setSelectionRange(draft.length, draft.length);
      });
    });
  }

  /** Una imagen se enseña; un PDF se nombra. */
  protected isImage(file: AssistantAttachmentDto): boolean {
    return file.mimeType.startsWith('image/');
  }

  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.state.attach(file);
    // Para que elegir dos veces el mismo archivo vuelva a disparar `change`.
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    if (!this.carriesFile(event)) return;
    // Sin esto el navegador abre el archivo en la pestaña y se lleva la sesión.
    event.preventDefault();
    this.dropping.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    // `dragleave` salta también al pasar por encima de lo que hay dentro del
    // panel; solo cuenta el que sale del panel entero.
    if (event.currentTarget === event.target) this.dropping.set(false);
  }

  protected onDrop(event: DragEvent): void {
    if (!this.carriesFile(event)) return;
    event.preventDefault();
    this.dropping.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.state.attach(file);
  }

  private carriesFile(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  submit(): void {
    const text = this.text().trim();
    // Un archivo sin nada escrito también es un mensaje.
    if ((!text && !this.state.attachment()) || this.state.sending() || this.state.consentRequired()) {
      return;
    }

    this.state.send(text);
    this.text.set('');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.submit();
  }

  sendPrompt(prompt: string): void {
    if (this.state.sending() || this.state.consentRequired()) return;
    this.state.send(prompt);
  }

  confirmAction(action: AssistantPendingActionDto): void {
    this.state.confirmAction(action);
  }

  cancelAction(action: AssistantPendingActionDto): void {
    this.state.rejectAction(action);
  }

  acceptConsent(): void {
    this.state.acceptConsent();
  }

  declineConsent(): void {
    this.state.declineConsent();
  }

  openWardrobe(): void {
    this.state.openWardrobe();
  }

  close(): void {
    this.state.closePanel();
  }

  private scrollToBottom(): void {
    const host = this.scrollHost()?.nativeElement;
    if (host) host.scrollTop = host.scrollHeight;
  }
}
