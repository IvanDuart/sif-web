import { playFill, preferredTiming } from '../../mascot/fill/animated-fill';
import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { CursorService } from '../cursor.service';
import type { ToolResult } from '../client-tool.model';
import { matchArgs } from '../fill-args';
import { runOpen } from './open.run';

/** Lo que se espera a que el formulario cargue sus datos (`FillSurface.ready`). */
const READY_WAIT_MS = 3000;

/**
 * `fill_<id>`: escribe en el formulario que hay en pantalla.
 *
 * El formulario se vuelve a buscar AHORA, no cuando se declaró el catálogo: el
 * turno puede haber tardado, la persona puede haber cerrado el diálogo, y
 * escribir en un formulario que ya no es el que el modelo vio sería escribir a
 * ciegas.
 *
 * No guarda: deja el formulario relleno y cuenta lo que pasó con cada campo.
 */
export async function runFill(
  surfaceId: string,
  keys: readonly string[],
  args: Record<string, unknown>,
  {
    fill,
    cursor,
    signal,
    catalog,
  }: {
    fill: MascotFillService;
    cursor: CursorService;
    signal: AbortSignal;
    /** Lo que se puede hacer ahora, para decírselo si la pantalla ha cambiado. */
    catalog: () => unknown;
  },
): Promise<ToolResult> {
  let mounted = await fill.waitForId(surfaceId, READY_WAIT_MS);

  // No está abierto, pero esta pantalla sabe abrirlo: se abre y se sigue.
  //
  // El modelo debería haber llamado antes a `open_<id>`, pero olvidarse es un
  // paso de más, no un error: rendirse aquí le devuelve `surface_gone` y lo
  // manda a escribir por detrás, que es justo lo que no queremos. Abrirlo es
  // exactamente lo que `open_<id>` haría.
  let abierto = false;
  if (!mounted && fill.openerFor(surfaceId)) {
    const opened = await runOpen(surfaceId, { fill, signal, catalog: () => undefined });
    if (opened.ok) {
      mounted = await fill.waitForId(surfaceId, READY_WAIT_MS);
      abierto = mounted !== null;
    }
  }

  if (!mounted) return { ok: false, reason: 'surface_gone' };
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  // Solo lo que ESTA herramienta declaró. Un formulario grande se parte en
  // `fill_x` y `fill_x_2`, y cada parte escribe lo suyo: aceptar aquí una
  // clave de la otra parte dejaría al modelo creyendo que la partición no va
  // en serio.
  const mine = Object.fromEntries(Object.entries(args).filter(([key]) => keys.includes(key)));
  const foreign = Object.keys(args).filter((key) => !keys.includes(key));

  const { values, unknown } = matchArgs(mounted.surface, mine);
  if (values.length === 0) {
    return { ok: false, reason: 'tool_error', unknown: [...unknown, ...foreign], written: [] };
  }

  // Detener el turno aparta a la mascota: lo escrito se queda donde esté y el
  // informe cuenta hasta dónde llegó.
  const stop = () => fill.requestSkip();
  signal.addEventListener('abort', stop, { once: true });
  try {
    const report = await playFill(mounted.surface, mounted.access, values, fill, preferredTiming(), () =>
      cursor.whenResumed(),
    );

    // Rellenar no guarda, y ya no hay con qué: guarda la persona, con el botón
    // del propio formulario. Antes se devolvía aquí el nombre de `save_<x>` y
    // el modelo lo llamaba, lo que acababa en una pregunta de sí o no en el
    // chat, lejos del formulario recién relleno.

    return {
      ok: report.written.length > 0,
      written: report.written,
      missing: report.missing,
      rejected: report.rejected,
      missingRequired: report.missingRequired,
      ...(abierto ? { opened: surfaceId, clientTools: catalog() } : {}),
      ...(unknown.length + foreign.length > 0 ? { unknown: [...unknown, ...foreign] } : {}),
      ...(report.written.length === 0 ? { reason: 'tool_error' } : {}),
    };
  } finally {
    signal.removeEventListener('abort', stop);
  }
}
