import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import type { FieldAccess, FillOpener, FillSurface } from './descriptor';

/** Un formulario montado, con cómo se escribe en él. */
export interface MountedSurface {
  surface: FillSurface;
  access: FieldAccess;
}

/**
 * Los formularios que hay ahora mismo en pantalla y el viaje de la mascota por
 * ellos (`copilotStore.registerSurface` + `cursorStore` de alkimia, juntos:
 * aquí no hace falta separarlos).
 *
 * El registro vive aquí y no en el estado del asistente porque lo escriben las
 * páginas, que no saben nada del asistente: montan, se apuntan y se borran al
 * destruirse.
 */
@Injectable({ providedIn: 'root' })
export class MascotFillService {
  private readonly mounted = new Map<string, MountedSurface>();
  private readonly openers = new Map<string, FillOpener>();

  // ── El viaje ────────────────────────────────────────────────────────

  /** El campo al que ha ido la mascota; la mascota lo sigue mientras exista. */
  readonly target = signal<HTMLElement | null>(null);
  /** Lo que tarda en llegar al siguiente campo, ms (su transición CSS). */
  readonly hopMs = signal(450);
  /** Está rellenando: la mascota actúa y el panel no estorba. */
  readonly filling = signal(false);
  /** Lo que está haciendo, como clave de i18n: lo dice su bocadillo. */
  readonly saying = signal<{ key: string; values?: Record<string, string> } | null>(null);
  /** Sube en cada pulsación, para que el anillo se repita aunque sean dos seguidas. */
  readonly presses = signal(0);

  private skipped = false;
  private readonly waiting = new Set<() => void>();

  // ── El registro ─────────────────────────────────────────────────────

  /**
   * Apunta el formulario mientras el componente que llama esté vivo. Se llama
   * desde un contexto de inyección (el constructor de la página).
   */
  register(surface: FillSurface, access: FieldAccess): void {
    this.mounted.set(surface.id, { surface, access });
    inject(DestroyRef).onDestroy(() => {
      // Sólo si sigue siendo el suyo: dos diálogos del mismo id que se solapan
      // al cerrarse y abrirse no deben borrarse el registro el uno al otro.
      if (this.mounted.get(surface.id)?.surface === surface) this.mounted.delete(surface.id);
    });
  }

  /** El formulario en pantalla que rellena esa tool, si hay alguno. */
  forTool(toolName: string): MountedSurface | null {
    for (const entry of this.mounted.values()) {
      if (entry.surface.tools.includes(toolName)) return entry;
    }
    return null;
  }

  /**
   * Apunta cómo se abre un formulario mientras la página que tiene el botón
   * esté viva. Se llama desde un contexto de inyección, como `register`.
   */
  registerOpener(opener: FillOpener): void {
    this.openers.set(opener.id, opener);
    inject(DestroyRef).onDestroy(() => {
      if (this.openers.get(opener.id) === opener) this.openers.delete(opener.id);
    });
  }

  /** Cómo abrir un formulario para esa tool desde esta pantalla, si se puede. */
  openerForTool(toolName: string): FillOpener | null {
    for (const opener of this.openers.values()) {
      if (opener.tools.includes(toolName)) return opener;
    }
    return null;
  }

  /**
   * Espera a que aparezca el formulario de esa tool: el asistente puede navegar
   * a la pantalla y el formulario tarda en montar.
   */
  async waitForTool(toolName: string, timeoutMs: number): Promise<MountedSurface | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.forTool(toolName);
      if (found) return found;
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  // ── Parar ───────────────────────────────────────────────────────────

  /** La persona ha pedido parar (Esc, el botón, o se ha puesto a escribir ella). */
  requestSkip(): void {
    this.skipped = true;
    for (const resume of [...this.waiting]) resume();
  }

  get skipRequested(): boolean {
    return this.skipped;
  }

  /** Espera `ms`, o nada si han pedido parar. */
  wait(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.waiting.delete(done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.waiting.add(done);
    });
  }

  /**
   * Empieza un relleno: la mascota sale de su esquina. No borra el "para": si
   * lo han pedido entre que se decidió rellenar y el arranque, vale igual.
   * Lo limpia `end()`, al terminar cada relleno.
   */
  begin(): void {
    this.filling.set(true);
  }

  /** Lo deja: la mascota vuelve a su esquina y suelta el campo. */
  end(): void {
    this.filling.set(false);
    this.target.set(null);
    this.saying.set(null);
    this.skipped = false;
    for (const resume of [...this.waiting]) resume();
    this.waiting.clear();
  }
}
