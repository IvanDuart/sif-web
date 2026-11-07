import { DOCK_BOTTOM, DOCK_RIGHT, dockPoint, publishDock } from './bar-dock';

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;

describe('dockPoint', () => {
  const viewport = { width: 1000, height: 800 };

  it('la mascota se monta sobre el borde izquierdo, mordiendo la tarjeta', () => {
    // Tarjeta de 400 px que acaba a 40 del borde derecho: empieza en 560.
    const point = dockPoint(rect(560, 600, 400, 160), rect(560, 700, 400, 60), viewport);
    // 560 - 24 de mordisco + 62 de ancho = 598 → 402 desde la derecha.
    expect(point.right).toBe(402);
  });

  it('se centra en la fila que importa, no en la tarjeta', () => {
    const card = rect(560, 600, 400, 200);
    const arriba = dockPoint(card, rect(560, 610, 400, 40), viewport);
    const abajo = dockPoint(card, rect(560, 740, 400, 40), viewport);
    // La fila de arriba deja la mascota más alta que la de abajo.
    expect(arriba.bottom).toBeGreaterThan(abajo.bottom);
    // Centro de la fila de abajo: 760. 800 - (760 + 31) = 9.
    expect(abajo.bottom).toBe(9);
  });

  it('una tarjeta que crece empuja la mascota hacia la izquierda', () => {
    const corta = dockPoint(rect(700, 600, 260, 60), rect(700, 600, 260, 60), viewport);
    const larga = dockPoint(rect(560, 600, 400, 60), rect(560, 600, 400, 60), viewport);
    expect(larga.right).toBeGreaterThan(corta.right);
  });
});

describe('publishDock', () => {
  afterEach(() => publishDock(null));

  it('deja el punto donde el FAB lo encuentra', () => {
    publishDock({ right: 402, bottom: 30 });
    expect(document.documentElement.style.getPropertyValue(DOCK_RIGHT)).toBe('402px');
    expect(document.documentElement.style.getPropertyValue(DOCK_BOTTOM)).toBe('30px');
  });

  it('al cerrarse lo retira: si no, la mascota se quedaría donde estuvo la tarjeta', () => {
    publishDock({ right: 402, bottom: 30 });
    publishDock(null);
    expect(document.documentElement.style.getPropertyValue(DOCK_RIGHT)).toBe('');
  });
});
