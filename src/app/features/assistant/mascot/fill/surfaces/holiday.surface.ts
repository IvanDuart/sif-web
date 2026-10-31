import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickLabel, toDay } from './parse';
import { scheduleReveal } from './settings-section';

/**
 * Un festivo del centro (`settings/components/holiday-form.dialog`).
 *
 * La importación automática (`import_holidays`) no pasa por aquí: no tiene
 * formulario que rellenar, así que se queda en la tarjeta de confirmar.
 */

interface HolidayOptions {
  /** Nacional / local, tal y como los ofrece el desplegable del diálogo. */
  types(): readonly PickOption[];
}

export function holidaySurface(options: HolidayOptions): FillSurface {
  return {
    id: 'holiday',
    tools: ['create_holiday'],
    fields: [
      {
        key: 'holidayDate',
        kind: 'date',
        from: ['holidayDate', 'date', 'fecha', 'day'],
        parse: toDay,
      },
      {
        key: 'description',
        kind: 'text',
        from: ['description', 'descripcion', 'name', 'nombre'],
      },
      {
        key: 'type',
        kind: 'choice',
        from: ['type', 'tipo', 'holidayType'],
        // El desplegable guarda la etiqueta traducida ("Nacional"), no el enum.
        parse: (raw) => pickLabel(options.types(), raw),
      },
    ],
  };
}

/** Ajustes → Horarios → Festivos → "Nuevo festivo". */
export const HOLIDAY_OPENER: FillOpener = {
  id: 'holiday',
  tools: ['create_holiday'],
  reveal: scheduleReveal('holidays'),
  trigger: '[data-mascot-open="holiday"]',
};
