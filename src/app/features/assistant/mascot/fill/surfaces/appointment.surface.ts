import { TuiDay, TuiTime } from '@taiga-ui/cdk';

import type { FillOpener, FillSurface } from '../descriptor';

/** Una opción de un desplegable del diálogo de cita. */
export interface PickOption {
  label: string;
  value: string;
}

/**
 * Busca la opción que el asistente nombra. Manda el id si lo manda; si no,
 * casa por nombre sin acentos ni mayúsculas, primero entero y luego por
 * principio, que es como la nombra una persona ("Ana" para "Ana García").
 */
export function pickOption(options: readonly PickOption[], raw: string): string | null {
  const byValue = options.find((option) => option.value === raw);
  if (byValue) return byValue.value;

  const wanted = plain(raw);
  if (wanted === '') return null;
  const exact = options.find((option) => plain(option.label) === wanted);
  if (exact) return exact.value;
  const starts = options.filter((option) => plain(option.label).startsWith(wanted));
  // Si dos opciones empiezan igual no se elige por la mascota: mejor dejarlo vacío.
  return starts.length === 1 ? starts[0].value : null;
}

function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** `2026-11-06`, o `06/11/2026`. */
export function toDay(raw: string): TuiDay | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (iso) return new TuiDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(raw.trim());
  if (local) return new TuiDay(Number(local[3]), Number(local[2]) - 1, Number(local[1]));
  return null;
}

/** `10:00`, `10:00:00`, o la hora de una fecha ISO completa. */
export function toTime(raw: string): TuiTime | null {
  const at = /(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!at) return null;
  const [hours, minutes] = [Number(at[1]), Number(at[2])];
  if (hours > 23 || minutes > 59) return null;
  return new TuiTime(hours, minutes);
}

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
