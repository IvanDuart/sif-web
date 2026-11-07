import { TestBed } from '@angular/core/testing';

import type { FieldAccess, FillSurface } from '../../mascot/fill/descriptor';
import { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import { runEdit } from './edit.run';

describe('runEdit', () => {
  let fill: MascotFillService;
  let host: HTMLElement;
  let values: Record<string, unknown>;

  const SURFACE: FillSurface = {
    id: 'appointment',
    tools: [],
    fields: [
      { key: 'notes', kind: 'text', from: [], long: true },
      { key: 'date', kind: 'date', from: [] },
    ],
  };

  const run = (args: Record<string, unknown>) =>
    runEdit('appointment', ['notes'], args, { fill, signal: new AbortController().signal });

  beforeEach(() => {
    fill = TestBed.inject(MascotFillService);
    host = document.createElement('div');
    host.innerHTML = '<textarea formcontrolname="notes"></textarea>';
    document.body.appendChild(host);
    values = { notes: 'Viene en ayunas.' };
    const access: FieldAccess = {
      get: (key) => values[key],
      set: (key, value) => {
        values[key] = value;
      },
    };
    TestBed.runInInjectionContext(() => fill.register(SURFACE, access));
  });

  afterEach(() => host.remove());

  it('añade al texto que ya había sin reescribirlo', async () => {
    const result = await run({ field: 'notes', op: 'append', text: 'Trae analítica.' });
    expect(result.ok).toBeTrue();
    expect(values['notes']).toBe('Viene en ayunas.\nTrae analítica.');
  });

  it('un fragmento que no está no se inventa', async () => {
    expect(await run({ field: 'notes', op: 'replace', anchor: 'colesterol', text: 'x' }))
      .toEqual({ ok: false, reason: 'not_found' });
    expect(values['notes']).toBe('Viene en ayunas.');
  });

  it('un campo que no es de texto largo no se edita por trozos', async () => {
    expect(await run({ field: 'date', op: 'append', text: 'x' })).toEqual({ ok: false, reason: 'tool_error' });
  });

  it('una operación que no existe no toca nada', async () => {
    expect(await run({ field: 'notes', op: 'rewrite', text: 'x' })).toEqual({ ok: false, reason: 'tool_error' });
  });

  it('el formulario que ya no está no se edita a ciegas', async () => {
    const result = await runEdit('menu-rename', ['notes'], { field: 'notes', op: 'append', text: 'x' }, {
      fill,
      signal: new AbortController().signal,
    });
    expect(result).toEqual({ ok: false, reason: 'surface_gone' });
  });
});
