import { Injectable, computed, inject, isDevMode, signal } from '@angular/core';

import { PageContextService } from './page-context.service';
import { StepLimiter } from './step-limiter.service';
import { ToolRegistryService } from './tool-registry.service';

/** La clave de `localStorage` que enseña el catálogo dentro del panel. */
export const CATALOG_DEBUG_KEY = 'mascot-debug-catalog';

/**
 * Qué se le está ofreciendo al modelo desde esta pantalla.
 *
 * Lo que el backend no acepta lo descarta **en silencio**: una herramienta con
 * un guion en el nombre o un esquema de más de 2 KB desaparece sin error, y
 * desde fuera eso se ve como un modelo que «no quiere» usarla. `catalog-rules`
 * avisa por consola de lo que no pasaría; esto enseña lo que sí pasa, que es
 * la otra mitad de la pregunta.
 *
 * Solo en desarrollo y solo con la clave puesta: no es una pantalla de
 * producto.
 */
@Injectable({ providedIn: 'root' })
export class CatalogDebugService {
  private readonly tools = inject(ToolRegistryService);
  private readonly pageContext = inject(PageContextService);
  private readonly steps = inject(StepLimiter);

  /** Sube a mano para volver a mirar: el catálogo depende del DOM, no de signals. */
  private readonly tick = signal(0);

  readonly enabled = computed(() => {
    if (!isDevMode()) return false;
    try {
      return globalThis.localStorage?.getItem(CATALOG_DEBUG_KEY) === '1';
    } catch {
      return false;
    }
  });

  readonly used = this.steps.used;

  refresh(): void {
    this.tick.update((value) => value + 1);
  }

  /** Lo que se mandaría si se enviara un mensaje ahora mismo. */
  readonly snapshot = computed(() => {
    this.tick();
    if (!this.enabled()) return null;
    const context = this.pageContext.build();
    return {
      tools: this.tools.catalog().map((decl) => ({
        name: decl.name,
        bytes: JSON.stringify(decl.parameters).length,
      })),
      route: context.route,
      forms: (context.forms ?? []).map((form) => form.id),
      contextBytes: JSON.stringify(context).length,
    };
  });
}
