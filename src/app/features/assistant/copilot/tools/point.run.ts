import { HIGHLIGHT_ATTR, goToElement, preferredTiming } from '../../mascot/fill/animated-fill';
import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { ToolResult } from '../client-tool.model';
import { findPointable } from '../pointing';

/** Lo que se queda señalando un control antes de soltarlo. */
const HOLD_MS = 2200;

/**
 * `point_at`: lleva la mascota hasta un control y lo resalta, sin tocarlo.
 *
 * Es la mitad útil de «enséñame dónde está»: la persona ve el sitio y decide
 * ella. Pulsar es otra herramienta a propósito, para que el modelo tenga que
 * pedirlo explícitamente.
 */
export async function runPointAt(
  args: Record<string, unknown>,
  { fill, signal }: { fill: MascotFillService; signal: AbortSignal },
): Promise<ToolResult> {
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  const id = typeof args['control'] === 'string' ? args['control'] : '';
  // Señalar algo deshabilitado SÍ vale: la pregunta era dónde está, no si se
  // puede pulsar, y ver el botón gris explica por qué no se puede.
  const found = findPointable(id);
  if (!found) return { ok: false, reason: 'control_gone', control: id };

  fill.begin();
  try {
    if (!(await goToElement(found.element, preferredTiming(), fill))) {
      return { ok: false, reason: 'control_gone', control: id };
    }
    // Se queda latiendo sobre el control mientras lo explica, y lo suelta
    // pase lo que pase: un resaltado que sobrevive a la tool es una pantalla
    // que se queda señalando sola.
    found.element.setAttribute(HIGHLIGHT_ATTR, '');
    try {
      await fill.wait(HOLD_MS);
    } finally {
      found.element.removeAttribute(HIGHLIGHT_ATTR);
    }
  } finally {
    fill.end();
  }

  return { ok: true, control: id, label: found.label, dangerous: found.dangerous };
}
