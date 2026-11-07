import { Injectable, signal } from '@angular/core';

import type { AssistantPendingActionDto } from '../../../core/api/models/assistant.model';

/**
 * Lo que la mascota espera que alguien le conteste.
 *
 * Hay tres cosas que preguntan —la escritura que propone el backend
 * (`confirm_action`), una duda del modelo (`ask_user`) y un botón peligroso
 * antes de pulsarlo— y las tres tienen que salir por el MISMO sitio. Con una
 * bandeja por herramienta, dos preguntas a la vez se pisarían en pantalla y la
 * barra de F6 no sabría cuál pintar.
 *
 * Solo hay una pregunta en el aire: el backend no manda una herramienta nueva
 * sin la respuesta de la anterior. Si aun así llegara otra, la anterior se
 * suelta en vez de quedarse colgada.
 */

export type QuestionKind = 'confirm' | 'ask';

export interface QuestionSpec {
  kind: QuestionKind;
  /** Lo que se pregunta, tal cual se lee. */
  text: string;
  /** Respuestas sugeridas. Sin ellas, un `ask` pide texto libre. */
  options?: readonly string[];
  /** La escritura que se confirma: se pinta en la tarjeta de siempre. */
  action?: AssistantPendingActionDto;
  /** Lo que se va a hacer no se deshace (borrar, descartar, dar de baja). */
  dangerous?: boolean;
}

export interface Question extends QuestionSpec {
  id: string;
}

export type Answer =
  | { ok: true; value: string }
  /** Dijo que no. */
  | { ok: false; reason: 'declined' }
  /** Se detuvo el turno. */
  | { ok: false; reason: 'aborted' }
  /** El turno siguió sin esta pregunta: se contestó por otro lado o ya terminó. */
  | { ok: false; reason: 'superseded' };

/** La respuesta de un sí o un no, para no repetir la cadena por ahí. */
export const YES = 'yes';

interface Waiting {
  question: Question;
  resolve: (answer: Answer) => void;
}

@Injectable({ providedIn: 'root' })
export class QuestionService {
  /** Lo que hay que contestar ahora mismo, o nada. */
  readonly current = signal<Question | null>(null);

  private waiting: Waiting | null = null;
  private seq = 0;

  /**
   * Pregunta y espera. La promesa siempre se resuelve: una pregunta que no se
   * contesta deja el turno colgado, y un turno colgado es una mascota que se
   * queda pensando para siempre.
   */
  ask(spec: QuestionSpec, aborted?: AbortSignal): Promise<Answer> {
    this.release();
    if (aborted?.aborted) return Promise.resolve({ ok: false, reason: 'aborted' });

    const question: Question = { ...spec, id: `q-${(this.seq += 1)}` };
    return new Promise<Answer>((resolve) => {
      this.waiting = { question, resolve };
      this.current.set(question);
      aborted?.addEventListener(
        'abort',
        () => {
          if (this.waiting?.question.id === question.id) this.settle({ ok: false, reason: 'aborted' });
        },
        { once: true },
      );
    });
  }

  /** ¿Es esta la pregunta que está en el aire? */
  isWaiting(id: string): boolean {
    return this.waiting?.question.id === id;
  }

  /** La persona contestó. */
  answer(value: string): void {
    this.settle({ ok: true, value });
  }

  /** La persona dijo que no. */
  decline(): void {
    this.settle({ ok: false, reason: 'declined' });
  }

  /** El turno siguió sin ella: nadie la va a contestar ya. */
  release(): void {
    this.settle({ ok: false, reason: 'superseded' });
  }

  private settle(answer: Answer): void {
    const waiting = this.waiting;
    if (!waiting) return;
    this.waiting = null;
    this.current.set(null);
    waiting.resolve(answer);
  }
}
