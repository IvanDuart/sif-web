import { TuiDay, TuiTime } from '@taiga-ui/cdk';

import { matchPreview, bindingAccess, type FillSurface } from '../descriptor';
import { APPOINTMENT_TYPE_SURFACE } from './appointment-type.surface';
import { assignNutritionistSurface } from './assign-nutritionist.surface';
import { CALENDAR_NOTE_SURFACE } from './calendar-note.surface';
import { clinicalStatusSurface } from './clinical-status.surface';
import { mealSurface } from './meal.surface';
import { MENU_RENAME_SURFACE } from './menu-rename.surface';
import { menuTemplateSurface } from './menu-template.surface';
import { PATIENT_EVENT_SURFACE } from './patient-event.surface';
import { tenantProfileSurface } from './tenant-profile.surface';

/**
 * Las superficies que no son de horarios. Lo que importa en cada una es la
 * traducción: si el control guarda el valor o la etiqueta, y en qué tipo de
 * Taiga hay que convertir el texto del asistente.
 */

/** Lo que escribiría la mascota en el formulario, campo a campo. */
function written(surface: FillSurface, preview: Record<string, string>): Record<string, unknown> {
  const items = matchPreview(
    surface,
    Object.entries(preview).map(([field, value]) => ({ field, value })),
  );
  return Object.fromEntries(
    items.map(({ field, raw }) => [field.key, field.parse ? field.parse(raw) : raw]),
  );
}

describe('superficies de la ficha y del centro', () => {
  it('estado clínico: el select guarda el valor del enum, no su etiqueta', () => {
    const surface = clinicalStatusSurface({
      statuses: () => [
        { label: 'En seguimiento', value: 'ACTIVE' },
        { label: 'Alta', value: 'DISCHARGED' },
      ],
    });

    expect(written(surface, { clinicalStatus: 'Alta', reason: 'Objetivo cumplido' })).toEqual({
      clinicalStatus: 'DISCHARGED',
      reason: 'Objetivo cumplido',
    });
    // También acepta el enum tal cual.
    expect(written(surface, { clinicalStatus: 'ACTIVE' })).toEqual({ clinicalStatus: 'ACTIVE' });
  });

  it('evento del paciente: la fecha llega como texto y el formulario quiere TuiDay', () => {
    expect(written(PATIENT_EVENT_SURFACE, { title: 'Revisión', startTime: '2026-12-01' })).toEqual({
      title: 'Revisión',
      startTime: new TuiDay(2026, 11, 1),
    });
  });

  it('asignar nutricionista: del nombre al id', () => {
    const surface = assignNutritionistSurface({
      nutritionists: () => [
        { label: 'Nelson Muntz', value: 'id-nelson' },
        { label: 'Ana García', value: 'id-ana' },
      ],
    });

    expect(written(surface, { nutritionistId: 'Ana' })).toEqual({ nutritionistId: 'id-ana' });
  });

  it('plantilla de menú: el combobox guarda el nombre, no el id', () => {
    const surface = menuTemplateSurface({
      templates: () => [{ label: 'Pauta de volumen', value: 'id-volumen' }],
    });

    expect(written(surface, { templateId: 'id-volumen', name: 'Menú enero', isActive: 'sí' })).toEqual({
      templateId: 'Pauta de volumen',
      name: 'Menú enero',
      isActive: true,
    });
  });

  it('tipo de cita: duración y precio llegan como texto', () => {
    expect(
      written(APPOINTMENT_TYPE_SURFACE, {
        name: 'Revisión rápida',
        durationMinutes: '20 min',
        price: '25,50 €',
        isDefault: 'no',
      }),
    ).toEqual({
      name: 'Revisión rápida',
      durationMinutes: 20,
      price: 25.5,
      isDefault: false,
    });
  });

  it('nota de calendario: fecha y horas por separado', () => {
    expect(
      written(CALENDAR_NOTE_SURFACE, {
        title: 'Formación',
        date: '2026-11-20',
        startTime: '16:00',
        endTime: '18:30',
      }),
    ).toEqual({
      title: 'Formación',
      day: new TuiDay(2026, 10, 20),
      startTime: new TuiTime(16, 0),
      endTime: new TuiTime(18, 30),
    });
  });

  it('nota de calendario: `type` no se rellena, lo elige el diálogo', () => {
    expect(written(CALENDAR_NOTE_SURFACE, { type: 'TIME_BLOCK' })).toEqual({});
  });

  it('comida: los alimentos no se rellenan, solo lo que es un campo', () => {
    const surface = mealSurface({
      days: () => [{ label: 'Lunes', value: 'MONDAY' }],
      mealTypes: () => [{ label: 'Comida', value: 'LUNCH' }],
    });

    expect(
      written(surface, {
        dayOfWeek: 'Lunes',
        mealType: 'Comida',
        description: 'Lentejas',
        'items[0].foodId': 'uuid',
        'items[0].quantityG': '150',
      }),
    ).toEqual({ dayOfWeek: 'MONDAY', mealType: 'LUNCH', description: 'Lentejas' });
  });

  it('renombrar menú: un solo campo', () => {
    expect(written(MENU_RENAME_SURFACE, { name: 'Menú de marzo' })).toEqual({ name: 'Menú de marzo' });
  });

  describe('dirección del centro', () => {
    const surface = tenantProfileSurface({
      loaded: () => true,
      countries: () => [{ label: 'España', value: 'ES' }],
      states: () => [{ label: 'Baleares', value: 'PM' }],
      cities: () => [{ label: 'Palma', value: 'Palma' }],
    });

    it('del código del contrato a la etiqueta del desplegable', () => {
      expect(written(surface, { countryCode: 'ES', stateCode: 'PM', city: 'Palma', address: 'C/ Mayor 1' })).toEqual({
        countryDisplay: 'España',
        stateDisplay: 'Baleares',
        cityDisplay: 'Palma',
        address: 'C/ Mayor 1',
      });
    });

    it('no se deja rellenar mientras la sección está cargando', () => {
      const cargando = tenantProfileSurface({
        loaded: () => false,
        countries: () => [],
        states: () => [],
        cities: () => [],
      });
      expect(cargando.ready!()).toBeFalse();
      expect(surface.ready!()).toBeTrue();
    });

    it('el país va antes que la provincia, porque recarga su lista', () => {
      const order = surface.fields.map((field) => field.key);
      expect(order.indexOf('countryDisplay')).toBeLessThan(order.indexOf('stateDisplay'));
      expect(order.indexOf('stateDisplay')).toBeLessThan(order.indexOf('cityDisplay'));
    });
  });

  describe('bindingAccess', () => {
    it('escribe y avisa al terminar, pero no en los pasos del tecleo', () => {
      let value = '';
      const reloads: string[] = [];
      const access = bindingAccess({
        country: {
          get: () => value,
          set: (next) => (value = String(next)),
          after: () => reloads.push(value),
        },
      });

      access.set('country', 'Espa', { silent: true });
      access.set('country', 'España');

      expect(value).toBe('España');
      // Una sola recarga: la del valor definitivo.
      expect(reloads).toEqual(['España']);
    });

    it('ignora un campo que no existe en vez de romper', () => {
      const access = bindingAccess({});
      expect(() => access.set('inventado', 'x')).not.toThrow();
      expect(access.get('inventado')).toBeUndefined();
    });
  });
});
