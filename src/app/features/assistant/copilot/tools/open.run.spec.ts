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

  describe('un botón que se repite por elemento (param)', () => {
    const EXCHANGES: FillOpener = {
      id: 'meal-exchanges',
      tools: ['update_meal_exchanges'],
      trigger: '[data-meal="{mealId}"]',
      param: { name: 'mealId', description: 'Id de la comida' },
    };
    const surfaceFor = (mealId: string): FillSurface => ({ id: 'meal-exchanges', tools: [], fields: [], subject: () => mealId });
    const runWith = (args: Record<string, unknown>) =>
      runOpen('meal-exchanges', { fill, signal: new AbortController().signal, catalog, args });

    beforeEach(() => TestBed.runInInjectionContext(() => fill.registerOpener(EXCHANGES)));

    it('pulsa el de ESE elemento, no el primero que se vea', async () => {
      host.innerHTML = '<button data-meal="m-1">Lunes</button><button data-meal="m-2">Martes</button>';
      const pressed: string[] = [];
      host.querySelectorAll('button').forEach((button) =>
        button.addEventListener('click', () => {
          const id = button.getAttribute('data-meal')!;
          pressed.push(id);
          TestBed.runInInjectionContext(() => fill.register(surfaceFor(id), { get: () => '', set: () => undefined }));
        }),
      );

      const result = await runWith({ mealId: 'm-2' });

      expect(result.ok).toBeTrue();
      expect(pressed).toEqual(['m-2']);
    });

    it('sin un id válido no pulsa nada: lo que escribe el modelo acaba en un selector', async () => {
      host.innerHTML = '<button data-meal="m-1">Lunes</button>';
      const click = jasmine.createSpy('click');
      host.querySelector('button')!.addEventListener('click', click);

      expect(await runWith({ mealId: '"] , button[data-meal' })).toEqual(jasmine.objectContaining({ ok: false, reason: 'invalid_args' }));
      expect(await runWith({})).toEqual(jasmine.objectContaining({ ok: false, reason: 'invalid_args' }));
      expect(click).not.toHaveBeenCalled();
    });

    it('si ya está abierto el de ese elemento, no lo vuelve a pulsar (lo cerraría)', async () => {
      host.innerHTML = '<button data-meal="m-1">Lunes</button>';
      const click = jasmine.createSpy('click');
      host.querySelector('button')!.addEventListener('click', click);
      TestBed.runInInjectionContext(() => fill.register(surfaceFor('m-1'), { get: () => '', set: () => undefined }));

      expect(await runWith({ mealId: 'm-1' })).toEqual(jasmine.objectContaining({ ok: true, alreadyOpen: true }));
      expect(click).not.toHaveBeenCalled();
    });

    it('si el abierto es el de otro elemento, pulsa el pedido', async () => {
      host.innerHTML = '<button data-meal="m-2">Martes</button>';
      let current = 'm-1';
      TestBed.runInInjectionContext(() =>
        fill.register({ id: 'meal-exchanges', tools: [], fields: [], subject: () => current }, { get: () => '', set: () => undefined }),
      );
      host.querySelector('button')!.addEventListener('click', () => (current = 'm-2'));

      const result = await runWith({ mealId: 'm-2' });

      expect(result).toEqual(jasmine.objectContaining({ ok: true, opened: 'meal-exchanges' }));
      expect(result['alreadyOpen']).toBeUndefined();
    });
  });
});
