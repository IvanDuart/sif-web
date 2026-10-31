import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { MascotStateService } from '../mascot-state.service';
import { MascotAvatar } from './mascot-avatar';
import { MascotPanel } from './mascot-panel';

/**
 * Punto de montaje global de la mascota, dentro del `Shell`. Sólo se pinta si
 * el tenant tiene el asistente habilitado (`/assistant/config.enabled`).
 */
@Component({
  selector: 'app-mascot-launcher',
  standalone: true,
  imports: [TranslocoDirective, MascotAvatar, MascotPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.enabled()) {
      @if (state.open()) {
        <div class="mascot-backdrop" aria-hidden="true" (click)="state.closePanel()"></div>
        <app-mascot-panel />
      }

      <button
        type="button"
        class="mascot-fab"
        [class.mascot-fab--open]="state.open()"
        [attr.aria-expanded]="state.open()"
        aria-controls="mascot-panel"
        [attr.aria-label]="state.open() ? t('assistant.close') : t('assistant.open', { name: state.name() })"
        (click)="state.toggle()"
        *transloco="let t"
      >
        <app-mascot-avatar
          [src]="state.avatarSrc()"
          [fallback]="state.fallbackSrc()"
          [idleAnimation]="state.open() ? null : state.idleAnimation()"
          [thinkingAnimation]="state.open() ? null : state.thinkingAnimation()"
          size="m"
          [mood]="state.sending() ? 'thinking' : 'idle'"
        />
      </button>
    }
  `,
  styles: [`
    :host { display: contents; }

    .mascot-fab {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 300;
      display: grid;
      place-items: center;
      width: 62px;
      height: 62px;
      padding: 3px;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--surface, #fff);
      box-shadow: var(--shadow-float);
      cursor: pointer;
      transition: transform var(--motion-duration-fast, 150ms) var(--motion-ease-out, ease-out),
        box-shadow var(--motion-duration-fast, 150ms) var(--motion-ease-out, ease-out);

      &:hover {
        transform: translateY(-2px);
      }

      &:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 3px;
      }
    }

    .mascot-backdrop {
      display: none;
    }

    @media (max-width: 640px) {
      .mascot-fab {
        right: 16px;
        bottom: calc(var(--bottom-nav-h, 60px) + 14px + env(safe-area-inset-bottom, 0px));
      }

      .mascot-fab--open {
        opacity: 0;
        pointer-events: none;
      }

      .mascot-backdrop {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 299;
        background: rgb(31 29 26 / 0.35);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mascot-fab {
        transition: none;

        &:hover {
          transform: none;
        }
      }
    }
  `],
})
export class MascotLauncher implements OnInit {
  readonly state = inject(MascotStateService);

  ngOnInit(): void {
    this.state.loadConfig();
  }
}
