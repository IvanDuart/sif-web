import {
  CALENDAR_NOTE_PALETTE,
  allDayRange,
  clipToRange,
  isPointInTime,
  noteColor,
  overlapsTimeBlock,
} from './calendar-notes';
import { CalendarNoteDto, CalendarNoteType } from '../../core/api/models/calendar-note.model';

function note(partial: Partial<CalendarNoteDto> & Pick<CalendarNoteDto, 'startTime' | 'endTime'>): CalendarNoteDto {
  return {
    id: partial.id ?? 'n1',
    tenantId: 't1',
    nutritionistId: 'u1',
    type: partial.type ?? ('TIME_BLOCK' as CalendarNoteType),
    title: partial.title ?? 'Entrada',
    description: null,
    allDay: partial.allDay ?? false,
    color: partial.color ?? null,
    reminderMinutesBefore: null,
    remindAt: null,
    reminderSentAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: null,
    ...partial,
  } as CalendarNoteDto;
}

describe('calendar-notes utils', () => {
  describe('allDayRange', () => {
    it('cubre el día completo en la zona del usuario, no de 00:00Z a 23:59Z', () => {
      const local = new Date(2026, 10, 2, 15, 30); // 2 nov 2026, hora local
      const { startTime, endTime } = allDayRange(local);

      const start = new Date(startTime);
      const end = new Date(endTime);

      // Medianoche local del día pedido, y medianoche local del siguiente.
      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(10);
      expect(start.getDate()).toBe(2);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);

      expect(end.getDate()).toBe(3);
      expect(end.getHours()).toBe(0);
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('se envía en UTC', () => {
      const { startTime, endTime } = allDayRange(new Date(2026, 0, 15, 9, 0));
      expect(startTime.endsWith('Z')).toBe(true);
      expect(endTime.endsWith('Z')).toBe(true);
    });
  });

  describe('clipToRange', () => {
    const from = '2026-11-01T00:00:00Z';
    const to = '2026-12-01T00:00:00Z';

    it('conserva una entrada que empieza antes del rango y lo invade', () => {
      // Vacaciones del 28/oct al 5/nov: el backend la devuelve al pedir noviembre.
      const holidays = note({ startTime: '2026-10-28T00:00:00Z', endTime: '2026-11-05T00:00:00Z' });
      expect(clipToRange([holidays], from, to)).toEqual([holidays]);
    });

    it('descarta una entrada que acaba justo donde empieza el rango', () => {
      const ending = note({ startTime: '2026-10-30T10:00:00Z', endTime: from });
      expect(clipToRange([ending], from, to)).toEqual([]);
    });

    it('descarta una entrada que empieza justo donde acaba el rango', () => {
      const starting = note({ startTime: to, endTime: '2026-12-01T11:00:00Z' });
      expect(clipToRange([starting], from, to)).toEqual([]);
    });

    it('conserva un recordatorio puntual dentro del rango', () => {
      const point = note({
        type: 'REMINDER',
        startTime: '2026-11-10T09:00:00Z',
        endTime: '2026-11-10T09:00:00Z',
      });
      expect(clipToRange([point], from, to)).toEqual([point]);
    });
  });

  describe('overlapsTimeBlock', () => {
    const block = note({ startTime: '2026-11-02T10:00:00Z', endTime: '2026-11-02T12:00:00Z' });
    const ms = (iso: string) => new Date(iso).getTime();

    it('detecta una franja que cae dentro del bloqueo', () => {
      expect(
        overlapsTimeBlock([block], ms('2026-11-02T10:30:00Z'), ms('2026-11-02T11:00:00Z'))
      ).toBe(true);
    });

    it('no choca con una cita que termina justo cuando empieza el bloqueo', () => {
      expect(
        overlapsTimeBlock([block], ms('2026-11-02T09:00:00Z'), ms('2026-11-02T10:00:00Z'))
      ).toBe(false);
    });

    it('no choca con una cita que empieza justo cuando acaba el bloqueo', () => {
      expect(
        overlapsTimeBlock([block], ms('2026-11-02T12:00:00Z'), ms('2026-11-02T13:00:00Z'))
      ).toBe(false);
    });

    it('ignora los recordatorios: no bloquean nada', () => {
      const reminder = note({
        type: 'REMINDER',
        startTime: '2026-11-02T10:00:00Z',
        endTime: '2026-11-02T12:00:00Z',
      });
      expect(
        overlapsTimeBlock([reminder], ms('2026-11-02T10:30:00Z'), ms('2026-11-02T11:00:00Z'))
      ).toBe(false);
    });
  });

  describe('noteColor', () => {
    it('acepta un color de la paleta sin distinguir mayúsculas', () => {
      const hex = CALENDAR_NOTE_PALETTE[2].hex;
      expect(noteColor({ color: hex.toUpperCase(), type: 'REMINDER' })).toBe(hex.toLowerCase());
    });

    it('descarta un color ajeno a la paleta y cae al propio del tipo', () => {
      // El backend no valida `color`, así que otro cliente puede enviar
      // cualquier cosa: no debe acabar como estilo en el DOM.
      expect(noteColor({ color: 'javascript:alert(1)', type: 'TIME_BLOCK' })).toBe('#6B665E');
      expect(noteColor({ color: null, type: 'REMINDER' })).toBe('#3C6E96');
    });
  });

  describe('isPointInTime', () => {
    it('es puntual cuando inicio y fin coinciden', () => {
      expect(isPointInTime({ startTime: 'x', endTime: 'x' })).toBe(true);
      expect(isPointInTime({ startTime: 'x', endTime: 'y' })).toBe(false);
    });
  });
});
