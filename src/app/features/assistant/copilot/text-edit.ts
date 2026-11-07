/**
 * Editar un texto largo sin reescribirlo (`textEdit.ts` de alkimia).
 *
 * Las observaciones de un paciente o las notas de una cita son texto que ya
 * escribió alguien. Pedirle al modelo el texto entero para cambiar una línea
 * tiene dos problemas: gasta el contexto en repetir lo que ya hay, y cualquier
 * desliz al copiarlo borra trabajo de la persona. Aquí el modelo dice qué
 * quiere cambiar y dónde, y el texto viejo no pasa por él.
 *
 * Es una función pura: no toca el DOM ni el formulario.
 */

export type TextEditOp = 'append' | 'prepend' | 'insert_after' | 'insert_before' | 'replace' | 'delete';

/** Las que necesitan un fragmento del texto actual como referencia. */
const ANCHORED: readonly TextEditOp[] = ['insert_after', 'insert_before', 'replace', 'delete'];

export interface TextEdit {
  op: TextEditOp;
  /** Lo que se escribe. `delete` no lo lleva. */
  text?: string;
  /** El fragmento del texto actual que sirve de referencia. */
  anchor?: string;
}

export type TextEditResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'not_found' | 'ambiguous' | 'tool_error' };

/** Un párrafo nuevo se separa del anterior, salvo que no haya anterior. */
function joinBelow(before: string, added: string): string {
  if (before.trim() === '') return added;
  return before.endsWith('\n') ? `${before}${added}` : `${before}\n${added}`;
}

function joinAbove(added: string, after: string): string {
  if (after.trim() === '') return added;
  return after.startsWith('\n') ? `${added}${after}` : `${added}\n${after}`;
}

/** Donde está el fragmento, exigiendo que esté UNA vez. */
function locate(current: string, anchor: string): number | 'not_found' | 'ambiguous' {
  const first = current.indexOf(anchor);
  if (first < 0) return 'not_found';
  // Dos veces es ambiguo aunque se solapen: elegir por la persona cuál de las
  // dos cambia es exactamente lo que no debe hacer.
  if (current.indexOf(anchor, first + 1) >= 0) return 'ambiguous';
  return first;
}

/** Al quitar un trozo suelen quedar dos saltos de línea pegados o un espacio doble. */
function tidy(text: string): string {
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');
}

export function applyTextEdit(current: string, edit: TextEdit): TextEditResult {
  const added = (edit.text ?? '').trim();
  const anchor = (edit.anchor ?? '').trim();

  if (ANCHORED.includes(edit.op) && anchor === '') return { ok: false, reason: 'tool_error' };
  if (edit.op !== 'delete' && added === '') return { ok: false, reason: 'tool_error' };

  if (edit.op === 'append') return { ok: true, text: joinBelow(current, added) };
  if (edit.op === 'prepend') return { ok: true, text: joinAbove(added, current) };

  const at = locate(current, anchor);
  if (at === 'not_found' || at === 'ambiguous') return { ok: false, reason: at };

  const before = current.slice(0, at);
  const after = current.slice(at + anchor.length);

  switch (edit.op) {
    case 'insert_after':
      return { ok: true, text: `${before}${anchor}${joinAbove(`\n${added}`, after)}` };
    case 'insert_before':
      return { ok: true, text: `${joinBelow(before, added)}\n${anchor}${after}` };
    case 'replace':
      return { ok: true, text: `${before}${added}${after}` };
    case 'delete':
      return { ok: true, text: tidy(`${before}${after}`).trim() };
  }
}
