import type { AssistantClientToolDecl } from '../../../core/api/models/assistant.model';
import type { FillField, FillSurface } from '../mascot/fill/descriptor';
import { MAX_DESCRIPTION, MAX_SCHEMA_BYTES, schemaBytes } from './catalog-rules';
import { toolName } from './tool-names';

/** Un `choice` con más opciones que esto no se enumera: no cabe y puede ser gente. */
const MAX_ENUM = 12;
const MAX_ENUM_LABEL = 40;

/** Un `fill_<id>` ya montado: lo que se declara y qué campos cubre. */
export interface FillToolDecl {
  decl: AssistantClientToolDecl;
  /** Las claves de campo (y listas) que acepta, para saber qué escribir al ejecutarla. */
  keys: readonly string[];
}

type JsonSchema = Record<string, unknown>;

/**
 * El esquema de un campo. El tipo sale de cómo se escribe (`FillKind`); las
 * descripciones solo dicen el formato, lo que el modelo no puede adivinar.
 */
function fieldSchema(field: FillField, withHints: boolean): JsonSchema {
  const hint = (text: string): JsonSchema => (withHints ? { description: text } : {});

  switch (field.kind) {
    case 'number':
      return { type: 'number', ...hint('Número') };
    case 'boolean':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', ...hint('Fecha YYYY-MM-DD') };
    case 'time':
      return { type: 'string', ...hint('Hora HH:MM') };
    case 'choice': {
      // A una persona se la nombra, no se elige de una lista cerrada: los
      // nombres acabarían en el prompt y, en un buscador, la lista son solo los
      // últimos resultados.
      const options = field.people ? [] : (field.options?.() ?? []);
      const usable = options.length > 0 && options.length <= MAX_ENUM && options.every((o) => o.length <= MAX_ENUM_LABEL);
      return usable ? { type: 'string', enum: [...options] } : { type: 'string', ...hint('Nombre de la opción') };
    }
    case 'text':
      return { type: 'string' };
  }
}

/**
 * Las filas de una lista, como `array` de cadenas.
 *
 * Un `array` de `object` con campos pasaría de los 3 niveles que acepta el
 * backend (raíz → lista → fila → campo son 4) y se descartaría sin aviso. Cada
 * fila va entonces en una cadena con los campos separados por `|`, en el orden
 * que dice la descripción.
 */
function listSchema(fields: readonly FillField[]): JsonSchema {
  const order = fields.map((field) => field.key).join(' | ');
  return {
    type: 'array',
    description: `Una fila por elemento, «${order}»`,
    items: { type: 'string' },
  };
}

function parametersFor(surface: FillSurface, keys: ReadonlySet<string>, withHints: boolean): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const field of surface.fields) {
    if (keys.has(field.key)) properties[field.key] = fieldSchema(field, withHints);
  }
  for (const list of surface.lists ?? []) {
    if (keys.has(list.key)) properties[list.key] = listSchema(list.fields);
  }
  return { type: 'object', properties };
}

function describe(surface: FillSurface, part: number, parts: number): string {
  const label = surface.id.replace(/-/g, ' ');
  const suffix = parts > 1 ? ` (parte ${part} de ${parts})` : '';
  return `Rellena el formulario «${label}» abierto en pantalla${suffix}`.slice(0, MAX_DESCRIPTION);
}

/** Reparte las claves en grupos que quepan, respetando el orden del formulario. */
function split(surface: FillSurface, all: readonly string[], withHints: boolean): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const key of all) {
    const attempt = [...current, key];
    const fits = schemaBytes(parametersFor(surface, new Set(attempt), withHints)) <= MAX_SCHEMA_BYTES;
    if (fits || current.length === 0) current = attempt;
    else {
      groups.push(current);
      current = [key];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Las herramientas `fill_` de un formulario.
 *
 * El esquema tiene que caber en 2 KB o el backend lo descarta sin avisar. Se
 * intenta primero con las pistas de formato; si no cabe, sin ellas; y si aun
 * así no, se parte el formulario en varias herramientas (`fill_measurement`,
 * `fill_measurement_2`…), cada una con sus campos, en el orden del formulario.
 *
 * Devuelve `[]` si el id no da un nombre válido.
 */
export function fillTools(surface: FillSurface): FillToolDecl[] {
  const base = toolName('fill', surface.id);
  if (!base) return [];

  const all = [...surface.fields.map((field) => field.key), ...(surface.lists ?? []).map((list) => list.key)];
  if (all.length === 0) return [];

  const whole = new Set(all);
  for (const withHints of [true, false]) {
    if (schemaBytes(parametersFor(surface, whole, withHints)) <= MAX_SCHEMA_BYTES) {
      return [{ decl: { name: base, description: describe(surface, 1, 1), parameters: parametersFor(surface, whole, withHints) }, keys: all }];
    }
  }

  const groups = split(surface, all, false);
  return groups.flatMap((keys, index) => {
    const name = index === 0 ? base : toolName('fill', `${surface.id}_${index + 1}`);
    if (!name) return [];
    return [
      {
        decl: { name, description: describe(surface, index + 1, groups.length), parameters: parametersFor(surface, new Set(keys), false) },
        keys,
      },
    ];
  });
}
