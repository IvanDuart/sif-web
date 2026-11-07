import { TuiTime } from '@taiga-ui/cdk';

import type { AssistantPageContext } from '../../../core/api/models/assistant.model';

/** El presupuesto del backend para lo que hay en pantalla, en caracteres. */
export const PAGE_CONTEXT_BUDGET = 22_000;
/** Un valor suelto más largo que esto se corta. */
export const MAX_VALUE_CHARS = 4_000;

/** Lo que cada pantalla aporta además de sus formularios. */
export type PageExtras = Record<string, unknown>;

/**
 * Un valor tal y como se le cuenta al modelo: los de Taiga (`TuiDay`,
 * `TuiTime`) se escriben como en el formulario, y lo demás como texto o
 * número. `null` y vacío llegan como `null`: el backend los presenta como
 * «(vacío)».
 */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return cut(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(serializeValue);
  // `TuiTime` no tiene `toJSON`: sin esto una hora llegaría como «(vacío)».
  if (value instanceof TuiTime) return value.toString('HH:MM');
  if (typeof value === 'object' && 'toJSON' in value && typeof value.toJSON === 'function') {
    return serializeValue(value.toJSON());
  }
  return null;
}

function cut(text: string): string {
  return text.length <= MAX_VALUE_CHARS ? text : `${text.slice(0, MAX_VALUE_CHARS)}…(cortado)`;
}

const sizeOf = (context: AssistantPageContext): number => JSON.stringify(context).length;

/**
 * El contexto, con presupuesto. Se recorta por este orden: primero los
 * `extras` (lo prescindible), y solo después los formularios, empezando por
 * los más antiguos. Los valores de los formularios son lo último que se toca
 * porque `edit_` copia de ahí el fragmento exacto que cambia.
 *
 * El backend vuelve a recortar con su propio tope: esto evita mandar de más.
 */
export function fitPageContext(context: AssistantPageContext, budget = PAGE_CONTEXT_BUDGET): AssistantPageContext {
  let fitted: AssistantPageContext = { ...context };
  if (sizeOf(fitted) <= budget) return fitted;

  if (fitted.extras) {
    fitted = { route: fitted.route, title: fitted.title, forms: fitted.forms };
    if (sizeOf(fitted) <= budget) return fitted;
  }

  // Se quitan primero los formularios más antiguos: el último en montarse es
  // el diálogo en el que la persona está trabajando, y es el que `edit_` necesita.
  const forms = [...(fitted.forms ?? [])];
  while (forms.length > 1 && sizeOf({ ...fitted, forms }) > budget) forms.shift();
  return { ...fitted, forms };
}
