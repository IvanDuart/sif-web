import { SKIN_IDS, type SkinId } from './types';

/**
 * El carácter de cada fruta.
 *
 * Hasta ahora las siete reaccionaban igual, y una mascota que se puede elegir
 * y siempre hace lo mismo no es una elección: es un color. Aquí cada una tiene
 * su forma de alegrarse y de enfadarse, con las piezas que el orbe ya dibuja
 * (`data-o`: corazones, estrellas, zetas, 💢) y con cómo se mueve el cuerpo.
 *
 * Es una tabla y no un `switch` dentro del motor a propósito: así se lee de un
 * vistazo quién es quién, y añadir una fruta es una fila.
 */

/** Lo que flota alrededor cuando algo le gusta. */
export type HappyBits = 'heart' | 'star' | 'both' | 'none';
/** Cómo se mueve el cuerpo. */
export type HappyMove = 'sway' | 'hop' | 'still' | 'preen';
export type AngryMove = 'shake' | 'shrink' | 'turn' | 'tremble' | 'pout' | 'sigh';

export interface Personality {
  /** Una línea de quién es, para quien lea esto dentro de un año. */
  who: string;
  happy: { bits: HappyBits; move: HappyMove };
  angry: { move: AngryMove; mark: boolean };
}

export const PERSONALITIES: Record<SkinId, Personality> = {
  manzana: {
    who: 'Clásica y cumplidora: ni se pasa ni se queda corta.',
    happy: { bits: 'heart', move: 'sway' },
    angry: { move: 'shake', mark: true },
  },
  naranja: {
    who: 'Chispa: se viene arriba enseguida y lo nota todo el mundo.',
    happy: { bits: 'star', move: 'hop' },
    angry: { move: 'tremble', mark: true },
  },
  pina: {
    who: 'Presumida: se sabe guapa y no tiene prisa.',
    happy: { bits: 'star', move: 'preen' },
    // Enfadada no grita: te da la espalda, que es peor.
    angry: { move: 'turn', mark: false },
  },
  melon: {
    who: 'Tranquilote: nada le altera demasiado.',
    happy: { bits: 'none', move: 'sway' },
    // Resopla y se desinfla. NO bosteza con zetas: la zeta dice «durmiendo»
    // en cualquier idioma, y puesta en un enfado sólo parece un fallo.
    angry: { move: 'sigh', mark: false },
  },
  brocoli: {
    who: 'Tímido: se alegra por dentro y se le nota en las mejillas.',
    happy: { bits: 'none', move: 'still' },
    angry: { move: 'shrink', mark: false },
  },
  zanahoria: {
    who: 'Nerviosa: no sabe estarse quieta ni para bien ni para mal.',
    happy: { bits: 'heart', move: 'hop' },
    angry: { move: 'tremble', mark: true },
  },
  semilla: {
    who: 'Cría: todo le admira y todo le duele un poco.',
    happy: { bits: 'both', move: 'hop' },
    angry: { move: 'pout', mark: false },
  },
};

export function personalityOf(skin: SkinId): Personality {
  return PERSONALITIES[skin] ?? PERSONALITIES[SKIN_IDS[0]];
}
