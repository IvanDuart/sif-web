import { ORB } from '../mascot/placement';

/**
 * Dónde se acopla la mascota dentro de la tarjeta.
 *
 * Se **mide**, no se calcula: lo que la tarjeta lleva dentro le cambia el alto
 * todo el rato (la cola, una respuesta larga, el campo que crece), y una
 * posición deducida de constantes se queda desfasada en cuanto aparece una
 * fila nueva. Así la mascota nunca se queda flotando fuera.
 *
 * Se acopla a la **fila que importa**: lo que dice o lo que está haciendo si
 * hay algo, y si no, la fila de escribir. Es la fila que la persona está
 * mirando, y la mascota mira hacia donde mira ella.
 */

/** Lo que la mascota entra dentro de la tarjeta por su borde izquierdo. */
const BITE = 24;

export const DOCK_RIGHT = '--mascot-dock-right';
export const DOCK_BOTTOM = '--mascot-dock-bottom';

export interface DockPoint {
  /** Desde el borde derecho de la ventana, en px. */
  right: number;
  /** Desde el borde inferior de la ventana, en px. */
  bottom: number;
}

/** El punto de acople a partir de la tarjeta y de la fila activa. */
export function dockPoint(
  card: DOMRect,
  row: DOMRect,
  viewport: { width: number; height: number },
): DockPoint {
  const middle = row.top + row.height / 2;
  return {
    right: Math.round(viewport.width - (card.left - BITE + ORB)),
    bottom: Math.round(viewport.height - (middle + ORB / 2)),
  };
}

/**
 * Publica el punto para que lo lea el FAB, que vive en otro componente.
 *
 * Va por variables CSS en la raíz y no por un servicio con signals porque lo
 * único que hace falta es que el FAB se coloque: con CSS la transición la
 * lleva el navegador y no hay un render de Angular por cada píxel.
 */
export function publishDock(point: DockPoint | null): void {
  const root = document.documentElement;
  if (!point) {
    root.style.removeProperty(DOCK_RIGHT);
    root.style.removeProperty(DOCK_BOTTOM);
    return;
  }
  root.style.setProperty(DOCK_RIGHT, `${point.right}px`);
  root.style.setProperty(DOCK_BOTTOM, `${point.bottom}px`);
}
