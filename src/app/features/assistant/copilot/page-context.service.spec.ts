import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

import type { FieldAccess, FillSurface } from '../mascot/fill/descriptor';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { choicesOf } from '../mascot/fill/surfaces/parse';
import { PageContextService } from './page-context.service';

describe('PageContextService', () => {
  let service: PageContextService;
  let fill: MascotFillService;
  let url = '/patients/42?tab=2#top';

  const access = (values: Record<string, unknown>): FieldAccess => ({ get: (key) => values[key], set: () => undefined });
  const surface = (over: Partial<FillSurface> & { id: string }): FillSurface => ({
    tools: [],
    fields: [{ key: 'notes', kind: 'text', from: [] }],
    ...over,
  });

  /** `register` pide un contexto de inyección, como en una página. */
  const mount = (s: FillSurface, a: FieldAccess) => TestBed.runInInjectionContext(() => fill.register(s, a));
  const extras = (key: string, read: () => unknown) => TestBed.runInInjectionContext(() => fill.provideExtras(key, read));

  beforeEach(() => {
    url = '/patients/42?tab=2#top';
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { get url() { return url; } } },
        { provide: Title, useValue: { getTitle: () => ' Ficha de Ana ' } },
      ],
    });
    service = TestBed.inject(PageContextService);
    fill = TestBed.inject(MascotFillService);
  });

  it('manda la ruta sin query ni fragmento, y el título', () => {
    const context = service.build();
    expect(context.route).toBe('/patients/42');
    expect(context.title).toBe('Ficha de Ana');
  });

  it('cada formulario va con el mismo id que su herramienta', () => {
    mount(surface({ id: 'appointment-type' }), access({ notes: 'hola' }));
    expect(service.build().forms).toEqual([{ id: 'appointment_type', values: { notes: 'hola' } }]);
  });

  it('un formulario que aún carga no se cuenta', () => {
    mount(surface({ id: 'tenant-profile', ready: () => false }), access({ notes: 'a medias' }));
    expect(service.build().forms).toEqual([]);
  });

  it('un campo de elección llega con su etiqueta, no con su id', () => {
    const people = [{ label: 'Ana García', value: '8f3c-uuid' }];
    mount(
      surface({ id: 'appointment', fields: [{ key: 'patientId', kind: 'choice', from: [], ...choicesOf(() => people, { people: true }) }] }),
      access({ patientId: '8f3c-uuid' }),
    );
    expect(service.build().forms?.[0].values).toEqual({ patientId: 'Ana García' });
  });

  it('si no sabe qué etiqueta es, no manda el id', () => {
    mount(
      surface({ id: 'appointment', fields: [{ key: 'patientId', kind: 'choice', from: [], ...choicesOf(() => []) }] }),
      access({ patientId: 'uuid-desconocido' }),
    );
    expect(service.build().forms?.[0].values).toEqual({ patientId: null });
  });

  it('un formulario no contextual va abierto pero sin sus valores', () => {
    mount(surface({ id: 'patient-profile', contextual: () => false }), access({ notes: 'diabetes tipo 2' }));
    const forms = service.build().forms;
    expect(forms).toEqual([{ id: 'patient_profile', values: {} }]);
    expect(JSON.stringify(service.build())).not.toContain('diabetes');
  });

  it('contextual a true manda los valores', () => {
    mount(surface({ id: 'patient-profile', contextual: () => true }), access({ notes: 'diabetes tipo 2' }));
    expect(service.build().forms?.[0].values).toEqual({ notes: 'diabetes tipo 2' });
  });

  it('las filas van como una cadena por fila', () => {
    const rows: FillSurface = surface({
      id: 'schedule',
      fields: [],
      lists: [
        {
          key: 'details',
          add: '',
          size: () => 2,
          fields: [
            { key: 'dayOfWeek', kind: 'text', from: [] },
            { key: 'startTime', kind: 'text', from: [] },
          ],
        },
      ],
    });
    mount(rows, {
      get: (key) => ({ 'details.0.dayOfWeek': 'Lunes', 'details.0.startTime': '09:00', 'details.1.dayOfWeek': 'Martes' })[key],
      set: () => undefined,
    });
    expect(service.build().forms?.[0].values).toEqual({ details: ['Lunes | 09:00', 'Martes | '] });
  });

  it('un formulario que lanza al leerse se salta y el resto sale', () => {
    mount(surface({ id: 'roto' }), { get: () => { throw new Error('señal nula'); }, set: () => undefined });
    mount(surface({ id: 'sano' }), access({ notes: 'ok' }));
    const forms = service.build().forms!;
    expect(forms.map((form) => form.id)).toContain('sano');
    expect(forms.find((form) => form.id === 'roto')?.values).toEqual({ notes: null });
  });

  it('un `ready` que lanza no tumba el contexto', () => {
    mount(surface({ id: 'roto', ready: () => { throw new Error('boom'); } }), access({}));
    expect(() => service.build()).not.toThrow();
  });

  it('los extras de las pantallas vivas van con el contexto', () => {
    extras('agenda', () => ({ view: 'timeGridWeek' }));
    expect(service.build().extras).toEqual({ agenda: { view: 'timeGridWeek' } });
  });

  it('un extra que lanza no tumba el mensaje', () => {
    extras('agenda', () => { throw new Error('boom'); });
    const context = service.build();
    expect(context.route).toBe('/patients/42');
    expect(context.extras).toBeUndefined();
  });
});
