import type { FillOpener, FillSurface } from '../descriptor';
import { toDay, toTime } from './parse';

/**
 * Una nota o bloqueo del calendario (`appointments/calendar-note-form`, que va
 * dentro de `create-entry.dialog` y de `calendar-note-detail.dialog`).
 *
 * El formulario es de señales, no reactivo, así que su acceso se construye con
 * `bindingAccess`.
 *
 * `type` está en el contrato pero no se rellena: no es un campo del
 * formulario, es un `input()` que fija el selector del diálogo que lo
 * incrusta. Quien elige si es nota o bloqueo es la persona, antes de que este
 * formulario exista.
 */
export const CALENDAR_NOTE_SURFACE: FillSurface = {
  id: 'calendar-note',
  tools: ['create_calendar_note'],
  fields: [
    { key: 'title', kind: 'text', from: ['title', 'titulo', 'name', 'nombre'] },
    { key: 'day', kind: 'date', from: ['date', 'fecha', 'day', 'startDate'], parse: toDay },
    { key: 'startTime', kind: 'time', from: ['startTime', 'start', 'desde', 'horaInicio'], parse: toTime },
    { key: 'endTime', kind: 'time', from: ['endTime', 'end', 'hasta', 'horaFin'], parse: toTime },
    { key: 'description', kind: 'text', from: ['description', 'descripcion', 'notes', 'notas'], long: true },
  ],
};

/**
 * Cómo llega la mascota al formulario de nota desde fuera de la agenda.
 *
 * Son DOS pulsaciones porque el botón de la agenda abre un selector —cita,
 * recordatorio o bloqueo— y el formulario de nota sólo se monta al elegir uno
 * de los dos últimos. Por eso el `reveal` es el botón de la agenda y el
 * `trigger` es el chip del recordatorio: `reveal` se pulsa antes.
 *
 * **Sin `screen` esto no existía para el modelo.** `reachableForms()` salta los
 * openers sin pantalla, así que `create_calendar_note` no constaba como
 * cubierta por ningún formulario y no se le retiraba: pidieras el recordatorio
 * desde donde lo pidieras, acababa en tarjeta. Medido el 2026-11-13.
 */
export const CALENDAR_NOTE_OPENER: FillOpener = {
  // El id de la superficie, con guion: `slugOf` lo traduce a `calendar_note`
  // para el nombre de la tool y para `reachableForms`. Ponerlo ya traducido
  // aquí lo desconectaría de la superficie que abre.
  id: CALENDAR_NOTE_SURFACE.id,
  tools: CALENDAR_NOTE_SURFACE.tools,
  screen: 'APPOINTMENTS',
  reveal: ['[data-mascot-point="agenda-new"]'],
  trigger: '[data-mascot-entry="REMINDER"]',
};
