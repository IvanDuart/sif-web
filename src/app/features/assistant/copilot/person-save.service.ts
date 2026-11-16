import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { WriteWatchService } from './write-watch.service';

/** Cómo acabó el Guardar que pulsó la persona. */
export type PersonSaveOutcome =
  | { saved: true; status: number }
  /** El servidor lo rechazó. */
  | { saved: false; reason: 'rejected'; status: number }
  /** El botón no llegó a mandar nada: el formulario tenía errores. */
  | { saved: false; reason: 'form_has_errors'; errors: string[] }
  /** No se mandó nada y no hay errores a la vista: dijo que no en la confirmación. */
  | { saved: false; reason: 'not_sent' }
  /** No se pudo saber a tiempo. */
  | { saved: false; reason: 'unknown' };

/** Lo que se espera a que el botón mande algo antes de darlo por no enviado. */
export const SEND_GRACE_MS = 800;
/** Lo más que se espera la respuesta del servidor. */
export const SAVE_WAIT_MS = 15_000;
/** Lo más que se espera a que la persona conteste un «¿seguro?» del propio botón. */
export const CONFIRM_WAIT_MS = 120_000;
/** Cada cuánto se mira. */
const POLL_MS = 100;
/** Errores que se le cuentan al modelo, como mucho. */
const MAX_ERRORS = 5;

/**
 * El Guardar de la persona, mientras la mascota espera (`onPersonSave` de Neki).
 *
 * Con D4 la mascota rellena y guarda la persona. Si en ese momento la mascota
 * está esperando una respuesta (`ask_user`: «revísalo y guárdalo, luego sigo»),
 * pulsar Guardar **es** la respuesta. Sin esto el turno se quedaba esperando a
 * que alguien escribiera algo en la barra.
 *
 * El botón se reconoce por `data-mascot-submit`, que ya llevan los formularios
 * que rellena la mascota (y los botones de acción que señala). Se escucha en
 * fase de captura, antes del manejador del propio botón, para no perderse el
 * clic si el botón cierra el diálogo.
 *
 * A diferencia de Neki, si se guardó no se deduce del DOM (si el diálogo se
 * cerró, si salió un error): lo cuenta la propia petición, que pasa por
 * `assistantWriteInterceptor` porque `ask_user` es una herramienta en curso.
 */
@Injectable({ providedIn: 'root' })
export class PersonSaveService {
  private readonly document = inject(DOCUMENT);
  private readonly writes = inject(WriteWatchService);

  /**
   * Llama a `onPress` la primera vez que la persona pulsa un botón de guardar
   * habilitado. Devuelve cómo dejar de escuchar.
   */
  watch(onPress: (button: HTMLElement) => void): () => void {
    let done = false;
    const listener = (event: Event): void => {
      if (done) return;
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLElement>('[data-mascot-submit]');
      if (!button || isDisabled(button)) return;
      done = true;
      onPress(button);
    };
    this.document.addEventListener('click', listener, true);
    return () => this.document.removeEventListener('click', listener, true);
  }

  /**
   * Espera a saber cómo acabó lo que mandó el botón. Se llama justo después del
   * clic, así que lo que haya en `WriteWatchService` es de este guardado: se
   * pone a cero aquí por si quedaba algo de antes.
   */
  async outcome(button: HTMLElement, signal?: AbortSignal): Promise<PersonSaveOutcome> {
    this.writes.reset();
    const started = Date.now();
    const dialogsBefore = this.dialogs();
    // Desde cuándo se cuenta la gracia: si el botón abre un «¿seguro?» (cancelar
    // una cita), no se manda nada hasta que la persona contesta, y eso no es un
    // formulario con errores.
    let graceFrom = started;

    while (!signal?.aborted) {
      const last = this.writes.last();
      const pending = this.writes.inFlight() > 0;
      const now = Date.now();

      if (last && !pending) {
        return last.ok ? { saved: true, status: last.status } : { saved: false, reason: 'rejected', status: last.status };
      }
      if (!last && !pending && this.dialogs() > dialogsBefore) {
        graceFrom = now;
        if (now - started >= CONFIRM_WAIT_MS) return { saved: false, reason: 'unknown' };
      } else if (!last && !pending && now - graceFrom >= SEND_GRACE_MS) {
        const errors = errorsNear(button);
        return errors.length > 0 ? { saved: false, reason: 'form_has_errors', errors } : { saved: false, reason: 'not_sent' };
      } else if (now - graceFrom >= SAVE_WAIT_MS) {
        return { saved: false, reason: 'unknown' };
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    return { saved: false, reason: 'unknown' };
  }

  /** Cuántos diálogos hay abiertos: uno más tras el clic es un «¿seguro?». */
  private dialogs(): number {
    return this.document.querySelectorAll('[role="dialog"]').length;
  }
}

/** Taiga deshabilita con el atributo; algunos botones lo marcan con `aria-disabled`. */
function isDisabled(button: HTMLElement): boolean {
  return button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true';
}

/**
 * Los errores que enseña el formulario del botón, para que el modelo pueda
 * decirle a la persona por qué no se guardó. Se buscan en el diálogo o el
 * formulario que contiene el botón; si no está en ninguno, nada.
 */
export function errorsNear(button: HTMLElement): string[] {
  const scope = button.closest('form, [role="dialog"], tui-dialog, .t-dialog');
  if (!scope) return [];
  const texts = [...scope.querySelectorAll('tui-error, [role="alert"]')]
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter((text) => text !== '');
  return [...new Set(texts)].slice(0, MAX_ERRORS);
}
