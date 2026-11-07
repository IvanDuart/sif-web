import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CatalogDebugService } from './catalog-debug.service';

/**
 * Qué se le está ofreciendo al modelo desde esta pantalla.
 *
 * Lo que el backend no acepta lo descarta **en silencio**, así que desde fuera
 * un esquema de más de 2 KB se ve como un modelo que «no quiere» usar la
 * herramienta. Esto enseña lo que sí se manda.
 *
 * Es un componente y no un trozo de plantilla porque lo usan el panel y la
 * barra: cuando estaba metido en el panel, encender la barra lo hacía
 * desaparecer justo cuando hacía falta.
 */
@Component({
  selector: 'app-catalog-debug',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (debug.enabled()) {
      <div class="debug">
        <button type="button" class="debug__refresh" (click)="debug.refresh()">
          Catálogo · paso {{ debug.used() }}/30
        </button>
        @if (debug.snapshot(); as snapshot) {
          <p class="debug__line">{{ snapshot.route }} · ctx {{ snapshot.contextBytes }} B · {{ snapshot.forms.join(', ') }}</p>
          @for (tool of snapshot.tools; track tool.name) {
            <p class="debug__line">{{ tool.name }} · {{ tool.bytes }} B</p>
          }
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .debug {
      max-height: 9rem;
      overflow-y: auto;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--line);
      background: var(--sunken, #f4f2ee);
      font-family: ui-monospace, monospace;
      font-size: 0.6875rem;
      line-height: 1.5;
      color: var(--ink-2);
    }

    .debug__refresh {
      border: none;
      background: none;
      font: inherit;
      color: var(--ink-1);
      cursor: pointer;
      padding: 0;
    }

    .debug__line { margin: 0; white-space: nowrap; }
  `],
})
export class CatalogDebug {
  protected readonly debug = inject(CatalogDebugService);
}
