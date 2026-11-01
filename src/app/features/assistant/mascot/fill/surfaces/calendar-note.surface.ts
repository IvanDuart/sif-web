import type { FillSurface } from '../descriptor';
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
    { key: 'description', kind: 'text', from: ['description', 'descripcion', 'notes', 'notas'] },
  ],
};
