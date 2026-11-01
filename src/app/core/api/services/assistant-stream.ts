import type { AssistantStreamEvent, AssistantTurnResponse } from '../models/assistant.model';

/**
 * El troceado del stream del asistente (`doc/assistant-frontend.md` §3.1).
 *
 * Va aparte del servicio y sin HTTP a propósito: lo que tiene miga no es la
 * llamada sino partir el texto, que llega a pedazos que no respetan ni las
 * líneas. Aquí se puede probar con cadenas sueltas.
 *
 * Un marco de SSE son líneas hasta un renglón en blanco:
 *
 * ```
 * event: delta
 * data: {"text":"Voy a buscar"}
 *
 * ```
 */

/** Lo que se ha podido trocear de lo que va llegando, y por dónde se quedó. */
export interface SseScan {
  frames: string[];
  /** Lo consumido del buffer: el resto es un marco a medias que aún no vale. */
  consumed: number;
}

/**
 * Parte en marcos lo que haya llegado desde `from`. Lo que queda tras el
 * último renglón en blanco se deja para la siguiente vuelta: puede ser medio
 * JSON.
 */
export function scanFrames(buffer: string, from: number): SseScan {
  const frames: string[] = [];
  let at = from;

  for (;;) {
    // `\r\n\r\n` también: el contrato no dice qué finales de línea manda.
    const end = nextBreak(buffer, at);
    if (end === null) return { frames, consumed: at };
    frames.push(buffer.slice(at, end.start));
    at = end.next;
  }
}

function nextBreak(buffer: string, from: number): { start: number; next: number } | null {
  const plain = buffer.indexOf('\n\n', from);
  const crlf = buffer.indexOf('\r\n\r\n', from);
  if (plain === -1 && crlf === -1) return null;
  if (crlf !== -1 && (plain === -1 || crlf < plain)) return { start: crlf, next: crlf + 4 };
  return { start: plain, next: plain + 2 };
}

/**
 * Un marco, ya entendido. Devuelve `null` para lo que no nos toca: los
 * comentarios (`:` de mantener viva la conexión), los tipos que no conocemos y
 * lo que venga con el JSON roto — nada de eso debe tumbar el turno.
 */
export function parseFrame(raw: string): AssistantStreamEvent | null {
  let name = '';
  const data: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // Un solo espacio tras los dos puntos es del formato, no del dato.
    const value = colon === -1 ? '' : line.slice(line[colon + 1] === ' ' ? colon + 2 : colon + 1);

    if (field === 'event') name = value.trim();
    // Varias líneas `data:` son un solo dato con saltos de línea dentro.
    else if (field === 'data') data.push(value);
  }

  if (data.length === 0) return null;
  const payload = asObject(data.join('\n'));
  if (!payload) return null;

  switch (name) {
    case 'delta': {
      const text = payload['text'];
      return typeof text === 'string' && text !== '' ? { kind: 'delta', text } : null;
    }
    case 'tool': {
      const toolName = payload['name'];
      return typeof toolName === 'string' && toolName !== '' ? { kind: 'tool', name: toolName } : null;
    }
    case 'done':
      return isTurn(payload) ? { kind: 'done', turn: payload as unknown as AssistantTurnResponse } : null;
    case 'error':
      return {
        kind: 'error',
        error: typeof payload['error'] === 'string' ? payload['error'] : '',
        code: typeof payload['code'] === 'string' ? payload['code'] : null,
      };
    default:
      return null;
  }
}

function asObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Lo mínimo para fiarse del `done`: sin mensaje no hay turno que pintar. */
function isTurn(payload: Record<string, unknown>): boolean {
  const message = payload['assistantMessage'];
  return typeof message === 'object' && message !== null;
}
