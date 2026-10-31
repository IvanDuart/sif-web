import { BELOW_FEET, FEET, Motion, inf, rise, swing } from './motionCore';
import type { SkinId } from './skins/types';

/**
 * El movimiento de la mascota. `MascotOrb` dibuja qué ojos tiene en cada
 * estado; esto es solo lo que se mueve por su cuenta mientras dura la escena.
 * Sin movimiento (`still`) solo se aplica la pose quieta de la escena.
 */
export type LifeScene = 'spin' | 'dizzy' | 'blush' | 'angry' | 'phone' | 'sleep';
export type MoodKind = 'worried' | 'cheer' | 'highfive' | 'welcome' | 'proud';
export type Condition = 'offline' | 'tired';
export type Scene = LifeScene | MoodKind | Condition;

const LIFE_SCENES: readonly string[] = ['spin', 'dizzy', 'blush', 'angry', 'phone', 'sleep'];
const CONDITIONS: readonly string[] = ['offline', 'tired'];

function spin(m: Motion): void {
  m.anim(
    m.orb,
    [
      { offset: 0, transform: 'translateY(0)' },
      { offset: 0.35, transform: 'translateY(-8px)' },
      { offset: 0.7, transform: 'translateY(1px)' },
      { offset: 1, transform: 'translateY(0)' },
    ],
    { duration: 1100, delay: 250, easing: 'ease-in-out' },
  );
  m.anim(m.turner, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
    duration: 900,
    delay: 250,
    easing: 'cubic-bezier(.45,0,.25,1)',
  });
}

function dizzy(m: Motion): void {
  m.eyes.forEach((eye, index) =>
    m.anim(eye.spin, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${index ? -360 : 360}deg)` }], {
      duration: 700,
      iterations: inf,
    }),
  );
  const N = 36;
  const ORBIT = 1400;
  const orbit = Array.from({ length: N + 1 }, (_, k) => {
    const t = (k / N) * Math.PI * 2;
    const front = (Math.sin(t) + 1) / 2;
    return {
      offset: k / N,
      transform: `translate(${24 + 30 * Math.cos(t)}px,${6 + 8 * Math.sin(t)}px) scale(${(0.6 + 0.5 * front).toFixed(3)})`,
      opacity: (0.35 + 0.65 * front).toFixed(3),
    };
  });
  m.$('star').forEach((star, n) => {
    if (!m.on) {
      const at = orbit[Math.round((n * N) / 3)];
      m.set(star, 'transform', at.transform);
      m.set(star, 'opacity', at.opacity);
    }
    m.anim(star, orbit, { duration: ORBIT, delay: (-n * ORBIT) / 3, iterations: inf });
  });
  m.anim(
    m.orb,
    [{ transform: 'translateX(-2px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(-2px)' }],
    { duration: 450, iterations: inf, easing: 'ease-in-out' },
  );
  m.set(m.turner, 'transform-origin', FEET);
  m.anim(m.turner, swing(8), { duration: 450, iterations: inf, easing: 'ease-in-out' });
}

function phone(m: Motion): void {
  m.set(m.turner, 'transform-origin', FEET);
  m.set(m.turner, 'transform', 'rotate(-9deg)');
  const ph = m.$('phone')[0] as HTMLElement | undefined;
  if (!ph) return;
  m.set(ph, 'opacity', '1');
  m.anim(
    ph,
    [
      { opacity: 0, transform: 'translate(8px,10px) rotate(48deg) scale(.6)' },
      { opacity: 1, transform: 'translate(0,0) rotate(30deg) scale(1)' },
    ],
    { duration: 320, easing: 'ease-out', fill: 'backwards' },
  );
}

function sleep(m: Motion): void {
  m.set(m.turner, 'transform-origin', FEET);
  m.set(m.turner, 'transform', 'rotate(17deg)');
  const zs = m.$('z');
  if (!m.on) {
    zs.forEach((z, n) => {
      m.set(z, 'opacity', '0.9');
      m.set(z, 'transform', `translate(${n * 3}px,${-n * 6}px)`);
    });
    return;
  }
  m.anim(m.orb, [{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }], {
    duration: 3600,
    iterations: inf,
    easing: 'ease-in-out',
  });
  zs.forEach((z, n) =>
    m.anim(
      z,
      [
        { offset: 0, opacity: 0, transform: 'translate(0,0) scale(.55)' },
        { offset: 0.2, opacity: 0.95 },
        { offset: 1, opacity: 0, transform: 'translate(7px,-14px) scale(1.1)' },
      ],
      { duration: 3000, delay: n * 1000, iterations: inf, easing: 'ease-out' },
    ),
  );
}

function blush(m: Motion): void {
  const hearts = m.$('heart');
  if (!m.on) {
    hearts.forEach((heart) => m.set(heart, 'opacity', '0.9'));
    return;
  }
  m.eyes.forEach((eye) =>
    m.anim(
      eye.cheek,
      [
        { opacity: 0, transform: 'scale(.4)' },
        { opacity: 0.9, transform: 'scale(1)' },
      ],
      { duration: 260, easing: 'ease-out', fill: 'backwards' },
    ),
  );
  m.set(m.turner, 'transform-origin', BELOW_FEET);
  m.anim(m.turner, swing(4), { duration: 2400, iterations: inf, easing: 'ease-in-out' });
  hearts.forEach((heart, n) => rise(m, heart, 2200, n * 320, (n - 1) * 4, -16));
}

function angry(m: Motion): void {
  m.$('mark').forEach((mark) =>
    m.anim(mark, [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], {
      duration: 600,
      iterations: inf,
      easing: 'ease-in-out',
    }),
  );
  m.anim(
    m.orb,
    [{ transform: 'translateX(-2px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(-2px)' }],
    { duration: 140, iterations: inf, easing: 'ease-in-out' },
  );
  m.$('puff').forEach((puff, n) =>
    m.anim(
      puff,
      [
        { offset: 0, opacity: 0, transform: 'translate(0,0) scale(.4)' },
        { offset: 0.2, opacity: 0.9 },
        { offset: 1, opacity: 0, transform: `translate(${n ? 6 : -6}px,-8px) scale(1.4)` },
      ],
      { duration: 2600, delay: n * 160, iterations: inf, easing: 'ease-out' },
    ),
  );
}

function cheer(m: Motion): void {
  m.anim(
    m.orb,
    [
      { offset: 0, transform: 'translateY(0) scale(1)' },
      { offset: 0.3, transform: 'translateY(-12px) scale(1.06)' },
      { offset: 0.6, transform: 'translateY(0) scale(.98,1.02)' },
      { offset: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: 900, easing: 'ease-out' },
  );
  m.$('spark').forEach((spark, n) =>
    m.anim(
      spark,
      [
        { offset: 0, opacity: 0, transform: 'scale(.3) rotate(0deg)' },
        { offset: 0.4, opacity: 1, transform: 'scale(1.1) rotate(45deg)' },
        { offset: 1, opacity: 0, transform: 'scale(.3) rotate(90deg)' },
      ],
      { duration: 900, delay: n * 120, iterations: inf, easing: 'ease-in-out' },
    ),
  );
}

function worried(m: Motion): void {
  m.set(m.turner, 'transform-origin', FEET);
  m.anim(m.turner, swing(2.5), { duration: 1600, iterations: inf, easing: 'ease-in-out' });
  m.$('sweat').forEach((drop) =>
    m.anim(
      drop,
      [
        { offset: 0, opacity: 0, transform: 'translateY(-4px) scale(.6)' },
        { offset: 0.35, opacity: 1, transform: 'translateY(0) scale(1)' },
        { offset: 1, opacity: 0, transform: 'translateY(8px) scale(.8)' },
      ],
      { duration: 1800, iterations: inf, easing: 'ease-in' },
    ),
  );
}

function welcome(m: Motion): void {
  m.set(m.turner, 'transform-origin', FEET);
  m.anim(
    m.orb,
    [
      { offset: 0, transform: 'scale(1)' },
      { offset: 0.3, transform: 'scale(1.08,.92)' },
      { offset: 0.6, transform: 'scale(.96,1.06)' },
      { offset: 1, transform: 'scale(1)' },
    ],
    { duration: 900, easing: 'ease-in-out' },
  );
}

function proud(m: Motion): void {
  m.anim(
    m.orb,
    [
      { offset: 0, transform: 'translateY(0)' },
      { offset: 0.5, transform: 'translateY(-4px)' },
      { offset: 1, transform: 'translateY(0)' },
    ],
    { duration: 1800, iterations: inf, easing: 'ease-in-out' },
  );
}

function highfive(m: Motion): void {
  m.anim(
    m.orb,
    [
      { offset: 0, transform: 'translateY(0) scale(1)' },
      { offset: 0.4, transform: 'translateY(-8px) scale(1.08)' },
      { offset: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: 600, easing: 'ease-out' },
  );
}

function offline(m: Motion): void {
  m.set(m.turner, 'filter', 'grayscale(.6) brightness(.85)');
  m.set(m.orb, 'opacity', '0.65');
}

function tired(m: Motion): void {
  m.set(m.turner, 'transform-origin', FEET);
  m.set(m.turner, 'transform', 'rotate(6deg)');
  m.set(m.orb, 'opacity', '0.8');
}

/** Aplica la animación de la escena al orb; devuelve lo que la detiene y restaura. */
export function startMotion(orb: HTMLElement, scene: Scene, skin: SkinId, still: boolean): () => void {
  const m = new Motion(orb, !still);
  if (!LIFE_SCENES.includes(scene)) {
    if (CONDITIONS.includes(scene)) {
      if (scene === 'offline') offline(m);
      else tired(m);
    } else {
      switch (scene as MoodKind) {
        case 'worried':
          worried(m);
          break;
        case 'cheer':
          cheer(m);
          break;
        case 'highfive':
          highfive(m);
          break;
        case 'welcome':
          welcome(m);
          break;
        case 'proud':
          proud(m);
          break;
      }
    }
    return () => m.stop();
  }
  switch (scene as LifeScene) {
    case 'spin':
      spin(m);
      break;
    case 'dizzy':
      dizzy(m);
      break;
    case 'blush':
      blush(m);
      break;
    case 'angry':
      angry(m);
      break;
    case 'phone':
      phone(m);
      break;
    case 'sleep':
      sleep(m);
      break;
  }
  return () => m.stop();
}

/** El parpadeo: cada ojo se cierra a `.15` de lo que está abierto, cada 4.5 s. */
export function startBlink(orb: HTMLElement, s: number): () => void {
  const animations = Array.from(orb.querySelectorAll<SVGRectElement>('[data-eye] [data-bar]')).flatMap((rect) =>
    typeof rect.animate === 'function'
      ? [
          rect.animate(
            [
              { offset: 0, transform: `scaleY(${s})` },
              { offset: 0.92, transform: `scaleY(${s})` },
              { offset: 0.96, transform: `scaleY(${0.15 * s})` },
              { offset: 1, transform: `scaleY(${s})` },
            ],
            { duration: 4500, iterations: inf },
          ),
        ]
      : [],
  );
  return () => animations.forEach((animation) => animation.cancel());
}
