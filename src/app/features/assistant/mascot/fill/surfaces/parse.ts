import { TuiDay, TuiTime } from '@taiga-ui/cdk';

/**
 * De lo que dice el asistente a lo que espera el formulario.
 *
 * El backend manda texto ("Lunes", "6 de noviembre", "Ana García") y los
 * controles de Taiga quieren `TuiDay`, `TuiTime` o el valor exacto de una
 * opción. Estas funciones son el único sitio donde se traduce, y las comparten
 * todas las superficies: lo que no se pueda traducir devuelve `null` y el campo
 * se queda sin escribir, que es mejor que escribir algo que no es.
 */

/** Una opción de un desplegable. */
export interface PickOption {
  label: string;
  value: string;
}

/** Sin acentos, sin mayúsculas y sin espacios de sobra: como se comparan los nombres. */
export function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Busca la opción que el asistente nombra. Manda el id si lo manda; si no,
 * casa por nombre sin acentos ni mayúsculas, primero entero y luego por
 * principio, que es como la nombra una persona ("Ana" para "Ana García").
 */
export function pickOption(options: readonly PickOption[], raw: string): string | null {
  const byValue = options.find((option) => option.value === raw);
  if (byValue) return byValue.value;

  const match = findByLabel(options, raw);
  return match ? match.value : null;
}

/**
 * Lo mismo, pero devolviendo la ETIQUETA. Los desplegables de ajustes guardan
 * el texto que se ve, no el id (el diálogo lo resuelve al guardar), así que
 * escribir el id ahí dejaría el campo en un valor que no existe en la lista.
 */
export function pickLabel(options: readonly PickOption[], raw: string): string | null {
  const byValue = options.find((option) => option.value === raw);
  if (byValue) return byValue.label;

  const match = findByLabel(options, raw);
  return match ? match.label : null;
}

function findByLabel(options: readonly PickOption[], raw: string): PickOption | null {
  const wanted = plain(raw);
  if (wanted === '') return null;
  const exact = options.find((option) => plain(option.label) === wanted);
  if (exact) return exact;
  const starts = options.filter((option) => plain(option.label).startsWith(wanted));
  // Si dos opciones empiezan igual no se elige por la mascota: mejor dejarlo vacío.
  return starts.length === 1 ? starts[0] : null;
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

/** `#1A7F5A`, `1a7f5a`, o nada si no es un color que el selector entienda. */
export function toHexColor(raw: string): string | null {
  const match = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(raw.trim());
  if (!match) return null;
  const digits = match[1];
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return `#${full.toUpperCase()}`;
}

/** Un año de cuatro cifras, o nada. */
export function toYear(raw: string): number | null {
  const match = /(\d{4})/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? year : null;
}
