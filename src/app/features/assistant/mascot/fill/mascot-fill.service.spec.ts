import { TestBed } from '@angular/core/testing';

import { MascotFillService } from './mascot-fill.service';

/**
 * El estado del viaje se limpia al terminar: lo que quede encendido después
 * de un relleno se queda encendido para siempre.
 */
describe('MascotFillService: fin del relleno', () => {
  let fill: MascotFillService;

  beforeEach(() => {
    fill = TestBed.inject(MascotFillService);
  });

  it('apaga el anillo de pulsación al terminar', () => {
    fill.begin();
    fill.presses.set(3);

    fill.end();

    expect(fill.presses()).toBe(0);
    expect(fill.filling()).toBeFalse();
  });
});
