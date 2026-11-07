import { Injectable, computed, inject } from '@angular/core';

import type { AssistantPendingActionDto } from '../../../core/api/models/assistant.model';
import type { ToolResult } from './client-tool.model';
import { QuestionService, YES } from './question.service';
import { ToolRegistryService } from './tool-registry.service';

/** Lo que `confirm_action` lleva en `args` (`assistant-contract` §3.2). */
interface ConfirmArgs {
  actionId?: unknown;
  toolName?: unknown;
  summary?: unknown;
  idempotencyKey?: unknown;
  expiresAt?: unknown;
  preview?: unknown;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * `confirm_action`: la escritura que propone el backend, preguntada **dentro
 * del turno**. No se declara —la emite el backend cuando el modelo propone una
 * escritura de servidor—, pero tiene que contestarse: si el navegador no
 * responde, el backend lo da por un «no» y rechaza la acción.
 *
 * La tarjeta es la de siempre (`pendingAction`); lo que cambia es por dónde
 * vuelve el sí o el no: por aquí, como resultado de la herramienta, y el turno
 * sigue. Cuando el turno ya terminó (nadie contestó en 15 min), la tarjeta se
 * queda y se resuelve por `/confirm` y `/reject`, que siguen vivos.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly registry = inject(ToolRegistryService);
  private readonly questions = inject(QuestionService);

  /**
   * La tarjeta que espera un sí o un no ahora mismo, vinculada al turno.
   *
   * Sale de la bandeja común: la tarjeta de escritura, la duda del modelo y el
   * aviso antes de pulsar algo peligroso son la misma cola, y aquí solo se
   * mira la parte que es una escritura.
   */
  readonly waiting = computed<AssistantPendingActionDto | null>(() => {
    const question = this.questions.current();
    return question?.kind === 'confirm' ? (question.action ?? null) : null;
  });

  constructor() {
    this.registry.register({
      decl: {
        name: 'confirm_action',
        description: 'La emite el backend para pedir confirmación; el navegador no la declara.',
        parameters: { type: 'object' },
      },
      offered: () => false,
      run: (args, { signal: aborted }) => this.ask(args as ConfirmArgs, aborted),
    });
  }

  /** ¿Esta tarjeta espera una respuesta por el turno (y no por REST)? */
  isLinked(actionId: string): boolean {
    return this.waiting()?.id === actionId;
  }

  /** La persona contestó en la tarjeta: la respuesta viaja como resultado de la herramienta. */
  answer(confirmed: boolean): void {
    if (confirmed) this.questions.answer(YES);
    else this.questions.decline();
  }

  /**
   * El turno siguió sin nosotros (se confirmó desde otra pestaña, o ya
   * terminó): la tarjeta deja de estar vinculada y, si sigue en pantalla,
   * se resolverá por REST.
   */
  release(): void {
    if (this.waiting()) this.questions.release();
  }

  private async ask(args: ConfirmArgs, aborted: AbortSignal): Promise<ToolResult> {
    const id = text(args.actionId);
    if (id === '') return { ok: false, reason: 'invalid_args' };

    this.release();
    const action: AssistantPendingActionDto = {
      id,
      toolName: text(args.toolName),
      summary: text(args.summary),
      idempotencyKey: text(args.idempotencyKey),
      expiresAt: text(args.expiresAt),
      preview: Array.isArray(args.preview)
        ? args.preview
            .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
            .map((item) => ({ field: text(item['label']), label: text(item['label']), value: text(item['value']) }))
        : [],
    };

    // El sí y el no vuelven por la bandeja; detener el turno la aborta sola.
    const answer = await this.questions.ask(
      { kind: 'confirm', text: action.summary, action },
      aborted,
    );
    if (answer.ok) return { ok: true, confirmed: answer.value === YES };
    // Un «no» es una respuesta; lo demás es que nadie contestó, y eso el
    // backend lo distingue: rechaza la acción en un caso y la deja viva en el otro.
    return answer.reason === 'declined'
      ? { ok: true, confirmed: false }
      : { ok: false, reason: answer.reason };
  }
}
