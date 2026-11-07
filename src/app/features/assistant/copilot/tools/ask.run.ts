import type { ToolResult } from '../client-tool.model';
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
  { questions, signal }: { questions: QuestionService; signal: AbortSignal },
): Promise<ToolResult> {
  const text = typeof args['question'] === 'string' ? args['question'].trim() : '';
  if (text === '') return { ok: false, reason: 'tool_error' };

  const answer = await questions.ask(
    { kind: 'ask', text: text.slice(0, QUESTION_MAX), options: options(args['options']) },
    signal,
  );

  if (answer.ok) return { ok: true, answer: answer.value };
  return { ok: false, reason: answer.reason === 'declined' ? 'user_declined' : answer.reason };
}
