import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { COVER_MS, REVEAL_MS, RouteVeilService } from './route-veil';

/**
 * El velo de cuando la mascota cambia de pantalla.
 *
 * Va por encima de la aplicación y por debajo de la propia mascota, que se
 * queda visible: lo que cambia es el suelo, no ella. No toma clics.
 */
@Component({
  selector: 'app-route-veil',
  standalone: true,
  imports: [TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (veil.phase() !== 'idle') {
      <div class="veil" role="status" [attr.data-phase]="veil.phase()" *transloco="let t">
        <span class="veil__card">
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          {{ veil.place() ? t('assistant.navigating_to', { place: veil.place() }) : t('assistant.navigating') }}
        </span>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .veil {
      position: fixed;
      inset: 0;
      z-index: 290;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--canvas, #fbfaf8) 78%, transparent);
      backdrop-filter: blur(1.5px);
      pointer-events: none;
    }

    .veil[data-phase='covering'] { animation: veil-cover var(--veil-cover, 180ms) ease-out both; }
    .veil[data-phase='revealing'] { animation: veil-reveal var(--veil-reveal, 220ms) ease-in both; }

    @keyframes veil-cover {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes veil-reveal {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    .veil__card {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface, #fff);
      box-shadow: var(--shadow-float, 0 8px 24px rgb(31 29 26 / 6%));
      font-size: 13.5px;
      color: var(--ink-1);
    }

    @media (prefers-reduced-motion: reduce) {
      .veil { animation: none; }
    }
  `],
  host: {
    '[style.--veil-cover.ms]': 'cover',
    '[style.--veil-reveal.ms]': 'reveal',
  },
})
export class RouteVeil {
  protected readonly veil = inject(RouteVeilService);
  protected readonly cover = COVER_MS;
  protected readonly reveal = REVEAL_MS;
}
