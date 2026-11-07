import { TestBed } from '@angular/core/testing';

import type { FillOpener, FillSurface } from '../../mascot/fill/descriptor';
import { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import { runOpen } from './open.run';

describe('runOpen', () => {
  let fill: MascotFillService;
  let host: HTMLElement;

  const OPENER: FillOpener = { id: 'measurement', screen: 'DASHBOARD', tools: ['create_measurement'], trigger: '[data-open]' };
  const SURFACE: FillSurface = { id: 'measurement', tools: [], fields: [{ key: 'weightKg', kind: 'number', from: [] }] };

  const catalog = () => [{ name: 'fill_measurement' }];
  const run = (signal = new AbortController().signal) => runOpen('measurement', { fill, signal, catalog });

  beforeEach(() => {
    fill = TestBed.inject(MascotFillService);
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  it('pulsa el botón de la pantalla y espera a que el formulario se apunte', async () => {
    host.innerHTML = '<button data-open>Nueva medición</button>';
    TestBed.runInInjectionContext(() => fill.registerOpener(OPENER));
    host.querySelector('button')!.addEventListener('click', () => {
      TestBed.runInInjectionContext(() => fill.register(SURFACE, { get: () => '', set: () => undefined }));
    });

    const result = await run();
    expect(result.ok).toBeTrue();
    expect(result['opened']).toBe('measurement');
    // El catálogo nuevo va de vuelta: abrir cambia lo que se puede hacer.
    expect(result['clientTools']).toEqual([{ name: 'fill_measurement' }]);
  });

  it('si el botón no abre nada, lo dice en vez de dar por hecho que abrió', async () => {
    host.innerHTML = '<button data-open>Nueva medición</button>';
    TestBed.runInInjectionContext(() => fill.registerOpener(OPENER));
    expect(await run()).toEqual({ ok: false, reason: 'control_gone' });
  });

  it('sin botón en la pantalla no se abre nada por dentro', async () => {
    expect(await run()).toEqual({ ok: false, reason: 'control_gone' });
  });

  it('un diálogo ya abierto no se vuelve a abrir', async () => {
    host.innerHTML = '<button data-open>Nueva medición</button>';
    const pressed = spyOn(host.querySelector('button')!, 'click');
    TestBed.runInInjectionContext(() => fill.registerOpener(OPENER));
    TestBed.runInInjectionContext(() => fill.register(SURFACE, { get: () => '', set: () => undefined }));

    const result = await run();
    expect(result.ok).toBeTrue();
    expect(result['alreadyOpen']).toBeTrue();
    expect(pressed).not.toHaveBeenCalled();
  });
});
