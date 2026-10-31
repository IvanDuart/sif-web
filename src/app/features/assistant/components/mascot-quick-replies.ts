import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Sugerencias iniciales que envía el backend (`suggestedPrompts`). */
@Component({
  selector: 'app-mascot-quick-replies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (prompts().length > 0) {
      <div class="quick" role="group" [attr.aria-label]="label()">
        @for (prompt of prompts(); track prompt) {
          <button type="button" class="quick__chip" (click)="selected.emit(prompt)">
            {{ prompt }}
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .quick {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 2px 0 6px;
    }

    .quick__chip {
      max-width: 100%;
      padding: 5px 10px;
      border: 1px solid var(--line);
      border-radius: var(--r-pill);
      background: var(--surface, #fff);
      color: var(--ink-2);
      font: inherit;
      font-size: 12px;
      line-height: 1.2;
      text-align: left;
      cursor: pointer;
      transition: border-color var(--motion-duration-fast, 150ms) var(--motion-ease-out, ease-out),
        background-color var(--motion-duration-fast, 150ms) var(--motion-ease-out, ease-out);

      &:hover {
        border-color: var(--primary);
        background: var(--primary-soft);
        color: var(--primary);
      }

      &:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 1px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .quick__chip { transition: none; }
    }
  `],
})
export class MascotQuickReplies {
  prompts = input<string[]>([]);
  label = input('Sugerencias');
  selected = output<string>();
}
