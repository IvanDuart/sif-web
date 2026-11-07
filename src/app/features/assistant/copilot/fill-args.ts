import { rowField, type FillSurface, type FillValue } from '../mascot/fill/descriptor';

/**
 * De los argumentos que manda el modelo a los campos del formulario.
 *
 * Es la vuelta de `schema.ts`: allí cada campo del descriptor se convierte en
 * una propiedad del esquema, y aquí cada propiedad vuelve a ser el campo del
 * que salió. Las dos funciones tienen que moverse juntas, y un test lo fija
 * recorriendo las 15 superficies reales.
 *
 * A diferencia de `matchPreview`, aquí las claves son las del FORMULARIO, no
 * los alias del backend: el modelo ha visto el esquema, así que no hay nada
 * que adivinar.
 */

/** Lo que se va a escribir, y lo que el modelo nombró y no existe. */
export interface MatchedArgs {
  values: FillValue[];
  /** Claves que no son de este formulario: se le dicen al modelo para que no insista. */
  unknown: string[];
}

/** Lo que separa los campos de una fila (ver `listSchema` en `schema.ts`). */
const ROW_SEPARATOR = '|';

/** Un valor del modelo como texto, que es lo que `FillField.parse` espera. */
function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return null;
  const raw = String(value).trim();
  return raw === '' ? null : raw;
}

export function matchArgs(surface: FillSurface, args: Record<string, unknown>): MatchedArgs {
  const values: FillValue[] = [];
  const claimed = new Set<string>();

  for (const field of surface.fields) {
    if (!(field.key in args)) continue;
    claimed.add(field.key);
    const raw = text(args[field.key]);
    // Un campo nombrado y vacío no es un error: el modelo deja fuera lo que no
    // sabe. Simplemente no se escribe.
    if (raw !== null) values.push({ field, raw });
  }

  for (const list of surface.lists ?? []) {
    if (!(list.key in args)) continue;
    claimed.add(list.key);
    const rows = args[list.key];
    if (!Array.isArray(rows)) continue;
    const capped = list.max === undefined ? rows : rows.slice(0, list.max);
    capped.forEach((row, index) => {
      const cells = typeof row === 'string' ? row.split(ROW_SEPARATOR) : [];
      list.fields.forEach((field, column) => {
        const raw = text(cells[column]);
        if (raw === null) return;
        values.push({ field: rowField(list, field, index), raw, grow: { list, rows: index + 1 } });
      });
    });
  }

  return { values, unknown: Object.keys(args).filter((key) => !claimed.has(key)) };
}
