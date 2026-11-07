import { ORB, orbBeside, restingSpot, travelFrom, type Box } from './placement';

describe('colocación de la mascota', () => {
  const viewport = { width: 1200, height: 800 };
  const field = (over: Partial<Box> = {}): Box => ({ left: 500, top: 400, width: 200, height: 40, ...over });

  it('se pone a la izquierda del campo, que es donde menos tapa', () => {
    const spot = orbBeside(field(), viewport);
    expect(spot.left).toBe(500 - 14 - ORB);
    // Centrada en el campo.
    expect(spot.top).toBe(400 + 20 - ORB / 2);
  });

  it('si a la izquierda no cabe, se pasa a la derecha', () => {
    const spot = orbBeside(field({ left: 10 }), viewport);
    expect(spot.left).toBe(10 + 200 + 14);
  });

  it('nunca se sale de la ventana', () => {
    const pegado = orbBeside(field({ left: 1190, width: 10 }), viewport);
    expect(pegado.left).toBeLessThanOrEqual(viewport.width - ORB - 8);
    const arriba = orbBeside(field({ top: -50 }), viewport);
    expect(arriba.top).toBeGreaterThanOrEqual(8);
  });

  it('un área de texto se atiende por su primera línea, no por su mitad', () => {
    const alto = orbBeside(field({ top: 200, height: 300 }), viewport);
    const bajo = orbBeside(field({ top: 200, height: 40 }), viewport);
    // En un campo de diez líneas, la mitad cae muy por debajo de donde se escribe.
    expect(alto.top).toBeLessThan(200 + 300 / 2);
    expect(bajo.top).toBe(200 + 20 - ORB / 2);
  });

  it('no se queda encima de un aviso: se sube por encima', () => {
    const aviso: Box = { left: 400, top: 380, width: 400, height: 60 };
    const spot = orbBeside(field(), viewport, [aviso]);
    expect(spot.top + ORB).toBeLessThanOrEqual(aviso.top);
  });

  it('si por encima del aviso no cabe, se va por debajo', () => {
    const aviso: Box = { left: 400, top: 0, width: 400, height: 90 };
    const spot = orbBeside(field({ top: 40, height: 40 }), viewport, [aviso]);
    expect(spot.top).toBeGreaterThanOrEqual(aviso.top + aviso.height);
  });

  it('lo que no estorba no la mueve', () => {
    const lejos: Box = { left: 0, top: 0, width: 50, height: 50 };
    expect(orbBeside(field(), viewport, [lejos])).toEqual(orbBeside(field(), viewport));
  });

  it('el viaje se cuenta desde su esquina de siempre', () => {
    const rest = restingSpot(viewport);
    expect(rest).toEqual({ left: 1200 - 24 - ORB, top: 800 - 24 - ORB });
    expect(travelFrom(rest, viewport)).toEqual({ x: 0, y: 0 });
    expect(travelFrom({ left: rest.left - 100, top: rest.top - 50 }, viewport)).toEqual({ x: -100, y: -50 });
  });
});
