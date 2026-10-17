import { CalendarNoteDto, CalendarNoteType } from '../../core/api/models/calendar-note.model';

/**
 * Paleta **cerrada** para las notas de calendario.
 *
 * El backend acepta `color` como texto libre de 20 caracteres y no lo
 * interpreta, así que el convenio lo fija el cliente: hex `#RRGGBB` elegido de
 * esta lista y nada más. La guía de diseño (§3) prohíbe inventar colores fuera
 * de los tokens, de modo que estos valores son los tokens semánticos y de marca
 * resueltos a hex — un selector de color libre no está permitido.
 */
export const CALENDAR_NOTE_PALETTE: readonly { readonly hex: string; readonly labelKey: string }[] = [
  { hex: '#2F5D4F', labelKey: 'calendar_notes.color_green' },
  { hex: '#3C6E96', labelKey: 'calendar_notes.color_blue' },
  { hex: '#C45608', labelKey: 'calendar_notes.color_orange' },
  { hex: '#B5892C', labelKey: 'calendar_notes.color_amber' },
  { hex: '#B04A3E', labelKey: 'calendar_notes.color_red' },
  { hex: '#6B665E', labelKey: 'calendar_notes.color_neutral' },
];

const PALETTE_HEXES = new Set(CALENDAR_NOTE_PALETTE.map(c => c.hex.toLowerCase()));

/** Color por defecto cuando la entrada no trae ninguno, según el tipo. */
const DEFAULT_COLOR: Record<CalendarNoteType, string> = {
  REMINDER: '#3C6E96',
  TIME_BLOCK: '#6B665E',
};

/**
 * Color de pintado de una entrada.
 *
 * Como el backend no valida `color`, una entrada creada por otro cliente (la
 * app móvil, por ejemplo) puede traer cualquier cosa: se descarta lo que no
 * pertenezca a la paleta en lugar de inyectarlo en el DOM como estilo.
 */
export function noteColor(note: Pick<CalendarNoteDto, 'color' | 'type'>): string {
  const raw = note.color?.trim().toLowerCase() ?? '';
  return PALETTE_HEXES.has(raw) ? raw : DEFAULT_COLOR[note.type];
}

/** Un `REMINDER` con `startTime === endTime` es puntual: se pinta como marca. */
export function isPointInTime(note: Pick<CalendarNoteDto, 'startTime' | 'endTime'>): boolean {
  return note.startTime === note.endTime;
}

/**
 * Rango UTC de un día completo **resuelto en la zona del usuario**.
 *
 * El backend no normaliza zonas: si se envía `00:00Z–23:59Z`, el bloqueo queda
 * desplazado una o dos horas respecto a lo que ve el usuario y bloquea franjas
 * equivocadas. Por eso el rango se construye desde la medianoche local.
 */
export function allDayRange(date: Date): { startTime: string; endTime: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

/**
 * Recorta las entradas al rango visible.
 *
 * El `GET` filtra por solapamiento, no por contención, así que devuelve
 * entradas que empiezan antes o acaban después del rango pedido. Se conserva la
 * entrada completa (el detalle debe seguir mostrando sus fechas reales) y solo
 * se descarta la que no toca el rango.
 */
export function clipToRange(notes: CalendarNoteDto[], from: string, to: string): CalendarNoteDto[] {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  return notes.filter(n => {
    const startMs = new Date(n.startTime).getTime();
    const endMs = new Date(n.endTime).getTime();
    // Intervalo semiabierto, igual que el backend: una entrada que acaba justo
    // en `from` queda fuera, y una que empieza justo en `to` también.
    return (endMs > fromMs || startMs === endMs) && startMs < toMs;
  });
}

/**
 * ¿La franja `[startMs, endMs)` choca con algún bloqueo?
 *
 * Mismo criterio semiabierto que el backend: una cita que termina exactamente a
 * las 10:00 no choca con un bloqueo que empieza a las 10:00. Solo cuentan los
 * `TIME_BLOCK`; un `REMINDER` nunca bloquea nada.
 */
export function overlapsTimeBlock(notes: CalendarNoteDto[], startMs: number, endMs: number): boolean {
  return notes.some(n => {
    if (n.type !== 'TIME_BLOCK') return false;
    const blockStart = new Date(n.startTime).getTime();
    const blockEnd = new Date(n.endTime).getTime();
    return blockStart < endMs && blockEnd > startMs;
  });
}
