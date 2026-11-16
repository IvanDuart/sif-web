import type { ToolResult } from '../client-tool.model';
import type { PersonSaveOutcome, PersonSaveService } from '../person-save.service';
import type { QuestionService } from '../question.service';

/** Lo más largo que se le enseña a nadie de una pregunta. */
const QUESTION_MAX = 300;
/** Más opciones que esto ya no es elegir, es leer una lista. */
const MAX_OPTIONS = 6;

function options(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim())
    .slice(0, MAX_OPTIONS);
}

/**
 * `ask_user`: el modelo pregunta algo que no sabe y espera la respuesta dentro
 * del mismo turno.
 *
 * Sin esto, cualquier hueco (¿qué día?, ¿cuál de las dos Anas?) obliga a
 * terminar el turno, decirlo y empezar otro, perdiendo lo que llevaba hecho.
 *
 * No es una confirmación: no escribe nada ni autoriza nada. Si hay que
 * autorizar algo, eso es `confirm_action` o la pregunta de `press`.
 */
export async function runAskUser(
  args: Record<string, unknown>,
  { questions, saves, signal }: { questions: QuestionService; saves?: PersonSaveService; signal: AbortSignal },
): Promise<ToolResult> {
  const text = typeof args['question'] === 'string' ? args['question'].trim() : '';
  if (text === '') return { ok: false, reason: 'tool_error' };

  // Pulsar Guardar mientras la mascota espera también es contestar
  // (`onPersonSave` de Neki). Si no, «revísalo y guárdalo, luego sigo» dejaba el
  // turno colgado hasta que alguien escribiera algo.
  const save: { pressed: Promise<{ label: string; outcome: PersonSaveOutcome }> | null } = { pressed: null };
  const stop = saves?.watch((button) => {
    const label = button.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const outcome = saves.outcome(button, signal);
    save.pressed = outcome.then((result) => {
      // La pregunta se suelta cuando ya se sabe cómo acabó: mientras tanto
      // sigue a la vista, que es lo que la persona estaba contestando.
      questions.release();
      return { label, outcome: result };
    });
  });

  try {
    const answer = await questions.ask(
      { kind: 'ask', text: text.slice(0, QUESTION_MAX), options: options(args['options']) },
      signal,
    );
    if (save.pressed) return savedByPerson(await save.pressed);
    if (answer.ok) return { ok: true, answer: answer.value };
    return { ok: false, reason: answer.reason === 'declined' ? 'user_declined' : answer.reason };
  } finally {
    stop?.();
  }
}

/**
 * Lo que se le cuenta al modelo cuando la respuesta fue pulsar Guardar. Lleva
 * la nota en palabras porque es lo que evita los dos errores caros: volver a
 * guardar lo que ya está guardado, y decir «hecho» cuando no se guardó.
 */
export function savedByPerson({ label, outcome }: { label: string; outcome: PersonSaveOutcome }): ToolResult {
  const base = { ok: true, answered: true, pressedByPerson: label };
  if (outcome.saved) {
    return {
      ...base,
      saved: true,
      note: `La persona ha pulsado «${label}» y se ha guardado. No lo vuelvas a guardar ni le pidas confirmación: sigue con lo que quedaba.`,
    };
  }
  if (outcome.reason === 'form_has_errors') {
    return {
      ...base,
      saved: false,
      reason: 'form_has_errors',
      errors: outcome.errors,
      note: 'La persona ha pulsado guardar, pero el formulario tiene errores y no se ha enviado. Díselo con el motivo; no digas que está hecho.',
    };
  }
  if (outcome.reason === 'not_sent') {
    return {
      ...base,
      saved: false,
      reason: 'not_sent',
      note: 'La persona ha pulsado el botón pero no ha llegado a enviarse nada (por ejemplo, dijo que no en la confirmación). No digas que está hecho; pregúntale cómo quiere seguir.',
    };
  }
  if (outcome.reason === 'rejected') {
    return {
      ...base,
      saved: false,
      reason: 'rejected',
      status: outcome.status,
      note: 'La persona ha pulsado guardar, pero el servidor lo ha rechazado. Díselo; no digas que está hecho.',
    };
  }
  return {
    ...base,
    saved: false,
    reason: 'unknown',
    note: 'La persona ha pulsado guardar, pero no he podido comprobar que se haya guardado. No digas que está hecho.',
  };
}
