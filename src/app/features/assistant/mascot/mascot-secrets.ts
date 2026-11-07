import { isDevMode } from '@angular/core';

/**
 * Lo que se puede hacer con la mascota desde la consola, **sólo en
 * desarrollo**.
 *
 * No es un juguete: es lo que evita tener que reproducir a mano un estado para
 * ver si la mascota reacciona bien. Poner la skin, forzar un ánimo o abrir el
 * armario cuesta una línea en vez de cinco clics y una sesión.
 *
 * En producción no se instala nada: `isDevMode()` lo decide, y así no hay un
 * `window.nuti` que invite a nadie a trastear en la clínica de alguien.
 */

export interface MascotSecrets {
  /** Qué sabe hacer, para no tener que mirarlo aquí. */
  help(): string[];
  wardrobe(): void;
  skin(id: string): void;
  say(text: string): void;
  bar(open: boolean): void;
}

const GLOBAL = 'nuti';

export function installSecrets(secrets: MascotSecrets): () => void {
  if (!isDevMode()) return () => undefined;
  const target = globalThis as Record<string, unknown>;
  const had = GLOBAL in target;
  const before = target[GLOBAL];
  target[GLOBAL] = secrets;
  console.info(`🥦 nuti listo. Prueba ${GLOBAL}.help()`);
  return () => {
    if (had) target[GLOBAL] = before;
    else delete target[GLOBAL];
  };
}

export const SECRET_HELP: readonly string[] = [
  'nuti.wardrobe()        abre el armario',
  'nuti.skin("broccoli")  se pone esa piel',
  'nuti.say("hola")       le hace decir algo',
  'nuti.bar(true|false)   abre o pliega la conversación',
];
