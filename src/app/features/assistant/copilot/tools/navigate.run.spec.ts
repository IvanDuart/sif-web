import { TestBed } from '@angular/core/testing';
import type { Router } from '@angular/router';

import { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import { RouteVeilService } from '../route-veil';
import { runNavigate } from './navigate.run';

describe('runNavigate', () => {
  let fill: MascotFillService;
  let veil: RouteVeilService;
  let router: jasmine.SpyObj<Router>;
  let closed: boolean;

  const catalog = () => [{ name: 'fill_measurement' }];

  const run = (args: Record<string, unknown>, signal = new AbortController().signal) =>
    runNavigate(args, { router, fill, signal, catalog, veil, closePanel: () => (closed = true) });

  beforeEach(() => {
    fill = TestBed.inject(MascotFillService);
    veil = TestBed.inject(RouteVeilService);
    // Sin movimiento el velo no espera: estos tests miran la navegación, no él.
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    closed = false;
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/patients' });
    router.navigate.and.resolveTo(true);
  });

  it('va a la pantalla y devuelve el catálogo de allí', async () => {
    const result = await run({ screen: 'PATIENTS', query: 'Ana' });
    expect(router.navigate).toHaveBeenCalledWith(['/patients'], { queryParams: { q: 'Ana' } });
    expect(result.ok).toBeTrue();
    expect(result['route']).toBe('/patients');
    expect(result['clientTools']).toEqual([{ name: 'fill_measurement' }]);
  });

  it('cierra el panel: tapa la pantalla a la que se va', async () => {
    await run({ screen: 'DASHBOARD' });
    expect(closed).toBeTrue();
  });

  it('una pantalla que no está en la lista blanca no navega', async () => {
    expect(await run({ screen: 'ADMIN' })).toEqual({ ok: false, reason: 'tool_error', screen: 'ADMIN' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('acepta los parámetros sueltos o dentro de `params`, que es como los manda el modelo', async () => {
    await run({ screen: 'PATIENT_PROFILE', params: { patientId: 'p-1' } });
    expect(router.navigate).toHaveBeenCalledWith(['/users', 'p-1'], { queryParams: { tab: 'patient_profile' } });
  });

  it('una navegación que el router rechaza no se cuenta como hecha', async () => {
    router.navigate.and.resolveTo(false);
    expect((await run({ screen: 'DASHBOARD' })).ok).toBeFalse();
  });

  it('detener el turno antes de navegar deja la pantalla donde está', async () => {
    expect(await run({ screen: 'DASHBOARD' }, AbortSignal.abort()))
      .toEqual({ ok: false, reason: 'user_declined' });
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
