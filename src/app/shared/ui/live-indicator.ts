import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Pastilla "en directo" para pantallas que se refrescan por SSE. El latido es
 * decorativo y respeta `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-live-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="live">
      <span class="live__dot" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 9px 3px 7px;
      border-radius: var(--r-pill);
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 12px;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
    }
    .live__dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      animation: live-pulse 1.6s ease-in-out infinite;
    }
    @keyframes live-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.75); }
    }
    @media (prefers-reduced-motion: reduce) {
      .live__dot { animation: none; }
    }
  `],
})
export class LiveIndicator {
  label = input.required<string>();
}
