import { findAnchor, preferredTiming, visualTarget } from '../../mascot/fill/animated-fill';
import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { ToolResult } from '../client-tool.model';
import { applyTextEdit, type TextEdit, type TextEditOp } from '../text-edit';

const READY_WAIT_MS = 3000;

const OPS: readonly TextEditOp[] = ['append', 'prepend', 'insert_after', 'insert_before', 'replace', 'delete'];

function isOp(value: unknown): value is TextEditOp {
  return typeof value === 'string' && (OPS as readonly string[]).includes(value);
}

/**
 * `edit_<id>`: cambia un trozo de un texto largo del formulario en pantalla.
 *
 * No teclea letra a letra como `fill_`: una edición en medio de un párrafo
 * tecleada se ve como un destrozo. Pone el texto nuevo de golpe y lleva la
 * mascota hasta el campo para que se vea cuál ha cambiado.
 */
export async function runEdit(
  surfaceId: string,
  keys: readonly string[],
  args: Record<string, unknown>,
  { fill, signal }: { fill: MascotFillService; signal: AbortSignal },
): Promise<ToolResult> {
  const key = typeof args['field'] === 'string' ? args['field'] : '';
  if (!keys.includes(key) || !isOp(args['op'])) return { ok: false, reason: 'tool_error' };

  const mounted = await fill.waitForId(surfaceId, READY_WAIT_MS);
  if (!mounted) return { ok: false, reason: 'surface_gone' };
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  const field = mounted.surface.fields.find((candidate) => candidate.key === key);
  if (!field) return { ok: false, reason: 'surface_gone' };

  const before = mounted.access.get(key);
  const current = before === null || before === undefined ? '' : String(before);

  const edit: TextEdit = {
    op: args['op'],
    text: typeof args['text'] === 'string' ? args['text'] : undefined,
    anchor: typeof args['anchor'] === 'string' ? args['anchor'] : undefined,
  };
  const result = applyTextEdit(current, edit);
  if (!result.ok) return { ok: false, reason: result.reason };
  // Una edición que no cambia nada es un sí engañoso: el modelo daría por
  // hecho un cambio que no está.
  if (result.text === current) return { ok: false, reason: 'not_found' };

  fill.begin();
  try {
    const anchor = findAnchor(mounted.surface.id, field);
    if (anchor) {
      fill.saying.set({ key: 'assistant.fill_writing', values: { field: key } });
      fill.target.set(visualTarget(anchor));
      await fill.wait(preferredTiming().hopMs);
    }
    mounted.access.set(key, result.text);
  } finally {
    fill.end();
  }

  return { ok: true, field: key, op: edit.op, length: result.text.length };
}
