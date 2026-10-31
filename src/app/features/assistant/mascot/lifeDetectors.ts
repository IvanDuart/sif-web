/**
 * Cómo la mascota sabe qué le está haciendo la persona. Puro y con reloj
 * inyectado, para poder probarlo sin puntero.
 */

/** Pulsaciones en una ráfaga antes de considerarlo "demasiadas", y su ventana. */
export const CLICK_BURST = { count: 5, windowMs: 1500 } as const;

/** Reversiones de dirección (izquierda-derecha-izquierda…) que hacen un mimo, su ventana y el recorrido mínimo. */
export const PETTING = { reversals: 4, windowMs: 1100, minTravel: 4 } as const;

export interface ClickBurstDetector {
  /** Registra una pulsación; `true` cuando fue la que completa la ráfaga (el detector empieza de nuevo). */
  press(now: number): boolean;
  reset(): void;
}

/** Muchas pulsaciones en poco tiempo: la mascota se marea. */
export function createClickBurstDetector(
  config: { count: number; windowMs: number } = CLICK_BURST,
): ClickBurstDetector {
  let times: number[] = [];
  return {
    press(now) {
      times = [...times.filter((time) => now - time <= config.windowMs), now];
      if (times.length < config.count) return false;
      times = [];
      return true;
    },
    reset() {
      times = [];
    },
  };
}

export interface PettingDetector {
  /** Registra dónde está el puntero; `true` cuando este movimiento completa un mimo (el detector empieza de nuevo). */
  move(x: number, now: number): boolean;
  reset(): void;
}

/** Acariciarla: el puntero va y viene por encima, rápido. */
export function createPettingDetector(
  config: { reversals: number; windowMs: number; minTravel: number } = PETTING,
): PettingDetector {
  let anchor: number | null = null;
  let direction = 0;
  let reversals: number[] = [];
  const reset = () => {
    anchor = null;
    direction = 0;
    reversals = [];
  };
  return {
    reset,
    move(x, now) {
      if (anchor === null) {
        anchor = x;
        return false;
      }
      const delta = x - anchor;
      if (direction === 0) {
        if (Math.abs(delta) >= config.minTravel) {
          direction = Math.sign(delta);
          anchor = x;
        }
        return false;
      }
      if (delta * direction > 0) {
        anchor = x;
        return false;
      }
      if (Math.abs(delta) < config.minTravel) return false;
      direction = -direction;
      anchor = x;
      reversals = [...reversals.filter((time) => now - time <= config.windowMs), now];
      if (reversals.length < config.reversals) return false;
      reset();
      return true;
    },
  };
}
