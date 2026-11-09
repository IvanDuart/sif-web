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
  move(x: number, now: number, y?: number): boolean;
  reset(): void;
}

/** Acariciarla: el puntero va y viene por encima, rápido. En cualquier dirección. */
export function createPettingDetector(
  config: { reversals: number; windowMs: number; minTravel: number } = PETTING,
): PettingDetector {
  let anchor: { x: number; y: number } | null = null;
  /** El último rumbo tomado, como vector. Un cambio de signo es un mimo. */
  let direction: { x: number; y: number } | null = null;
  let reversals: number[] = [];
  const reset = () => {
    anchor = null;
    direction = null;
    reversals = [];
  };
  return {
    reset,
    move(x, now, y = 0) {
      if (anchor === null) {
        anchor = { x, y };
        return false;
      }
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      if (direction === null) {
        if (Math.hypot(dx, dy) >= config.minTravel) {
          direction = { x: dx, y: dy };
          anchor = { x, y };
        }
        return false;
      }
      // Producto escalar: negativo significa que va en contra del rumbo
      // anterior, en horizontal, vertical o diagonal.
      const dot = dx * direction.x + dy * direction.y;
      if (dot >= 0) {
        anchor = { x, y };
        return false;
      }
      if (Math.hypot(dx, dy) < config.minTravel) return false;
      direction = { x: -direction.x, y: -direction.y };
      anchor = { x, y };
      reversals = [...reversals.filter((time) => now - time <= config.windowMs), now];
      if (reversals.length < config.reversals) return false;
      reset();
      return true;
    },
  };
}
