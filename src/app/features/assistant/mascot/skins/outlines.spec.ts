import { SAMPLES, earsOf, geometryOf, mixGeometry, outlinePath } from './outlines';
import { SKIN_IDS } from './types';

describe('geometrías procedurales', () => {
  it('cada skin mide su contorno y su zona iluminada', () => {
    for (const id of SKIN_IDS) {
      const geometry = geometryOf(id);

      expect(geometry.body.length).withContext(id).toBe(SAMPLES);
      expect(geometry.lit.length).withContext(id).toBe(SAMPLES);
      expect(geometry.body.every((radius) => radius > 0 && radius <= 120)).withContext(id).toBeTrue();
      expect(geometry.dark).withContext(id).toMatch(/^#[0-9a-f]{6}$/);
      expect(geometry.light).withContext(id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('mezcla dos geometrías punto a punto', () => {
    const from = geometryOf('manzana');
    const to = geometryOf('naranja');
    const mixed = mixGeometry(from, to, 0.5);

    expect(mixed.body.length).toBe(SAMPLES);
    expect(mixed.body[0]).toBeCloseTo((from.body[0] + to.body[0]) / 2, 5);
    expect(mixed.lit[0]).toBeCloseTo((from.lit[0] + to.lit[0]) / 2, 5);
  });

  it('genera un path cerrado con un punto por muestra', () => {
    const geometry = geometryOf('melon');
    const path = outlinePath(geometry.cx, geometry.cy, geometry.body);

    expect(path.startsWith('M')).toBeTrue();
    expect(path.endsWith('Z')).toBeTrue();
    expect(path.split('L').length).toBe(SAMPLES);
  });

  it('la caché devuelve la misma instancia para la misma skin', () => {
    expect(geometryOf('pina')).toBe(geometryOf('pina'));
  });
});

describe('orejas sobre el contorno', () => {
  /** Los tres vértices de un triángulo `M x y L x y L x y Z`. */
  const corners = (path: string): readonly (readonly [number, number])[] =>
    path
      .slice(1, -1)
      .split('L')
      .map((point) => point.split(' ').map(Number) as [number, number]);

  /** Hasta dónde llega el cuerpo en el ángulo de un punto. */
  const bodyAt = (geometry: ReturnType<typeof geometryOf>, x: number, y: number): number => {
    const angle = Math.atan2(y - geometry.cy, x - geometry.cx);
    const turn = (((angle / (2 * Math.PI)) % 1) + 1) % 1;
    return geometry.body[Math.round(turn * SAMPLES) % SAMPLES];
  };

  const away = (geometry: ReturnType<typeof geometryOf>, [x, y]: readonly [number, number]) =>
    Math.hypot(x - geometry.cx, y - geometry.cy) - bodyAt(geometry, x, y);

  it('cada skin lleva dos orejas clavadas en su cuerpo y asomando fuera', () => {
    for (const id of SKIN_IDS) {
      const geometry = geometryOf(id);
      const ears = earsOf(geometry);

      expect(ears.length).withContext(id).toBe(2);
      for (const ear of ears) {
        const [left, tip, right] = corners(ear.outer);

        // La base se hunde bajo el contorno: la oreja sale del cuerpo, no flota.
        expect(away(geometry, left)).withContext(`${id} base izquierda`).toBeLessThan(0);
        expect(away(geometry, right)).withContext(`${id} base derecha`).toBeLessThan(0);
        // La punta asoma por encima.
        expect(away(geometry, tip)).withContext(`${id} punta`).toBeGreaterThan(5);
      }
    }
  });

  it('las orejas de la izquierda y la derecha son simétricas', () => {
    const geometry = geometryOf('naranja');
    const [left, right] = earsOf(geometry).map((ear) => corners(ear.outer)[1]);

    expect(left[0] - geometry.cx).toBeCloseTo(geometry.cx - right[0], 5);
    expect(left[1]).toBeCloseTo(right[1], 5);
  });
});
