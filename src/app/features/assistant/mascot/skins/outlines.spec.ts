import { SAMPLES, geometryOf, mixGeometry, outlinePath } from './outlines';
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
