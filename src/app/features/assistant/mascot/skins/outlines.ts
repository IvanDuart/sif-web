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

const moved =
  (shape: Inside, dx: number, dy: number): Inside =>
  (x, y) =>
    shape(x - dx, y - dy);

/**
 * Una unión blanda: en vez de cruzarse, los círculos se funden, así que el
 * contorno no tiene los pliegues que deja `union` donde dos bordes se cortan.
 */
const blob =
  (...parts: readonly (readonly [number, number, number])[]): Inside =>
  (x, y) =>
    parts.reduce((field, [cx, cy, r]) => {
      const distance = (x - cx) ** 2 + (y - cy) ** 2;
      return field + (distance === 0 ? Infinity : (r * r) / distance);
    }, 0) >= 1;

const without =
  (shape: Inside, ...holes: Inside[]): Inside =>
  (x, y) =>
    shape(x, y) && !holes.some((hole) => hole(x, y));

/**
 * Manzana: dos hombros anchos sobre un cuerpo que se estrecha al bajar, con
 * el hoyo de arriba del que sale el tallo y la muesca de abajo que le deja
 * dos pies. Sin ese hoyo y esa muesca el contorno es el de un tomate.
 */
const APPLE = without(
  blob([58, 86, 30], [102, 86, 30], [80, 108, 32]),
  circle(80, 26, 22),
  circle(80, 158, 17),
);

/** Naranja: una esfera (el rabillo y la hoja son detalle). */
const ORANGE = circle(80, 86, 58);

/** Piña redonda: una esfera (el penacho y el enrejado son detalle). */
const PINEAPPLE = circle(80, 92, 52);

/** Melón: algo más ancho que alto (el rabillo y las rayas son detalle). */
const MELON = ellipse(80, 90, 58, 50);

/**
 * Brócoli: la mata de cogollos sobre un tallo estrecho (el tallo es detalle).
 *
 * Los bultos tienen que quedar **separados** para que el borde salga festoneado:
 * juntos se funden en una bola y lo que se ve es un árbol. De ahí que la corona
 * sea ancha, el cuerpo de abajo estrecho, y entre bulto y bulto haya más
 * distancia que radio.
 */
const BROCCOLI = blob([80, 112, 22], [40, 86, 19], [56, 56, 20], [80, 46, 20], [104, 56, 20], [120, 86, 19]);

/**
 * Zanahoria: ancha de hombros y estrechándose al bajar, como la raíz. Tres
 * círculos cada vez más pequeños bastan para el cono (el penacho es detalle).
 */
const CARROT = blob([80, 58, 32], [80, 88, 25], [80, 116, 15]);

/** Semilla: una gota, estrecha arriba y llena abajo (el brote es detalle). */
const SEED = blob([80, 66, 22], [80, 102, 40]);

const DRAWINGS: Record<SkinId, Drawing> = {
  manzana: {
    centre: [80, 92],
    inside: APPLE,
    lit: moved(APPLE, -7, -10),
    dark: '#a82f36',
    light: '#d04048',
    spot: [56, 66, -30, 44, 76, 1],
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
  brocoli: {
    centre: [80, 88],
    inside: BROCCOLI,
    lit: moved(BROCCOLI, -9, -12),
    dark: '#36713a',
    light: '#54954d',
    spot: [50, 50, -30, 40, 70, 1],
    halo: false,
  },
  zanahoria: {
    centre: [80, 80],
    inside: CARROT,
    lit: moved(CARROT, -9, -11),
    dark: '#cf5f18',
    light: '#ef8726',
    spot: [44, 52, -30, 38, 62, 1],
    halo: false,
  },
  semilla: {
    centre: [80, 96],
    inside: SEED,
    lit: moved(SEED, -9, -12),
    dark: '#8a6334',
    light: '#b1854c',
    spot: [44, 54, -30, 38, 84, 1],
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

/**
 * Las orejas de gato, clavadas en el contorno en vez de colocadas a ojo.
 *
 * El problema de ponerlas con px desde el borde de la caja era que el cuerpo
 * no llega al borde de la caja, y lo que llega cambia con la skin: la oreja
 * flotaba sobre la manzana y se metía en el penacho de la piña. Aquí se mide
 * el contorno en el ángulo de cada oreja y se apoya la oreja ahí, con la base
 * hundida en el cuerpo y la punta hacia fuera por la normal. Como sale de la
 * geometría, también acompaña a la transformación de una skin en otra.
 */

/** El ángulo de cada oreja desde arriba: fuera del tallo y del penacho. */
const EAR_SPREAD = 0.66;
/** Lo que la punta se abre más que la base. */
const EAR_LEAN = 0.1;
/** Base, alto y hundimiento, como fracción del radio del cuerpo ahí. */
const EAR_HALF = 0.26;
const EAR_RISE = 0.5;
const EAR_SINK = 0.13;

/** El radio del contorno en un ángulo cualquiera, entre muestra y muestra. */
function radiusAt(radii: readonly number[], angle: number): number {
  const turn = (((angle / (2 * Math.PI)) % 1) + 1) % 1;
  const at = turn * radii.length;
  const low = Math.floor(at);
  return mix(radii[low % radii.length], radii[(low + 1) % radii.length], at - low);
}

export interface Ear {
  /** El triángulo de fuera, del color del cuerpo. */
  outer: string;
  /** El triángulo de dentro, rosa. */
  inner: string;
}

export function earsOf(geometry: Geometry): readonly Ear[] {
  return [-1, 1].map((side) => {
    const angle = -Math.PI / 2 + side * EAR_SPREAD;
    const radius = radiusAt(geometry.body, angle);
    const [nx, ny] = [Math.cos(angle), Math.sin(angle)];
    // La base se apoya en el contorno y se hunde un poco bajo él.
    const bx = geometry.cx + radius * (1 - EAR_SINK) * nx;
    const by = geometry.cy + radius * (1 - EAR_SINK) * ny;
    // La punta se inclina hacia fuera, no recta hacia arriba.
    const lean = angle + side * EAR_LEAN;
    const [ux, uy] = [Math.cos(lean), Math.sin(lean)];
    const [tx, ty] = [-uy, ux];
    const rise = radius * EAR_RISE;
    const half = radius * EAR_HALF;

    const point = (along: number, across: number) =>
      `${(bx + ux * rise * along + tx * across).toFixed(2)} ${(by + uy * rise * along + ty * across).toFixed(2)}`;
    const triangle = (from: number, to: number, width: number) =>
      `M${point(from, -width)}L${point(to, 0)}L${point(from, width)}Z`;

    return {
      outer: triangle(0, 1, half),
      inner: triangle(0.28, 0.72, half * 0.48),
    };
  });
}
