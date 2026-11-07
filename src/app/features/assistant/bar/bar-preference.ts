import { signal } from '@angular/core';

/**
 * La barra de abajo sustituye al panel flotante, pero no de golpe.
 *
 * Mientras se termina de pulir convive con el panel detrás de esta clave, que
 * es local a propósito: es temporal, no es un ajuste de producto y no merece
 * un viaje al backend ni una columna en la tabla de preferencias. Cuando la
 * barra sea lo único que hay (F8), esto se borra.
 */
export const BAR_KEY = 'mascot-bar';

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(BAR_KEY) === '1';
  } catch {
    return false;
  }
}

export const barEnabled = signal(read());

/** Para cambiarla desde la consola sin recargar: `window.nuti` llega en F7. */
export function setBarEnabled(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(BAR_KEY, on ? '1' : '0');
  } catch {
    // Sin almacenamiento la barra vale para esta sesión y ya.
  }
  barEnabled.set(on);
}
