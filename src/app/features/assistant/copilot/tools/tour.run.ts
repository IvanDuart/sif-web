import { goToElement, preferredTiming } from '../../mascot/fill/animated-fill';
import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { CursorService } from '../cursor.service';
import type { ToolResult } from '../client-tool.model';
import { resolvePointable } from '../pointing';

/** Lo que se queda en cada parada diciendo lo suyo. */
const STOP_MS = 2600;

interface Stop {
  control: string;
  say: string;
}

function parseStops(raw: unknown): Stop[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    const control = typeof row['control'] === 'string' ? row['control'].trim() : '';
    return control === '' ? [] : [{ control, say: typeof row['say'] === 'string' ? row['say'] : '' }];
  });
}

/**
 * `show_around`: un recorrido por varios controles, diciendo algo en cada uno.
 *
 * Es `point_at` varias veces, pero en una sola llamada: enseñar una pantalla
 * de cinco sitios gastaría cinco pasos del presupuesto y el modelo se quedaría
 * sin turno a mitad de la explicación.
 *
 * Se puede detener entre paradas, y las que no estén en pantalla se saltan en
 * vez de cortar el recorrido.
 */
export async function runShowAround(
  args: Record<string, unknown>,
  { fill, cursor, signal }: { fill: MascotFillService; cursor: CursorService; signal: AbortSignal },
): Promise<ToolResult> {
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  const stops = parseStops(args['stops']);
  if (stops.length === 0) return { ok: false, reason: 'tool_error' };

  const timing = preferredTiming();
  const visited: string[] = [];
  const skipped: string[] = [];

  fill.begin();
  try {
    for (const stop of stops) {
      await cursor.whenResumed();
      if (signal.aborted || fill.skipRequested) break;
      const found = resolvePointable(stop.control);
      if (found === 'control_gone' || found === 'control_disabled') {
        skipped.push(stop.control);
        continue;
      }
      if (!(await goToElement(found.element, timing, fill))) {
        skipped.push(stop.control);
        continue;
      }
      if (stop.say !== '') fill.saying.set({ key: 'assistant.tour_saying', values: { text: stop.say } });
      await fill.wait(STOP_MS);
      visited.push(stop.control);
    }
  } finally {
    fill.end();
  }

  return { ok: visited.length > 0, stops: visited, skipped };
}
