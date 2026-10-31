import type { FillList, FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickLabel, toHexColor, toTime } from './parse';
import { scheduleReveal } from './settings-section';

/**
 * La jornada del centro (`settings/components/schedule-form.dialog`).
 *
 * Es el primer formulario con una lista de filas: los tramos (`details`) no
 * existen hasta que se pulsa "Añadir bloque", así que la mascota los va
 * creando según los necesita. El backend los nombra `details[0].startTime`.
 */

interface ScheduleOptions {
  /** Los días de la semana tal y como los ofrece el desplegable del diálogo. */
  days(): readonly PickOption[];
  /** Cuántos tramos tiene el formulario ahora mismo. */
  blocks(): number;
}

/** Más de esto en una jornada no es una jornada, es un error del modelo. */
const MAX_BLOCKS = 14;

export function scheduleSurface(options: ScheduleOptions): FillSurface {
  const details: FillList = {
    key: 'details',
    add: '[data-mascot-add="schedule.details"]',
    size: () => options.blocks(),
    max: MAX_BLOCKS,
    fields: [
      {
        key: 'dayOfWeek',
        kind: 'choice',
        from: ['dayOfWeek', 'day', 'dia', 'diaSemana', 'weekday'],
        // El desplegable guarda la etiqueta ("Lunes"), no el número.
        parse: (raw) => pickLabel(options.days(), raw),
      },
      { key: 'startTime', kind: 'time', from: ['startTime', 'start', 'desde', 'horaInicio'], parse: toTime },
      { key: 'endTime', kind: 'time', from: ['endTime', 'end', 'hasta', 'horaFin'], parse: toTime },
    ],
  };

  return {
    id: 'schedule',
    tools: ['create_schedule', 'update_schedule'],
    fields: [
      { key: 'name', kind: 'text', from: ['name', 'nombre', 'scheduleName'] },
      { key: 'color', kind: 'choice', from: ['color', 'colour'], parse: toHexColor },
    ],
    lists: [details],
  };
}

/**
 * Desde Ajustes: pestaña de Horarios → sub-pestaña de Jornadas → "Nueva
 * jornada". Lo registra `ScheduleSettings`, que es quien tiene el botón; si el
 * usuario no tiene `MANAGE_TENANT` el botón no está y la mascota no abre nada.
 */
export const SCHEDULE_OPENER: FillOpener = {
  id: 'schedule',
  tools: ['create_schedule', 'update_schedule'],
  reveal: scheduleReveal('schedules'),
  trigger: '[data-mascot-open="schedule"]',
};
