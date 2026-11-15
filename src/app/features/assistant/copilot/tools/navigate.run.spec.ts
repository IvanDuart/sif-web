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

  it('no va a una pantalla de paciente sin saber de quién', async () => {
    // El regresivo del 2026-11-13: `routeForScreen` tiene un destino de reserva
    // para estas pantallas y llevaba al panel principal CONTESTANDO ok, así que
    // la mascota creía haber llegado, no encontraba el formulario de cita y
    // acababa proponiendo la tarjeta.
    const result = await run({ screen: 'PATIENT_PROFILE' });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(result.ok).toBeFalse();
    expect(result.reason).toBe('needs_patient');
  });

  it('va a la ficha cuando sí sabe de quién', async () => {
    const result = await run({ screen: 'PATIENT_PROFILE', patientId: 'p-1' });
    expect(router.navigate).toHaveBeenCalledWith(['/users', 'p-1'], {
      queryParams: { tab: 'patient_profile' },
    });
    expect(result.ok).toBeTrue();
  });

  it('sin patientId usa el paciente activo que añade el backend', async () => {
    // El backend manda el de AHORA, recién fijado con `set_active_patient`.
    const result = await run({ screen: 'PATIENT_MEASUREMENTS', activePatientId: 'p-7' });
    expect(router.navigate).toHaveBeenCalledWith(['/users', 'p-7'], {
      queryParams: { tab: 'measurements' },
    });
    expect(result.ok).toBeTrue();
  });

  it('el patientId que da el modelo manda sobre el activo', async () => {
    await run({ screen: 'PATIENT_PROFILE', patientId: 'p-1', activePatientId: 'p-7' });
    expect(router.navigate).toHaveBeenCalledWith(['/users', 'p-1'], {
      queryParams: { tab: 'patient_profile' },
    });
  });

  it('fuera de las pantallas de paciente, el activo no cambia el destino', async () => {
    // `MENU` con paciente iría a su pestaña de menús: que haya alguien activo no
    // debe convertir «ve a los menús» en «ve a los menús de esta paciente».
    await run({ screen: 'MENU', activePatientId: 'p-7' });
    expect(router.navigate).toHaveBeenCalledWith(['/menus'], { queryParams: undefined });
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
