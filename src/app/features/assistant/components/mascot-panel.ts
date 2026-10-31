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

import { AssistantPendingActionDto } from '../../../core/api/models/assistant.model';
import { MascotStateService } from '../mascot-state.service';
import { MascotActionCard } from './mascot-action-card';
import { MascotAvatar } from './mascot-avatar';
import { MascotQuickReplies } from './mascot-quick-replies';

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
    MascotAvatar,
    MascotActionCard,
    MascotQuickReplies,
  ],
  templateUrl: './mascot-panel.html',
  styleUrl: './mascot-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
})
export class MascotPanel {
  readonly state = inject(MascotStateService);

  readonly text = signal('');

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
  }

  submit(): void {
    const text = this.text().trim();
    if (!text || this.state.sending() || this.state.consentRequired()) return;

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

  close(): void {
    this.state.closePanel();
  }

  private scrollToBottom(): void {
    const host = this.scrollHost()?.nativeElement;
    if (host) host.scrollTop = host.scrollHeight;
  }
}
