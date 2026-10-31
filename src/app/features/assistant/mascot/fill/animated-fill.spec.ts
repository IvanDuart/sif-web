import { TestBed } from '@angular/core/testing';

import { STILL_TIMING, WRITTEN_ATTR, findAnchor, playFill, playOpen, typeChange } from './animated-fill';
import {
  matchPreview,
  type FieldAccess,
  type FillField,
  type FillOpener,
  type FillSurface,
} from './descriptor';
import { MascotFillService } from './mascot-fill.service';

/** Un formulario de mentira en el DOM, con los mismos ganchos que los de verdad. */
function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

/** Un `FieldAccess` sobre un objeto, que apunta cada escritura. */
function recorder(initial: Record<string, unknown> = {}) {
  const values = { ...initial };
  const steps: string[] = [];
  const access: FieldAccess = {
    get: (key) => values[key],
    set: (key, value, options) => {
      values[key] = value;
      if (options?.silent) steps.push(String(value));
    },
  };
  return { access, values, steps };
}

const field = (key: string, extra: Partial<FillField> = {}): FillField => ({
  key,
  kind: 'text',
  from: [key],
  ...extra,
});

describe('relleno animado de la mascota', () => {
  let host: HTMLElement;
  let fill: MascotFillService;

  beforeEach(() => {
    fill = TestBed.inject(MascotFillService);
    host = mount('');
  });

  afterEach(() => host.remove());

  describe('encontrar el campo', () => {
    it('lo encuentra por su formControlName, sin marcar nada en la plantilla', () => {
      host.innerHTML = '<input formcontrolname="weightKg" />';
      expect(findAnchor('measurement', field('weightKg'))).toBe(host.querySelector('input')!);
    });

    it('lo encuentra por su data-mascot-field cuando el formulario no es reactivo', () => {
      host.innerHTML = '<textarea data-mascot-field="patient-profile.diabetesNotes"></textarea>';
      expect(findAnchor('patient-profile', field('diabetesNotes'))).toBe(host.querySelector('textarea')!);
    });

    it('no confunde dos formularios que llaman igual a un campo', () => {
      host.innerHTML = '<input data-mascot-field="otro.notes" />';
      expect(findAnchor('measurement', field('notes'))).toBeNull();
    });
  });

  describe('escribir como una persona', () => {
    it('conserva lo que el texto viejo y el nuevo comparten', async () => {
      const { access, steps } = recorder({ notes: 'Control de peso' });
      await typeChange(
        field('notes'),
        access,
        'Control de peso',
        'Control de grasa',
        { ...STILL_TIMING, tickMs: 1, typeBudgetMs: 10_000 },
        fill,
      );

      // "Control de " y "a" no se vuelven a teclear: ningún paso los pierde.
      expect(steps.length).toBeGreaterThan(1);
      for (const step of steps) expect(step.startsWith('Control de ')).withContext(step).toBeTrue();
    });

    it('teclea a trozos para no pasarse del presupuesto', async () => {
      const { access, steps } = recorder({ notes: '' });
      const long = 'x'.repeat(400);
      await typeChange(field('notes'), access, '', long, { ...STILL_TIMING, tickMs: 10, typeBudgetMs: 100 }, fill);

      expect(steps.length).toBeLessThanOrEqual(10);
      expect(steps.at(-1)).toBe(long);
    });
  });

  describe('recorrer el formulario', () => {
    const surface: FillSurface = {
      id: 'demo',
      tools: ['demo_tool'],
      fields: [field('one'), field('two')],
    };

    it('escribe cada campo y marca lo que ha puesto', async () => {
      host.innerHTML = '<input formcontrolname="one" /><input formcontrolname="two" />';
      const { access, values } = recorder();

      const report = await playFill(
        surface,
        access,
        [
          { field: surface.fields[0], raw: 'uno' },
          { field: surface.fields[1], raw: 'dos' },
        ],
        fill,
        STILL_TIMING,
      );

      expect(report.written).toEqual(['one', 'two']);
      expect(values).toEqual({ one: 'uno', two: 'dos' });
      expect(host.querySelectorAll(`[${WRITTEN_ATTR}]`).length).toBe(2);
    });

    it('cuenta como no escrito el campo que no está en pantalla', async () => {
      host.innerHTML = '<input formcontrolname="one" />';
      const { access, values } = recorder();

      const report = await playFill(
        surface,
        access,
        [
          { field: surface.fields[0], raw: 'uno' },
          { field: surface.fields[1], raw: 'dos' },
        ],
        fill,
        STILL_TIMING,
      );

      expect(report.written).toEqual(['one']);
      expect(report.missing).toEqual(['two']);
      expect(values['two']).toBeUndefined();
    });

    it('para en seco cuando la persona toma el mando', async () => {
      host.innerHTML = '<input formcontrolname="one" /><input formcontrolname="two" />';
      const { access, values } = recorder();
      fill.requestSkip();

      const report = await playFill(
        surface,
        access,
        [
          { field: surface.fields[0], raw: 'uno' },
          { field: surface.fields[1], raw: 'dos' },
        ],
        fill,
        STILL_TIMING,
      );

      expect(report.written).toEqual([]);
      expect(values).toEqual({});
    });

    it('suelta el campo y se da por terminado al acabar', async () => {
      host.innerHTML = '<input formcontrolname="one" />';
      const { access } = recorder();
      await playFill(surface, access, [{ field: surface.fields[0], raw: 'uno' }], fill, STILL_TIMING);

      expect(fill.filling()).toBeFalse();
      expect(fill.target()).toBeNull();
    });
  });

  describe('casar lo que manda el asistente con el formulario', () => {
    const surface: FillSurface = {
      id: 'demo',
      tools: ['demo_tool'],
      fields: [
        field('weightKg', { from: ['weightKg', 'peso'], parse: (raw) => Number(raw) }),
        field('notes', { from: ['notes', 'notas'] }),
      ],
    };

    it('acepta tanto la clave del formulario como el alias del backend', () => {
      const matched = matchPreview(surface, [
        { field: 'peso', value: '72.5' },
        { field: 'notes', value: 'Todo bien' },
      ]);

      expect(matched.map((item) => item.field.key)).toEqual(['weightKg', 'notes']);
      expect(matched.map((item) => item.raw)).toEqual(['72.5', 'Todo bien']);
    });

    it('ignora lo que no conoce y lo que viene vacío', () => {
      const matched = matchPreview(surface, [
        { field: 'inventado', value: 'x' },
        { field: 'notes', value: '' },
      ]);

      expect(matched).toEqual([]);
    });

    it('los devuelve en el orden del formulario, no en el del backend', () => {
      const matched = matchPreview(surface, [
        { field: 'notas', value: 'Al final' },
        { field: 'peso', value: '80' },
      ]);

      expect(matched.map((item) => item.field.key)).toEqual(['weightKg', 'notes']);
    });
  });

  describe('abrir el formulario que no está en pantalla', () => {
    const opener: FillOpener = {
      id: 'measurement',
      tools: ['create_measurement'],
      trigger: '[data-mascot-open="measurement"]',
    };

    it('va hasta el botón y lo pulsa, como haría una persona', async () => {
      host.innerHTML = '<button data-mascot-open="measurement">Registrar Medición</button>';
      const button = host.querySelector('button')!;
      let pressed = 0;
      button.addEventListener('click', () => (pressed += 1));

      expect(await playOpen(opener, STILL_TIMING, fill)).toBeTrue();
      expect(pressed).toBe(1);
      expect(fill.target()).toBe(button);
    });

    it('no pulsa un botón que no se ve: ahí la acción se queda en la tarjeta', async () => {
      host.innerHTML =
        '<button data-mascot-open="measurement" style="display:none">Registrar</button>';
      let pressed = 0;
      host.querySelector('button')!.addEventListener('click', () => (pressed += 1));

      expect(await playOpen(opener, STILL_TIMING, fill)).toBeFalse();
      expect(pressed).toBe(0);
    });

    it('pulsa el primero que se vea cuando la acción está repetida en la página', async () => {
      host.innerHTML =
        '<button data-mascot-open="measurement" style="display:none">cabecera</button>' +
        '<button data-mascot-open="measurement">tarjeta</button>';
      const pressed: string[] = [];
      for (const b of Array.from(host.querySelectorAll('button'))) {
        b.addEventListener('click', () => pressed.push(b.textContent!));
      }

      await playOpen(opener, STILL_TIMING, fill);
      expect(pressed).toEqual(['tarjeta']);
    });

    it('no abre nada si la persona ya ha pedido parar', async () => {
      host.innerHTML = '<button data-mascot-open="measurement">Registrar</button>';
      let pressed = 0;
      host.querySelector('button')!.addEventListener('click', () => (pressed += 1));
      fill.requestSkip();

      expect(await playOpen(opener, STILL_TIMING, fill)).toBeFalse();
      expect(pressed).toBe(0);
    });
  });

  describe('saber abrir el formulario', () => {
    it('sólo ofrece abrirlo para sus tools', () => {
      TestBed.runInInjectionContext(() =>
        fill.registerOpener({
          id: 'measurement',
          tools: ['create_measurement', 'update_measurement'],
          trigger: '[data-mascot-open="measurement"]',
        }),
      );

      expect(fill.openerForTool('create_measurement')?.id).toBe('measurement');
      expect(fill.openerForTool('update_measurement')?.id).toBe('measurement');
      expect(fill.openerForTool('create_appointment')).toBeNull();
    });
  });
});
