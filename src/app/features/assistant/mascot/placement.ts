/**
 * Dónde se pone la mascota para atender a un campo, sin tapar lo que hace
 * falta leer.
 *
 * Es geometría pura: entran cajas y sale una posición. Ni toca el DOM ni sabe
 * de Angular, así que los casos raros —un campo pegado al borde, un aviso
 * abajo, un área de texto de diez líneas— se prueban sin montar nada.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Lo que mide el botón de la mascota. */
export const ORB = 62;
/** Lo que deja entre ella y el campo. */
const GAP = 14;
/** Lo que deja con los bordes de la ventana. */
const MARGIN = 8;
/** Su sitio de siempre, respecto de la esquina. */
const REST = 24;
/**
 * A partir de este alto, un campo es un área de texto: la mascota se pone a la
 * altura de su PRIMERA línea y no en su mitad, que en un campo de diez líneas
 * cae muy por debajo de donde se está escribiendo.
 */
const TALL = 120;
const FIRST_LINE = 30;

export interface Spot {
  left: number;
  top: number;
}

/** Su sitio de siempre: la esquina de abajo a la derecha. */
export function restingSpot(viewport: Viewport): Spot {
  return { left: viewport.width - REST - ORB, top: viewport.height - REST - ORB };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

/**
 * Dónde ponerse para atender a ese campo.
 *
 * A su izquierda, que es donde menos tapa: a la derecha suelen estar la ayuda
 * del campo y el error. Si a la izquierda no cabe, a la derecha. Y siempre
 * dentro de la ventana.
 *
 * `avoid` son las cajas que no debe tapar —un aviso, el campo mismo—: si la
 * posición elegida pisa alguna, sube por encima de ella.
 */
export function orbBeside(field: Box, viewport: Viewport, avoid: readonly Box[] = []): Spot {
  const toTheLeft = field.left - GAP - ORB;
  const wanted = toTheLeft >= MARGIN ? toTheLeft : field.left + field.width + GAP;
  const left = clamp(wanted, MARGIN, viewport.width - ORB - MARGIN);

  // Un campo alto se atiende por arriba, donde se está escribiendo.
  const middle = field.height > TALL ? field.top + FIRST_LINE : field.top + field.height / 2;
  let top = clamp(middle - ORB / 2, MARGIN, viewport.height - ORB - MARGIN);

  for (const box of avoid) {
    if (!overlaps({ left, top, width: ORB, height: ORB }, box)) continue;
    // Por encima del estorbo; y si arriba no cabe, por debajo.
    const above = box.top - GAP - ORB;
    top = above >= MARGIN ? above : clamp(box.top + box.height + GAP, MARGIN, viewport.height - ORB - MARGIN);
  }

  return { left, top };
}

/**
 * El desplazamiento desde su sitio de siempre, que es lo que entiende el
 * `transform` del botón: se mueve con una transición, sin recolocarse.
 */
export function travelFrom(spot: Spot, viewport: Viewport): { x: number; y: number } {
  const rest = restingSpot(viewport);
  return { x: spot.left - rest.left, y: spot.top - rest.top };
}
