import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickOption, toDay, toTime } from './parse';

export type { PickOption } from './parse';
export { pickOption, toDay, toTime } from './parse';

interface AppointmentOptions {
  patients(): readonly PickOption[];
  nutritionists(): readonly PickOption[];
  types(): readonly PickOption[];
}

/**
 * El diálogo de cita (`appointments/appointment-form.dialog`). Se construye con
 * las listas del propio diálogo porque sus desplegables van por id y el
 * asistente nombra a la gente por su nombre: la traducción sólo puede hacerla
 * quien tiene las opciones cargadas.
 */
export function appointmentSurface(options: AppointmentOptions): FillSurface {
  return {
    id: 'appointment',
    tools: ['create_appointment', 'reschedule_appointment'],
    fields: [
      {
        key: 'patientId',
        kind: 'choice',
        from: ['patientId', 'patient', 'paciente', 'patientName'],
        parse: (raw) => pickOption(options.patients(), raw),
      },
      {
        key: 'nutritionistId',
        kind: 'choice',
        from: ['nutritionistId', 'nutritionist', 'nutricionista', 'professional'],
        parse: (raw) => pickOption(options.nutritionists(), raw),
      },
      {
        key: 'typeId',
        kind: 'choice',
        from: ['typeId', 'type', 'tipo', 'appointmentType'],
        parse: (raw) => pickOption(options.types(), raw),
      },
      { key: 'date', kind: 'date', from: ['date', 'fecha', 'startDate', 'scheduledAt'], parse: toDay },
      { key: 'time', kind: 'time', from: ['time', 'hora', 'startTime', 'scheduledAt'], parse: toTime },
      { key: 'notes', kind: 'text', from: ['notes', 'notas', 'observaciones'] },
    ],
  };
}

/**
 * Cómo abre la mascota el formulario de cita desde la ficha del paciente. La
 * ficha enseña "Reagendar" o "Nueva cita" según tenga cita próxima o no, y
 * las dos llevan al mismo diálogo: el selector vale para ambas y se pulsa la
 * que esté puesta.
 */
export const APPOINTMENT_OPENER: FillOpener = {
  id: 'appointment',
  tools: ['create_appointment', 'reschedule_appointment'],
  trigger: '[data-mascot-open="appointment"]',
};
