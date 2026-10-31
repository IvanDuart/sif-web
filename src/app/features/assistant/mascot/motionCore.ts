import { K } from './skins/faces';

/**
 * Las piezas de las que está hecha cada animación de la mascota: `anim`,
 * `later`, una pose para la duración de una escena y las capas sobre las que
 * actúan, más lo que lo detiene todo cuando la escena termina.
 */
export const inf = Infinity;

/** El punto de giro: los pies, a 99% de la altura del turner. */
export const FEET = '50% 99%';
export const BELOW_FEET = '50% 104%';

interface Eye {
  pos: SVGGElement;
  rect: SVGRectElement;
  arch: SVGPathElement;
  spin: SVGGElement;
  cheek: SVGEllipseElement | null;
}

export class Motion {
  private anims: Animation[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private restores: (() => void)[] = [];
  readonly turner: HTMLElement;
  readonly eyes: Eye[];

  constructor(
    readonly orb: HTMLElement,
    readonly on: boolean,
  ) {
    this.turner = orb.querySelector<HTMLElement>('[data-turner]')!;
    this.eyes = Array.from(orb.querySelectorAll<SVGGElement>('[data-eye]')).map((pos) => ({
      pos,
      rect: pos.querySelector<SVGRectElement>('[data-bar]')!,
      arch: pos.querySelector<SVGPathElement>('[data-arch]')!,
      spin: pos.querySelector<SVGGElement>('[data-spiral]')!,
      cheek: pos.querySelector<SVGEllipseElement>('[data-cheek]'),
    }));
  }

  $ = (name: string): (HTMLElement | SVGElement)[] =>
    Array.from(this.orb.querySelectorAll<HTMLElement | SVGElement>(`[data-o="${name}"]`));

  parts = (name: string): SVGElement[] =>
    Array.from(this.orb.querySelectorAll<SVGElement>(`[data-p~="${name}"]`));

  each(name: string, keyframes: Keyframe[], options: KeyframeAnimationOptions): void {
    this.parts(name).forEach((part) => this.anim(part, keyframes, options));
  }

  anim(el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | undefined {
    if (!this.on || !el || typeof el.animate !== 'function') return undefined;
    const animation = el.animate(keyframes, options);
    this.anims.push(animation);
    return animation;
  }

  later(ms: number, fn: () => void): void {
    if (this.on) this.timers.push(setTimeout(fn, ms));
  }

  /** Una pose que no es un estado de la cara: se pone y se restaura al terminar. */
  set(el: HTMLElement | SVGElement | null | undefined, property: string, value: string): void {
    if (!el) return;
    const before = el.style.getPropertyValue(property);
    el.style.setProperty(property, value);
    this.restores.push(() => el.style.setProperty(property, before));
  }

  static look = (x: number, y: number) => `translate(${x * K}px, ${y * K}px)`;

  stop(): void {
    this.anims.forEach((animation) => animation.cancel());
    this.timers.forEach(clearTimeout);
    this.restores.reverse().forEach((restore) => restore());
  }
}

/** Balanceo de lado a lado, `deg` a cada lado. */
export const swing = (deg: number): Keyframe[] => [
  { transform: `rotate(${-deg}deg)` },
  { transform: `rotate(${deg}deg)` },
  { transform: `rotate(${-deg}deg)` },
];

/** Un corazón (o cualquier cosa) que sube y se va. */
export function rise(m: Motion, el: Element | undefined, duration: number, delay: number, dx = 0, dy = -16): void {
  m.anim(
    el,
    [
      { offset: 0, opacity: 0, transform: 'translate(0,6px) scale(.5)' },
      { offset: 0.25, opacity: 1, transform: 'translate(0,0) scale(1)' },
      { offset: 1, opacity: 0, transform: `translate(${dx}px,${dy}px) scale(1.15)` },
    ],
    { duration, delay, iterations: inf, easing: 'ease-out' },
  );
}
