import { EYE_H, EYE_W, FACES } from './faces';
import { geometryOf, SAMPLES } from './outlines';
import { SKIN_IDS } from './types';

/** La caja de dibujo es 160×160 y todos los cuerpos son simétricos respecto de su mitad. */
const MIDDLE = 80;

/** `true` si (x, y) cae dentro del contorno medido de esa skin. */
function inside(id: (typeof SKIN_IDS)[number], x: number, y: number): boolean {
  const { cx, cy, body } = geometryOf(id);
  const [dx, dy] = [x - cx, y - cy];
  const angle = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
  const at = Math.round((angle / (2 * Math.PI)) * SAMPLES) % SAMPLES;
  return Math.hypot(dx, dy) <= body[at];
}

describe('la cara de cada skin', () => {
  it('tiene los dos ojos a la misma distancia del centro', () => {
    for (const id of SKIN_IDS) {
      const [[leftX, leftY], [rightX, rightY]] = FACES[id].eyes;

      expect(leftY).withContext(id).toBe(rightY);
      expect(leftX + EYE_W / 2 - MIDDLE)
        .withContext(id)
        .toBeCloseTo(MIDDLE - (rightX + EYE_W / 2), 5);
    }
  });

  it('dibuja los dos ojos dentro del cuerpo', () => {
    for (const id of SKIN_IDS) {
      for (const [left, top] of FACES[id].eyes) {
        for (const x of [left, left + EYE_W]) {
          for (const y of [top, top + EYE_H]) {
            expect(inside(id, x, y))
              .withContext(`${id} en (${x}, ${y})`)
              .toBeTrue();
          }
        }
      }
    }
  });
});
