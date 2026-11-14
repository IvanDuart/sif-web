import { TestBed } from '@angular/core/testing';

import type { FieldAccess, FillSurface } from '../../mascot/fill/descriptor';
import { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import { CursorService } from '../cursor.service';
import { runFill } from './fill.run';

/** Un formulario de mentira en el DOM, con los ganchos de los de verdad. */
function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe('runFill', () => {
  let fill: MascotFillService;
  let cursor: CursorService;
  let host: HTMLElement;
  let values: Record<string, unknown>;
  let access: FieldAccess;

  const surface = (over: Partial<FillSurface> = {}): FillSurface => ({
    id: 'measurement',
    tools: ['create_measurement'],
    fields: [
      { key: 'weightKg', kind: 'number', from: ['weight'] },
      { key: 'date', kind: 'date', from: ['date'], parse: (raw) => (raw === 'ayer' ? null : raw) },
    ],
    ...over,
  });

  const register = (surf: FillSurface) =>
    TestBed.runInInjectionContext(() => fill.register(surf, access));

  const run = (args: Record<string, unknown>, keys = ['weightKg', 'date'], signal = new AbortController().signal) =>
    runFill('measurement', keys, args, { fill, cursor, signal, catalog: () => undefined });

  beforeEach(() => {
    jasmine.clock().withMock(() => undefined);
    fill = TestBed.inject(MascotFillService);
    cursor = TestBed.inject(CursorService);
    host = mount('<input formcontrolname="weightKg" /><input formcontrolname="date" />');
    values = {};
    access = {
      get: (key) => values[key],
      set: (key, value) => {
        values[key] = value;
      },
    };
  });

  afterEach(() => host.remove());

  it('escribe lo que se le pide y lo cuenta', async () => {
    register(surface());
    const result = await run({ weightKg: 70 });
    expect(result.ok).toBeTrue();
    expect(result['written']).toEqual(['weightKg']);
    expect(values['weightKg']).toBe('70');
  });

  it('el formulario que ya no está en pantalla no se rellena a ciegas', async () => {
    const result = await run({ weightKg: 70 });
    expect(result).toEqual({ ok: false, reason: 'surface_gone' });
  });

  it('si no está abierto pero esta pantalla sabe abrirlo, lo abre y sigue', async () => {
    // Olvidarse de `open_` es un paso de menos, no un error: rendirse aquí
    // manda al modelo a escribir por detrás.
    host.innerHTML = '<button data-abrir>Registrar medición</button>';
    TestBed.runInInjectionContext(() =>
      fill.registerOpener({ id: 'measurement', tools: [], screen: 'PATIENT_MEASUREMENTS', trigger: '[data-abrir]' }),
    );
    host.querySelector('button')!.addEventListener('click', () => {
      host.innerHTML += '<input formcontrolname="weightKg" />';
      register(surface());
    });

    const result = await run({ weightKg: 70 });
    expect(result.ok).withContext(String(result['reason'])).toBeTrue();
    expect(values['weightKg']).toBe('70');
  });

  it('no nombra ningún Guardar: no es cosa suya', async () => {
    // Desde el 2026-11-13 la mascota no guarda. Devolver aquí el nombre de
    // `save_<x>` hacía que el modelo lo llamara, y eso acababa en una pregunta
    // de sí o no EN EL CHAT, lejos del formulario recién relleno: en un resumen
    // no se ven los campos que no se tocaron ni los obligatorios del centro.
    register(surface());
    expect((await run({ weightKg: 70 }))['saveWith']).toBeUndefined();
  });

  it('tampoco en un formulario que nunca lo ofreció', async () => {
    register(surface({ noSave: true }));
    expect((await run({ weightKg: 70 }))['saveWith']).toBeUndefined();
  });

  it('si lo ha abierto él, devuelve el catálogo nuevo: antes no existía', async () => {
    host.innerHTML = '<button data-abrir>Registrar medición</button>';
    TestBed.runInInjectionContext(() =>
      fill.registerOpener({ id: 'measurement', tools: [], screen: 'PATIENT_MEASUREMENTS', trigger: '[data-abrir]' }),
    );
    host.querySelector('button')!.addEventListener('click', () => {
      host.innerHTML += '<input formcontrolname="weightKg" />';
      register(surface());
    });

    const result = await runFill('measurement', ['weightKg'], { weightKg: 70 }, {
      fill,
      cursor,
      signal: new AbortController().signal,
      catalog: () => [{ name: 'save_measurement' }],
    });
    expect(result['opened']).toBe('measurement');
    expect(result['clientTools']).toEqual([{ name: 'save_measurement' }]);
  });

  it('un formulario que ya estaba abierto no reenvía el catálogo', async () => {
    register(surface());
    expect((await run({ weightKg: 70 }))['clientTools']).toBeUndefined();
  });

  it('un formulario que aún carga se espera, no se da por ausente', async () => {
    let loaded = false;
    register(surface({ ready: () => loaded }));
    const pending = run({ weightKg: 70 });
    setTimeout(() => (loaded = true), 150);
    expect((await pending).ok).toBeTrue();
  });

  it('lo que el formulario no sabe traducir se cuenta como rechazado, no como escrito', async () => {
    register(surface());
    const result = await run({ date: 'ayer' });
    expect(result.ok).toBeFalse();
    expect(result['rejected']).toEqual([{ field: 'date', reason: 'unparsable' }]);
    expect(values['date']).toBeUndefined();
  });

  it('el campo que no está en pantalla se distingue del que está y no acepta', async () => {
    host.innerHTML = '<input formcontrolname="weightKg" />';
    register(surface());
    const result = await run({ weightKg: 70, date: '2026-11-07' });
    expect(result['written']).toEqual(['weightKg']);
    expect(result['missing']).toEqual(['date']);
  });

  it('un valor que el formulario se come se cuenta: el modelo tiene que enterarse', async () => {
    register(surface());
    access.set = () => undefined;
    const result = await run({ weightKg: 70 });
    expect(result['rejected']).toEqual([{ field: 'weightKg', reason: 'not_applied' }]);
  });

  it('solo escribe las claves que ESTA herramienta declaró', async () => {
    register(surface());
    const result = await run({ weightKg: 70, date: '2026-11-07' }, ['weightKg']);
    expect(result['written']).toEqual(['weightKg']);
    expect(result['unknown']).toEqual(['date']);
    expect(values['date']).toBeUndefined();
  });

  it('dice qué falta para poder guardar', async () => {
    register(surface());
    access.missingRequired = () => ['date'];
    expect((await run({ weightKg: 70 }))['missingRequired']).toEqual(['date']);
  });

  it('detener el turno antes de empezar no escribe nada', async () => {
    register(surface());
    const aborted = AbortSignal.abort();
    expect(await run({ weightKg: 70 }, ['weightKg'], aborted)).toEqual({ ok: false, reason: 'user_declined' });
    expect(values['weightKg']).toBeUndefined();
  });
});
