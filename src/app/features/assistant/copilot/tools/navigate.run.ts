import type { Router } from '@angular/router';

import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { ToolResult } from '../client-tool.model';
import { routeForScreen } from '../screen-routes';

/** Lo que se le da a la pantalla nueva para montar y apuntar sus formularios. */
const SETTLE_MIN_MS = 250;
const SETTLE_MAX_MS = 2000;

/**
 * `navigate`: cambia de pantalla.
 *
 * Solo va a las pantallas de `NAVIGABLE_SCREENS`, y a la ficha de un paciente
 * solo si se le dice cuál. Devuelve el catálogo de la pantalla nueva: navegar
 * cambia por completo lo que se puede hacer, y sin esto el modelo gastaría un
 * paso en preguntarlo.
 */
export async function runNavigate(
  args: Record<string, unknown>,
  {
    router,
    fill,
    signal,
    catalog,
    closePanel,
  }: {
    router: Router;
    fill: MascotFillService;
    signal: AbortSignal;
    catalog: () => unknown;
    closePanel: () => void;
  },
): Promise<ToolResult> {
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  const screen = typeof args['screen'] === 'string' ? args['screen'] : '';
  const params = typeof args['params'] === 'object' && args['params'] !== null
    ? (args['params'] as Record<string, unknown>)
    : args;

  const route = routeForScreen(screen, params);
  if (!route) return { ok: false, reason: 'tool_error', screen };

  // El panel tapa la pantalla a la que se va: si la mascota va a enseñar algo
  // allí, lo primero es dejarlo ver.
  closePanel();
  const navigated = await router.navigate(route.commands, { queryParams: route.queryParams });
  if (!navigated) return { ok: false, reason: 'tool_error', screen };

  // Se le da un respiro a la pantalla nueva: los formularios se apuntan al
  // montarse, y declarar el catálogo antes de eso lo devolvería vacío.
  await fill.wait(SETTLE_MIN_MS);
  const deadline = Date.now() + (SETTLE_MAX_MS - SETTLE_MIN_MS);
  while (fill.surfaces().length === 0 && Date.now() < deadline) {
    await fill.wait(120);
  }

  return { ok: true, route: router.url, clientTools: catalog() };
}
