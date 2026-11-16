import { playOpen, preferredTiming } from '../../mascot/fill/animated-fill';
import { withParam } from '../../mascot/fill/descriptor';
import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { ToolResult } from '../client-tool.model';

/** Lo que se le da a un diálogo recién abierto para montar y apuntarse. */
const OPENED_WAIT_MS = 2500;

/**
 * `open_<id>`: abre el formulario pulsando el botón de la propia pantalla.
 *
 * Se pulsa el botón de verdad, no se llama al diálogo por dentro: así solo se
 * abre lo que la persona también podría abrir (sin el permiso no hay botón) y
 * la pantalla hace lo suyo —cargar datos, fijar valores por defecto— como
 * siempre.
 *
 * Devuelve el catálogo nuevo porque abrir un diálogo cambia lo que se puede
 * hacer: sin eso el modelo gastaría un paso en preguntar qué hay ahora.
 */
export async function runOpen(
  surfaceId: string,
  {
    fill,
    signal,
    catalog,
    args = {},
  }: { fill: MascotFillService; signal: AbortSignal; catalog: () => unknown; args?: Record<string, unknown> },
): Promise<ToolResult> {
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  // Ya está abierto: no se vuelve a pulsar, que abriría un segundo diálogo
  // encima o cerraría el primero.
  const registered = fill.openerFor(surfaceId);
  // De qué elemento se pide, si el botón se repite por elemento.
  const subject = registered?.param ? String(args[registered.param.name] ?? '').trim() : undefined;

  const open = fill.forId(surfaceId);
  if (open && (subject === undefined || open.surface.subject?.() === subject)) {
    return { ok: true, opened: surfaceId, alreadyOpen: true, clientTools: catalog() };
  }

  if (!registered) return { ok: false, reason: 'control_gone' };
  // El botón de qué elemento: sin un id válido no se pulsa nada, porque
  // pulsar el primero que se vea abriría el de otra comida.
  const opener = withParam(registered, args);
  if (!opener) return { ok: false, reason: 'invalid_args', param: registered.param?.name };

  const stop = () => fill.requestSkip();
  signal.addEventListener('abort', stop, { once: true });
  try {
    fill.begin();
    let mounted = null;
    try {
      if (await playOpen(opener, preferredTiming(), fill)) {
        mounted = await fill.waitForId(surfaceId, OPENED_WAIT_MS, subject);
      }
    } finally {
      fill.end();
    }
    if (!mounted) return { ok: false, reason: 'control_gone' };
    return { ok: true, opened: surfaceId, clientTools: catalog() };
  } finally {
    signal.removeEventListener('abort', stop);
  }
}
