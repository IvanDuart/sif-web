import { ORB, beside } from './mascot-launcher';

/** Un campo colocado a mano en la pantalla. */
function fieldAt(left: number, top: number, width = 200, height = 40): HTMLElement {
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
  return element;
}

/** Dónde acaba la mascota en la pantalla, deshaciendo el desplazamiento desde su esquina. */
function landsAt(target: HTMLElement): { left: number; top: number } {
  const { x, y } = beside(target);
  return {
    left: window.innerWidth - 24 - ORB + x,
    top: window.innerHeight - 24 - ORB + y,
  };
}

describe('dónde se pone la mascota para atender un campo', () => {
  it('se pone a su izquierda, que es donde menos tapa', () => {
    const left = 400;
    expect(landsAt(fieldAt(left, 300)).left).toBe(left - 14 - ORB);
  });

  it('se pasa a su derecha cuando contra el borde no cabe', () => {
    const target = fieldAt(10, 300);
    expect(landsAt(target).left).toBe(10 + 200 + 14);
  });

  it('se centra con el campo a lo alto', () => {
    const top = 300;
    const height = 40;
    expect(landsAt(fieldAt(400, top, 200, height)).top).toBe(top + height / 2 - ORB / 2);
  });

  it('no se sale de la pantalla por un campo que asoma por arriba', () => {
    expect(landsAt(fieldAt(400, -30)).top).toBeGreaterThanOrEqual(8);
  });

  it('no se sale de la pantalla por un campo que asoma por abajo', () => {
    const landed = landsAt(fieldAt(400, window.innerHeight + 50));
    expect(landed.top).toBeLessThanOrEqual(window.innerHeight - ORB - 8);
  });
});
