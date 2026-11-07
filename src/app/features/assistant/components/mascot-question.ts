import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import type { Question } from '../copilot/question.service';

/**
 * Lo que la mascota pregunta y no es una escritura: una duda del modelo
 * (`ask_user`) o el aviso antes de pulsar algo que no se deshace.
 *
 * Las escrituras siguen saliendo por `app-mascot-action-card`, que enseña la
 * vista previa de lo que se va a guardar. Aquí no hay nada que previsualizar:
 * hay algo que contestar.
 */
@Component({
  selector: 'app-mascot-question',
  standalone: true,
  imports: [FormsModule, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ask" *transloco="let t" [class.ask--danger]="question().dangerous">
      <p class="ask__text">{{ question().text }}</p>

      @if (question().dangerous) {
        <p class="ask__warn">{{ t('assistant.question_danger') }}</p>
      }

      @if (yesNo()) {
        <div class="ask__row">
          <button type="button" class="ask__chip" (click)="declined.emit()">{{ t('assistant.no') }}</button>
          <button type="button" class="ask__chip ask__chip--primary" (click)="answered.emit('yes')">
            {{ t('assistant.yes') }}
          </button>
        </div>
      } @else if (options().length > 0) {
        <div class="ask__row">
          @for (option of options(); track option) {
            <button type="button" class="ask__chip" (click)="answered.emit(option)">{{ option }}</button>
          }
        </div>
      } @else {
        <form class="ask__row" (ngSubmit)="send()">
          <input
            class="ask__input"
            type="text"
            autocomplete="off"
            [attr.aria-label]="question().text"
            [(ngModel)]="draft"
            [ngModelOptions]="{ standalone: true }"
          />
          <button type="button" class="ask__chip ask__chip--primary" [disabled]="draft().trim() === ''" (click)="send()">
            {{ t('assistant.send') }}
          </button>
        </form>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ask {
      margin: 6px 0;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: var(--r-md, 12px);
      background: var(--surface, #fff);
    }

    .ask--danger { border-color: var(--tui-status-negative, #b3261e); }

    .ask__text { margin: 0 0 8px; font-size: 13px; line-height: 1.4; }

    .ask__warn {
      margin: -4px 0 8px;
      font-size: 12px;
      color: var(--tui-status-negative, #b3261e);
    }

    .ask__row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

    .ask__chip {
      padding: 5px 12px;
      border: 1px solid var(--line);
      border-radius: var(--r-pill);
      background: transparent;
      color: var(--ink-2);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .ask__chip--primary {
      border-color: transparent;
      background: var(--tui-background-accent-1);
      color: #fff;
    }

    .ask__chip:disabled { opacity: 0.5; cursor: default; }

    .ask__input {
      flex: 1 1 8rem;
      min-width: 0;
      padding: 5px 10px;
      border: 1px solid var(--line);
      border-radius: var(--r-pill);
      background: transparent;
      color: var(--ink-1);
      font: inherit;
      font-size: 12px;
    }
  `],
})
export class MascotQuestion {
  readonly question = input.required<Question>();

  readonly answered = output<string>();
  readonly declined = output<void>();

  protected readonly draft = signal('');

  protected readonly yesNo = computed(() => this.question().kind === 'confirm');
  protected readonly options = computed(() => this.question().options ?? []);

  protected send(): void {
    const value = this.draft().trim();
    if (value === '') return;
    this.draft.set('');
    this.answered.emit(value);
  }
}
