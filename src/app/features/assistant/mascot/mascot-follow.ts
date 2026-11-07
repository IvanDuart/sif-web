/**
 * La mascota acompaña el cambio de sección.
 *
 * Cuando se pulsa una entrada del menú, la pantalla entera se sustituye. La
 * mascota se queda en su esquina, pero no se queda quieta: **mira** hacia la
 * entrada que se ha elegido, se agacha y salta cuando la pantalla nueva ya
 * está. Es lo que la convierte en alguien que estaba mirando, y no en un
 * dibujo pegado encima.
 *
 * Esto es la coreografía, y nada más: ni toca el DOM ni sabe de rutas. Entra
 * hacia dónde mirar y sale una lista de poses con sus tiempos, así que los
 * tiempos se leen de un vistazo y se prueban sin montar nada.
 */

export interface FollowPose {
  /** Hacia dónde se inclina, px. Negativo es hacia el menú, a la izquierda. */
  lean: number;
  /** Lo que sube (negativo) o baja desde su sitio, px. */
  lift: number;
  /** Cuánto se achata y se estira, en x e y. */
  squash: readonly [number, number];
  /** Cómo llega hasta aquí: duración y curva de CSS. */
  ease: string;
}

/** Quieta en su sitio. */
export const REST_POSE: FollowPose = {
  lean: 0,
  lift: 0,
  squash: [1, 1],
  ease: '280ms cubic-bezier(0.34, 1.4, 0.6, 1)',
};

/** A los `ms` del principio, ponte así. `null` es «se acabó, a tu sitio». */
export type FollowStep = readonly [ms: number, pose: FollowPose | null];

const SPRING = 'cubic-bezier(0.34, 1.6, 0.6, 1)';
const POP = 'cubic-bezier(0.2, 0.8, 0.3, 1)';

/** Lo más que se inclina: más que esto deja de parecer que mira y parece que se cae. */
const MAX_LEAN = 10;

/**
 * Cuánto se inclina hacia la entrada elegida.
 *
 * Es un gesto, no un viaje: la mascota no va hasta el menú, sólo se asoma
 * hacia él. Por eso el resultado está acotado y no crece con la distancia.
 */
export function leanTowards(orbCentreX: number, entryCentreX: number): number {
  const towards = entryCentreX - orbCentreX;
  if (towards === 0) return 0;
  return Math.max(-MAX_LEAN, Math.min(MAX_LEAN, towards / 40));
}

/**
 * La rutina entera: mira, se agacha, salta, aterriza y vuelve a su sitio.
 *
 * El salto va DESPUÉS de agacharse y no a la vez, que es lo que hace que se
 * lea como un salto y no como un rebote.
 */
export function sectionSteps(lean: number): readonly FollowStep[] {
  return [
    // Mira hacia donde se ha pulsado.
    [0, { lean, lift: 0, squash: [1.04, 0.98], ease: `160ms ${POP}` }],
    // Se agacha: toma impulso.
    [170, { lean, lift: 2, squash: [1.14, 0.86], ease: `130ms ${POP}` }],
    // Y salta.
    [310, { lean: lean / 2, lift: -22, squash: [0.9, 1.12], ease: `210ms ${SPRING}` }],
    // Aterriza, con su achatado.
    [530, { lean: 0, lift: 0, squash: [1.1, 0.9], ease: `140ms ${POP}` }],
    // A su sitio.
    [680, null],
  ];
}

/** Lo que dura la rutina entera. */
export function stepsDuration(steps: readonly FollowStep[]): number {
  return steps.length === 0 ? 0 : steps[steps.length - 1][0];
}

/** La pose como `transform` de CSS, en el orden en que se aplica. */
export function poseTransform(pose: FollowPose, travel: { x: number; y: number } | null): string {
  const base = travel ? `translate(${travel.x.toFixed(1)}px, ${travel.y.toFixed(1)}px)` : '';
  const move = `translate(${pose.lean.toFixed(1)}px, ${pose.lift.toFixed(1)}px)`;
  const scale = `scale(${pose.squash[0]}, ${pose.squash[1]})`;
  return [base, move, scale].filter((part) => part !== '').join(' ');
}
