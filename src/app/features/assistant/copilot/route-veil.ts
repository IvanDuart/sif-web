import { Injectable, signal } from '@angular/core';

/** Lo que tarda en cubrir, y lo que tarda en descubrir. */
export const COVER_MS = 180;
export const REVEAL_MS = 220;

export type VeilPhase = 'idle' | 'covering' | 'revealing';

/**
 * El velo de cuando la mascota cambia de pantalla.
 *
 * Una navegación que pide la persona la espera ella: ha pulsado algo y sabe
 * que la pantalla va a cambiar. Una que pide el modelo, no — la pantalla se
 * le cambia debajo mientras mira otra cosa. El velo da ese medio segundo de
 * aviso, y de paso tapa el salto de maquetación de una pantalla montándose.
 *
 * No toma clics ni atrapa el foco: sólo se ve.
 */
@Injectable({ providedIn: 'root' })
export class RouteVeilService {
  readonly phase = signal<VeilPhase>('idle');
  /** A dónde va, para decirlo mientras tanto. */
  readonly place = signal('');

  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Cubre, hace lo que haya que hacer, y descubre. Devuelve lo que devuelva
   * `go`; si `go` lanza, el velo se retira igual, que quedarse con la pantalla
   * tapada sería peor que el error.
   */
  async during<T>(place: string, go: () => Promise<T>): Promise<T> {
    if (this.reduced()) return go();

    this.place.set(place);
    this.clear();
    this.phase.set('covering');
    await this.wait(COVER_MS);
    try {
      return await go();
    } finally {
      this.phase.set('revealing');
      this.timer = setTimeout(() => {
        this.phase.set('idle');
        this.place.set('');
        this.timer = null;
      }, REVEAL_MS);
    }
  }

  private reduced(): boolean {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private clear(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
