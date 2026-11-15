import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickLabel, pickOption, toDay, toTime, choicesOf } from './parse';

export type { PickOption } from './parse';
export { pickOption, toDay, toTime } from './parse';

interface AppointmentOptions {
  patients(): readonly PickOption[];
  nutritionists(): readonly PickOption[];
  types(): readonly PickOption[];
}

/**
 * El diálogo de cita (`appointments/appointment-form.dialog`). Se construye con
 * las listas del propio diálogo porque el asistente nombra a la gente y a los
 * tipos por su nombre, o por un id que sacó de otra tool: la traducción sólo
 * puede hacerla quien tiene las opciones cargadas.
 *
 * Ojo, que los tres desplegables no guardan lo mismo:
 * - `patientId` y `typeId` guardan la ETIQUETA («Ana García», «Revisión»): el
 *   diálogo busca la opción por etiqueta al guardar. Por eso van con
 *   `pickLabel`. Con `pickOption` se escribía el UUID: el campo lo enseñaba
 *   tal cual y al guardar no casaba con ningún tipo. Pasaba al reagendar cuando
 *   el modelo mandaba el tipo que ya tenía la cita, que no siempre lo manda.
 * - `nutritionistId` guarda el id, y su `stringify` lo convierte en nombre.
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
        ...choicesOf(() => options.patients(), { people: true }),
        parse: (raw) => pickLabel(options.patients(), raw),
      },
      {
        key: 'nutritionistId',
        kind: 'choice',
        from: ['nutritionistId', 'nutritionist', 'nutricionista', 'professional'],
        ...choicesOf(() => options.nutritionists(), { people: true }),
        parse: (raw) => pickOption(options.nutritionists(), raw),
      },
      {
        key: 'typeId',
        kind: 'choice',
        from: ['typeId', 'type', 'tipo', 'appointmentType'],
        ...choicesOf(() => options.types()),
        parse: (raw) => pickLabel(options.types(), raw),
      },
      { key: 'date', kind: 'date', from: ['date', 'fecha', 'startDate', 'scheduledAt'], parse: toDay },
      { key: 'time', kind: 'time', from: ['time', 'hora', 'startTime', 'scheduledAt'], parse: toTime },
      { key: 'notes', kind: 'text', from: ['notes', 'notas', 'observaciones'], long: true },
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
  screen: 'PATIENT_PROFILE',
  needsPatient: true,
  trigger: '[data-mascot-open="appointment"]',
};
