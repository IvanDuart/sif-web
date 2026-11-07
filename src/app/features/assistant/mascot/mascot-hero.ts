/**
 * El modo héroe: el huevo de pascua de la mascota.
 *
 * No lleva disfraz propio por fruta, que sería siete dibujos nuevos para algo
 * que casi nadie va a ver. Es **un solo gesto**, con lo que el orbe ya tiene:
 * se hincha, despega, se queda arriba un momento con una capa del color de su
 * fruta y suelta las estrellas. Se entiende igual y no deja arte que mantener.
 *
 * Esto es sólo la coreografía y cómo se dispara. Que exista, y que se pueda
 * apagar, lo decide quien lo monta.
 */

/**
 * Dónde se apaga.
 *
 * Local y no en las preferencias del centro: es un huevo de pascua, y pedirle
 * al backend una columna para esconder un chiste sería desproporcionado. Viene
 * encendido; `localStorage['mascot-hero'] = '0'` lo apaga.
 */
export const HERO_KEY = 'mascot-hero';

export function heroEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(HERO_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Clics seguidos con Alt para que aparezca. */
export const HERO_CLICKS = 3;
/** Más de esto entre clic y clic ya no es la misma intención. */
export const HERO_WINDOW_MS = 600;
/** Lo que dura el vuelo entero. */
export const HERO_MS = 2800;

/** Cuenta los clics con Alt y avisa cuando son los tres. */
export class HeroSecret {
  private clicks = 0;
  private last = 0;

  /** Devuelve `true` justo en el clic que lo desbloquea. */
  press(event: { altKey: boolean }, now: number): boolean {
    if (!event.altKey) {
      this.clicks = 0;
      return false;
    }
    this.clicks = now - this.last > HERO_WINDOW_MS ? 1 : this.clicks + 1;
    this.last = now;
    if (this.clicks < HERO_CLICKS) return false;
    this.clicks = 0;
    return true;
  }
}

export interface HeroPose {
  /** Dónde está respecto de su esquina, px. Negativo es izquierda y arriba. */
  x: number;
  y: number;
  /** Cuánto se achata y se estira. */
  squash: readonly [number, number];
  /** Lo que se inclina hacia donde vuela, grados. */
  tilt: number;
  /** La capa, de 0 a 1. */
  cape: number;
  ease: string;
}

export const HERO_REST: HeroPose = { x: 0, y: 0, squash: [1, 1], tilt: 0, cape: 0, ease: '240ms ease-out' };

export type HeroStep = readonly [ms: number, pose: HeroPose | null];

const LAUNCH = 'cubic-bezier(0.3, 0, 0.2, 1)';
const GLIDE = 'cubic-bezier(0.4, 0, 0.6, 1)';
const FALL = 'cubic-bezier(0.5, 0, 0.75, 1)';

export interface Viewport {
  width: number;
  height: number;
}

/** Lo que deja con los bordes al volar: no se sale de la pantalla. */
const EDGE = 90;

/**
 * El vuelo: cruza la pantalla.
 *
 * No es un salto. Despega hacia arriba a la izquierda, **atraviesa la pantalla
 * entera** por arriba, se queda un momento al otro lado y vuelve en picado a
 * su esquina. Un héroe que da un brinco de 38 px no es un héroe.
 *
 * Las posiciones salen del tamaño de la ventana, no de constantes: en un
 * portátil y en un monitor grande tiene que cruzar lo mismo, que es «todo».
 */
export function heroSteps(viewport: Viewport): readonly HeroStep[] {
  // Su esquina está abajo a la derecha, así que cruzar es ir hacia -x y -y.
  const far = -(viewport.width - EDGE * 2);
  const high = -(viewport.height - EDGE * 2);
  const pose = (over: Partial<HeroPose>): HeroPose => ({ ...HERO_REST, ...over });

  return [
    // Toma impulso.
    [0, pose({ y: 6, squash: [1.2, 0.8], ease: `180ms ${LAUNCH}` })],
    // Despega en diagonal, y ahí sale la capa.
    [190, pose({ x: far * 0.25, y: high * 0.55, squash: [0.84, 1.2], tilt: -18, cape: 1, ease: `420ms ${LAUNCH}` })],
    // Cruza la pantalla por arriba.
    [620, pose({ x: far * 0.9, y: high * 0.78, squash: [0.9, 1.1], tilt: -8, cape: 1, ease: `700ms ${GLIDE}` })],
    // Se queda al otro lado, para que dé tiempo a verla.
    [1340, pose({ x: far * 0.95, y: high * 0.72, squash: [1, 1], tilt: 0, cape: 1, ease: `600ms ease-in-out` })],
    // Y vuelve en picado.
    [1960, pose({ x: far * 0.3, y: high * 0.3, squash: [0.92, 1.1], tilt: 16, cape: 1, ease: `420ms ${FALL}` })],
    // Aterriza en su sitio.
    [2380, pose({ squash: [1.16, 0.86], cape: 0.2, ease: `220ms ${FALL}` })],
    [2600, pose({ squash: [1, 1], ease: `200ms ease-out` })],
    [HERO_MS, null],
  ];
}

/** La pose como `transform`, para componerla con lo demás. */
export function heroTransform(pose: HeroPose): string {
  return [
    `translate(${pose.x.toFixed(1)}px, ${pose.y.toFixed(1)}px)`,
    pose.tilt === 0 ? '' : `rotate(${pose.tilt.toFixed(1)}deg)`,
    `scale(${pose.squash[0]}, ${pose.squash[1]})`,
  ]
    .filter((part) => part !== '')
    .join(' ');
}
