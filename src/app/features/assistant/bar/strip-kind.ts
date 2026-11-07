import type { Question } from '../copilot/question.service';

/**
 * Qué enseña la línea de estado de la barra.
 *
 * Es una función pura y con una prioridad fija a propósito: la barra es un
 * sitio pequeño donde caben varias cosas a la vez (está pensando Y hay una
 * pregunta esperando), y sin un orden escrito acabaría enseñando lo que llegue
 * último, que no es lo mismo que lo que más importa.
 *
 * Lo que espera una respuesta gana siempre: mientras no se conteste, el turno
 * no avanza, así que es lo único que la persona puede hacer.
 */
export type StripKind =
  /** Hay que decir sí o no a algo. */
  | 'confirm'
  /** Hay que contestar algo que no es un sí o un no. */
  | 'choice'
  /** La persona ha parado a la mascota a mitad. */
  | 'paused'
  /** Está haciendo algo en la pantalla. */
  | 'acting'
  /** Está esperando al modelo. */
  | 'thinking'
  /** Lo último que dijo. */
  | 'reply'
  /** Nada que contar. */
  | 'idle';

export interface StripInput {
  question: Question | null;
  paused: boolean;
  /** Una herramienta de cliente se está ejecutando. */
  acting: boolean;
  /** Hay un turno en marcha. */
  sending: boolean;
  /** Lo último que dijo la mascota. */
  reply: string;
}

export function stripKind(input: StripInput): StripKind {
  if (input.question) return input.question.kind === 'confirm' ? 'confirm' : 'choice';
  if (input.paused) return 'paused';
  if (input.acting) return 'acting';
  if (input.sending) return 'thinking';
  return input.reply.trim() === '' ? 'idle' : 'reply';
}
