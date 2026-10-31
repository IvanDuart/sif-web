import { TestBed } from '@angular/core/testing';

import { BORED_AFTER_MS, BORED_PHONE_MS, MascotLifeService } from './mascot-life.service';

/** El rango aleatorio que se le suma a la espera antes de aburrirse. */
const RANGE_MS = 20_000;

/**
 * Si nadie le hace caso, la mascota se busca la vida: saca el teléfono y, si
 * sigue sola, acaba dormida. En cuanto le vuelven a hacer caso, despierta.
 */
describe('MascotLifeService: cuando no le hacen caso', () => {
  let life: MascotLifeService;

  beforeEach(() => {
    jasmine.clock().install();
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

  it('primero saca el teléfono, nunca se duerme de golpe', () => {
    esperar(BORED_AFTER_MS + RANGE_MS);

    expect(life.life()?.kind).withContext('al aburrirse').toBe('phone');
  });

  it('y el teléfono acaba durmiéndola', () => {
    esperar(BORED_AFTER_MS + RANGE_MS);

    esperar(BORED_PHONE_MS);

    expect(life.life()).toEqual({ kind: 'sleep' });
  });

  it('no se aburre mientras le hacen caso', () => {
    life.awake.set(true);

    esperar(BORED_AFTER_MS + RANGE_MS);

    expect(life.life()).toBeNull();
  });

  it('despierta en cuanto vuelven a ella', () => {
    esperar(BORED_AFTER_MS + RANGE_MS);

    life.awake.set(true);
    TestBed.tick();

    expect(life.life()).toBeNull();
  });
});
