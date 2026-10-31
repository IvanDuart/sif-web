import type { SkinId } from './types';

/**
 * Dónde están los ojos de cada skin y de qué color. La esquina superior
 * izquierda de cada ojo (una barra de 17×35) en la caja de dibujo 160×160, y
 * el color de los ojos y de todo lo que se dibuja con ellos.
 */
export interface Face {
  eyes: readonly [readonly [number, number], readonly [number, number]];
  colour: string;
}

export const FACES: Record<SkinId, Face> = {
  manzana: {
    eyes: [
      [53, 74],
      [90, 74],
    ],
    colour: '#ffffff',
  },
  naranja: {
    eyes: [
      [53, 62],
      [90, 62],
    ],
    colour: '#ffffff',
  },
  pina: {
    eyes: [
      [53, 68],
      [90, 68],
    ],
    colour: '#ffffff',
  },
  melon: {
    eyes: [
      [53, 66],
      [90, 66],
    ],
    colour: '#ffffff',
  },
};

/** El tamaño de la barra y su centro, desde su esquina superior izquierda. */
export const EYE_W = 17;
export const EYE_H = 35;
export const EYE_CX = 8.5;
export const EYE_CY = 17.5;

/** 1px del orb de 48px, en unidades del dibujo. */
export const K = 2.5;

/**
 * Un ojo en términos del diseño: `s` (1 = la barra habitual), `x`/`y` hacia
 * dónde mira en px del orb, y cuál de sus tres formas muestra.
 */
export interface EyeState {
  s: number;
  x: number;
  y: number;
  look: 'bar' | 'arch' | 'spiral';
}

export const OPEN: EyeState = { s: 1, x: 0, y: 0, look: 'bar' };
export const SHUT: EyeState = { s: 0.25, x: 0, y: 2, look: 'bar' };
export const ARCH: EyeState = { s: 1, x: 0, y: -1, look: 'arch' };
