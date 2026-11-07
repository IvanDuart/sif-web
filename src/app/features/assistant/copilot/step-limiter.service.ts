import { Injectable, computed, signal } from '@angular/core';

/** Los pasos de pantalla que se permiten por petición; el backend aplica el mismo tope. */
export const MAX_STEPS_PER_REQUEST = 30;

/**
 * Cuenta las herramientas de cliente de una petición. Cada una termina la
 * vuelta del modelo y el navegador empieza la siguiente con presupuesto
 * nuevo, así que sin tope «crea el horario completo» podría encadenarse sin
 * fin. Se cuenta por mensaje y se reinicia cuando la persona escribe.
 */
@Injectable({ providedIn: 'root' })
export class StepLimiter {
  private readonly count = signal(0);

  /** Los pasos dados en la petición en curso («Paso n»). */
  readonly used = this.count.asReadonly();
  readonly max = MAX_STEPS_PER_REQUEST;
  readonly exhausted = computed(() => this.count() >= this.max);

  reset(): void {
    this.count.set(0);
  }

  /** Gasta un paso; `false` si ya no quedan. */
  take(): boolean {
    if (this.count() >= this.max) return false;
    this.count.update((n) => n + 1);
    return true;
  }
}
