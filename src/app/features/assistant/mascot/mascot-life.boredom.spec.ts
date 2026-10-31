import { TestBed } from '@angular/core/testing';

import { BORED_AFTER_MS, BORED_PHONE_MS, MascotLifeService } from './mascot-life.service';

/** Lo que sobra del rango aleatorio de aburrimiento, con `Math.random()` fijado. */
const RANGE_MS = 20_000;

/**
 * Si nadie le hace caso, la mascota se busca la vida: unas veces saca el
 * teléfono y acaba dormida, otras se duerme directamente. En cuanto le vuelven
 * a hacer caso, despierta.
 */
describe('MascotLifeService: cuando no le hacen caso', () => {
  let life: MascotLifeService;
  let random = 0.5;

  beforeEach(() => {
    jasmine.clock().install();
    spyOn(Math, 'random').and.callFake(() => random);
    TestBed.configureTestingModule({});
    life = TestBed.inject(MascotLifeService);
    TestBed.tick();
  });

  afterEach(() => jasmine.clock().uninstall());

  /** Deja pasar el tiempo y vuelve a correr los efectos. */
  const esperar = (ms: number): void => {
    jasmine.clock().tick(ms);
    TestBed.tick();
  };

  it('en reposo y sola, acaba durmiéndose', () => {
    random = 0.9; // 0.9 >= PHONE_FIRST: nada de teléfono, a dormir.

    esperar(BORED_AFTER_MS + RANGE_MS);

    expect(life.life()).toEqual({ kind: 'sleep' });
  });

  it('otras veces saca el teléfono, y el teléfono también la duerme', () => {
    random = 0.1; // 0.1 < PHONE_FIRST: primero el teléfono.

    esperar(BORED_AFTER_MS + RANGE_MS);
    expect(life.life()?.kind).toBe('phone');

    esperar(BORED_PHONE_MS);
    expect(life.life()).toEqual({ kind: 'sleep' });
  });

  it('no se aburre mientras le hacen caso', () => {
    random = 0.9;
    life.awake.set(true);

    esperar(BORED_AFTER_MS + RANGE_MS);

    expect(life.life()).toBeNull();
  });

  it('despierta en cuanto vuelven a ella', () => {
    random = 0.9;
    esperar(BORED_AFTER_MS + RANGE_MS);

    life.awake.set(true);
    TestBed.tick();

    expect(life.life()).toBeNull();
  });
});
