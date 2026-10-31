import type { SkinId } from './types';

/**
 * Las skins como contornos que pueden transformarse unos en otros.
 *
 * Cada dibujo se ilumina igual: su contorno en el color oscuro y una zona
 * iluminada en el color claro recortada a ese contorno. Para transformar una
 * skin en otra, cada contorno se describe igual: su distancia desde un centro
 * en cada uno de `SAMPLES` ángulos. Dos listas así siempre miden lo mismo, y
 * la transformación es aritmética punto a punto.
 */

/** Puntos alrededor de cada contorno: a 62px de ancho, más de uno por píxel de borde. */
export const SAMPLES = 240;

type Inside = (x: number, y: number) => boolean;

interface Drawing {
  /** El centro desde el que se mide el contorno. */
  centre: readonly [number, number];
  inside: Inside;
  /** La zona iluminada, antes de recortarla al contorno. */
  lit: Inside;
  dark: string;
  light: string;
  /** El brillo: [x de la elipse, y, inclinación, x del punto, y, escala]. */
  spot: readonly [number, number, number, number, number, number];
  /** El disco pálido detrás del cuerpo (ninguno por ahora). */
  halo: boolean;
}

export interface Geometry {
  cx: number;
  cy: number;
  body: readonly number[];
  lit: readonly number[];
  dark: string;
  light: string;
  spot: readonly number[];
  /** 0 (ninguno) a 1. */
  halo: number;
}

const circle =
  (cx: number, cy: number, r: number): Inside =>
  (x, y) =>
    (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

const ellipse =
  (cx: number, cy: number, rx: number, ry: number): Inside =>
  (x, y) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

function roundRect(left: number, top: number, width: number, height: number, r: number): Inside {
  return (x, y) => {
    const dx = Math.max(left + r - x, 0, x - (left + width - r));
    const dy = Math.max(top + r - y, 0, y - (top + height - r));
    return dx * dx + dy * dy <= r * r;
  };
}

const union =
  (...parts: Inside[]): Inside =>
  (x, y) =>
    parts.some((part) => part(x, y));

const moved =
  (shape: Inside, dx: number, dy: number): Inside =>
  (x, y) =>
    shape(x - dx, y - dy);

/** Manzana: dos lóbulos y un cuerpo redondeado (el tallo y la hoja son detalle). */
const APPLE = union(circle(64, 90, 44), circle(96, 90, 44), roundRect(52, 62, 56, 80, 36));

/** Naranja: una esfera (el rabillo y la hoja son detalle). */
const ORANGE = circle(80, 86, 58);

/** Piña redonda: una esfera (el penacho y el enrejado son detalle). */
const PINEAPPLE = circle(80, 92, 52);

/** Melón: algo más ancho que alto (el rabillo y las rayas son detalle). */
const MELON = ellipse(80, 90, 58, 50);

const DRAWINGS: Record<SkinId, Drawing> = {
  manzana: {
    centre: [80, 90],
    inside: APPLE,
    lit: moved(APPLE, -6, -9),
    dark: '#b23b32',
    light: '#d84a3f',
    spot: [56, 62, -30, 44, 72, 1],
    halo: false,
  },
  naranja: {
    centre: [80, 86],
    inside: ORANGE,
    lit: moved(ORANGE, -11, -15),
    dark: '#d9701a',
    light: '#f3901f',
    spot: [48, 50, -30, 38, 68, 1],
    halo: false,
  },
  pina: {
    centre: [80, 92],
    inside: PINEAPPLE,
    lit: moved(PINEAPPLE, -10, -13),
    dark: '#c8921c',
    light: '#edb63a',
    spot: [48, 60, -30, 38, 78, 1],
    halo: false,
  },
  melon: {
    centre: [80, 90],
    inside: MELON,
    lit: moved(MELON, -10, -13),
    dark: '#6f9a3a',
    light: '#9bc45f',
    spot: [46, 58, -30, 36, 76, 1],
    halo: false,
  },
};

/** Distancia de (cx, cy) a donde termina la forma por cada rayo. */
function measure(shape: Inside, cx: number, cy: number): number[] {
  return Array.from({ length: SAMPLES }, (_, index) => {
    const angle = (index / SAMPLES) * 2 * Math.PI;
    const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
    const at = (r: number) => shape(cx + r * ux, cy + r * uy);
    let r = 120;
    while (r > 0 && !at(r)) r -= 1;
    let [low, high] = [r, r + 1];
    for (let step = 0; step < 12; step += 1) {
      const middle = (low + high) / 2;
      if (at(middle)) low = middle;
      else high = middle;
    }
    return low;
  });
}

const measured = new Map<SkinId, Geometry>();

export function geometryOf(id: SkinId): Geometry {
  let geometry = measured.get(id);
  if (!geometry) {
    const drawing = DRAWINGS[id];
    const [cx, cy] = drawing.centre;
    geometry = {
      cx,
      cy,
      body: measure(drawing.inside, cx, cy),
      lit: measure(drawing.lit, cx, cy),
      dark: drawing.dark,
      light: drawing.light,
      spot: drawing.spot,
      halo: drawing.halo ? 1 : 0,
    };
    measured.set(id, geometry);
  }
  return geometry;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function mixColour(a: string, b: string, t: number): string {
  const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const [from, to] = [channels(a), channels(b)];
  return `#${from
    .map((value, index) =>
      Math.round(mix(value, to[index], t))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** `t` del camino de un contorno (y sus colores, luz y brillo) a otro. */
export function mixGeometry(a: Geometry, b: Geometry, t: number): Geometry {
  return {
    cx: mix(a.cx, b.cx, t),
    cy: mix(a.cy, b.cy, t),
    body: a.body.map((r, index) => mix(r, b.body[index], t)),
    lit: a.lit.map((r, index) => mix(r, b.lit[index], t)),
    dark: mixColour(a.dark, b.dark, t),
    light: mixColour(a.light, b.light, t),
    spot: a.spot.map((value, index) => mix(value, b.spot[index], t)),
    halo: mix(a.halo, b.halo, t),
  };
}

/** El camino cerrado que pasa por los puntos de un contorno. */
export function outlinePath(cx: number, cy: number, radii: readonly number[]): string {
  const points = radii.map((r, index) => {
    const angle = (index / radii.length) * 2 * Math.PI;
    return `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
}
