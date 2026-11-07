import type { MascotAction } from '../../mascot/fill/descriptor';
import type { ToolResult } from '../client-tool.model';
import type { QuestionService } from '../question.service';
import { YES } from '../question.service';

/**
 * `action_<id>`: algo que la pantalla sabe hacer y que no es rellenar.
 *
 * Lo ejecuta la propia pantalla, con su código y sus permisos: aquí solo se
 * decide si se llega a ejecutar. Si escribe en el backend (`confirm: true`) se
 * pregunta antes, porque la regla de que nada se escribe sin un sí explícito
 * vale también para esto.
 */
export async function runAction(
  action: MascotAction,
  { questions, signal }: { questions: QuestionService; signal: AbortSignal },
): Promise<ToolResult> {
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  if (action.confirm) {
    const answer = await questions.ask(
      { kind: 'confirm', text: action.confirmText ?? action.description },
      signal,
    );
    if (!answer.ok || answer.value !== YES) return { ok: false, reason: 'user_declined', action: action.id };
  }

  await action.run();
  return { ok: true, action: action.id };
}
