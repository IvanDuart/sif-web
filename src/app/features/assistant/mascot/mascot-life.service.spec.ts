import { TestBed } from '@angular/core/testing';

import { MascotLifeService, PHONE_AFTER_MS } from './mascot-life.service';

/**
 * Esperando una respuesta, la mascota saca el teléfono. Es la señal de que el
 * turno no está pensando: está esperándote a ti.
 */
describe('MascotLifeService: esperando una respuesta', () => {
  let life: MascotLifeService;

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({});
    life = TestBed.inject(MascotLifeService);
    TestBed.tick();
  });

  afterEach(() => jasmine.clock().uninstall());

  const esperar = (ms: number): void => {
    jasmine.clock().tick(ms);
    TestBed.tick();
  };

  it('en modo confirm, tras el tiempo de espera saca el teléfono sin mirar arriba', () => {
    life.mode.set('confirm');
    TestBed.tick();

    esperar(PHONE_AFTER_MS - 1);
    expect(life.life()).toBeNull();

    esperar(1);
    expect(life.life()).toEqual({ kind: 'phone', glance: false });
  });

  it('al contestar deja el teléfono inmediatamente', () => {
    life.mode.set('confirm');
    TestBed.tick();
    esperar(PHONE_AFTER_MS);
    expect(life.life()?.kind).toBe('phone');

    life.mode.set('thinking');
    TestBed.tick();

    expect(life.life()).toBeNull();
  });
});
