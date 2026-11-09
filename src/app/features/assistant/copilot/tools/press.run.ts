import { goToElement, preferredTiming } from '../../mascot/fill/animated-fill';
import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { CursorService } from '../cursor.service';
import type { ToolResult } from '../client-tool.model';
import { openDialogs, resolvePointable } from '../pointing';
import type { QuestionService } from '../question.service';
import { YES } from '../question.service';

/** Lo que se le da a la pantalla para reaccionar a la pulsación. */
const SETTLE_MS = 400;

/**
 * `press`: pulsa un control de la pantalla.
 *
 * Tres reglas, y las tres existen para que la mascota no decida nada por nadie:
 *
 * 1. Solo pulsa lo que lleva `data-mascot-point`.
 * 2. Si lo que va a hacer no se deshace, pregunta antes.
 * 3. Si al pulsar la aplicación abre SU diálogo de confirmación, la mascota no
 *    lo atraviesa: contesta `opened_dialog` y la decisión se queda donde tiene
 *    que estar, que es en la persona.
 */
export async function runPress(
  args: Record<string, unknown>,
  {
    fill,
    questions,
    cursor,
    signal,
  }: {
    fill: MascotFillService;
    questions: QuestionService;
    cursor: CursorService;
    signal: AbortSignal;
  },
): Promise<ToolResult> {
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  const id = typeof args['control'] === 'string' ? args['control'] : '';
  const found = resolvePointable(id);
  if (found === 'control_gone' || found === 'control_disabled') {
    return { ok: false, reason: found, control: id };
  }

  const before = openDialogs().length;

  const timing = preferredTiming();
  fill.begin();
  try {
    if (!(await goToElement(found.element, timing, fill))) {
      return { ok: false, reason: 'control_gone', control: id };
    }
  } finally {
    fill.end();
  }

  // Se pregunta con el control ya señalado: así se ve qué se va a pulsar, que
  // es la mitad de la pregunta.
  if (found.dangerous) {
    const answer = await questions.ask(
      { kind: 'confirm', text: found.label, dangerous: true },
      signal,
    );
    if (!answer.ok || answer.value !== YES) {
      return { ok: false, reason: 'user_declined', control: id };
    }
    // Entre la pregunta y el sí la pantalla ha podido cambiar.
    const again = resolvePointable(id);
    if (again === 'control_gone' || again === 'control_disabled') {
      return { ok: false, reason: again, control: id };
    }
    found.element = again.element;
  }

  // Lo último antes de tocar nada: si la persona pausó mientras se le
  // preguntaba, aquí se espera a que suelte.
  await cursor.whenResumed();
  if (signal.aborted) return { ok: false, reason: 'user_declined', control: id };

  fill.presses.update((count) => count + 1);
  found.element.click();
  try {
    await fill.wait(SETTLE_MS);
  } finally {
    // El anillo es de esta pulsación y de nadie más: si sobreviviera, se
    // quedaría latiendo después de que la tool haya terminado.
    fill.presses.set(0);
  }

  // La aplicación ha pedido confirmación por su cuenta: hasta aquí llega la
  // mascota.
  if (openDialogs().length > before) {
    return { ok: false, reason: 'opened_dialog', control: id, label: found.label };
  }

  return { ok: true, control: id, label: found.label };
}
