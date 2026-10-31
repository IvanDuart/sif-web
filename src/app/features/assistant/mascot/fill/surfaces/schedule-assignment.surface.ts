import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickLabel, toDay } from './parse';
import { scheduleReveal } from './settings-section';

/**
 * La asignación de una jornada a un periodo
 * (`settings/components/assignment-form.dialog`).
 *
 * El año no se pide: el diálogo lo saca de `validFrom`. Y `validTo` vive
 * detrás de la casilla "sin fecha de fin", así que el campo se declara con un
 * `reveal` que la desmarca; si ya está desmarcada, no se toca.
 */

interface AssignmentOptions {
  /** Las jornadas que ofrece el desplegable del diálogo. */
  schedules(): readonly PickOption[];
}

export function scheduleAssignmentSurface(options: AssignmentOptions): FillSurface {
  return {
    id: 'schedule-assignment',
    tools: ['assign_schedule', 'update_schedule_assignment'],
    fields: [
      {
        key: 'scheduleId',
        kind: 'choice',
        from: ['scheduleId', 'schedule', 'jornada', 'scheduleName'],
        // El desplegable guarda el nombre de la jornada, no su id.
        parse: (raw) => pickLabel(options.schedules(), raw),
      },
      {
        key: 'validFrom',
        kind: 'date',
        from: ['validFrom', 'from', 'desde', 'startDate'],
        parse: toDay,
      },
      {
        key: 'validTo',
        kind: 'date',
        from: ['validTo', 'to', 'hasta', 'endDate'],
        reveal: '[data-mascot-reveal="assignment-dated"]',
        parse: toDay,
      },
    ],
  };
}

/** Ajustes → Horarios → Asignaciones → "Nueva asignación". */
export const SCHEDULE_ASSIGNMENT_OPENER: FillOpener = {
  id: 'schedule-assignment',
  tools: ['assign_schedule', 'update_schedule_assignment'],
  reveal: scheduleReveal('assignments'),
  trigger: '[data-mascot-open="schedule-assignment"]',
};
