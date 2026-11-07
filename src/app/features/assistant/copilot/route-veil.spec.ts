import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { COVER_MS, REVEAL_MS, RouteVeilService } from './route-veil';

describe('RouteVeilService', () => {
  let veil: RouteVeilService;
  let reduced: boolean;

  beforeEach(() => {
    reduced = false;
    spyOn(window, 'matchMedia').and.callFake(() => ({ matches: reduced }) as MediaQueryList);
    veil = TestBed.inject(RouteVeilService);
  });

  it('cubre, deja hacer, y descubre', fakeAsync(() => {
    let navegado = false;
    void veil.during('Pacientes', async () => {
      navegado = true;
    });

    expect(veil.phase()).toBe('covering');
    expect(veil.place()).toBe('Pacientes');
    // La navegación NO ocurre hasta que está tapado.
    expect(navegado).toBeFalse();

    tick(COVER_MS);
    expect(navegado).toBeTrue();
    expect(veil.phase()).toBe('revealing');

    tick(REVEAL_MS);
    expect(veil.phase()).toBe('idle');
  }));

  it('devuelve lo que devuelva la navegación', fakeAsync(() => {
    let resultado: boolean | null = null;
    void veil.during('Agenda', async () => true).then((value) => (resultado = value));
    tick(COVER_MS + REVEAL_MS);
    expect(resultado).toBeTrue();
  }));

  it('si la navegación falla, el velo se retira igual', fakeAsync(() => {
    let fallo: unknown = null;
    void veil.during('Agenda', () => Promise.reject(new Error('no'))).catch((error) => (fallo = error));
    tick(COVER_MS);
    expect(veil.phase()).toBe('revealing');
    tick(REVEAL_MS);
    // Quedarse con la pantalla tapada sería peor que el error.
    expect(veil.phase()).toBe('idle');
    expect(fallo).not.toBeNull();
  }));

  it('sin movimiento no hay velo, y se navega igual', fakeAsync(() => {
    reduced = true;
    let navegado = false;
    void veil.during('Agenda', async () => {
      navegado = true;
    });
    tick(0);
    expect(navegado).toBeTrue();
    expect(veil.phase()).toBe('idle');
  }));
});
