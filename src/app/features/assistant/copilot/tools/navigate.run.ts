import type { Router } from '@angular/router';

import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { ToolResult } from '../client-tool.model';
import type { RouteVeilService } from '../route-veil';
import { PATIENT_SCREENS, routeForScreen } from '../screen-routes';
import type { AssistantScreen } from '../../../../core/api/models/assistant.model';

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
    veil,
  }: {
    router: Router;
    fill: MascotFillService;
    signal: AbortSignal;
    catalog: () => unknown;
    closePanel: () => void;
    /** Para que la pantalla no cambie de golpe debajo de quien mira. */
    veil: RouteVeilService;
  },
): Promise<ToolResult> {
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  const screen = typeof args['screen'] === 'string' ? args['screen'] : '';
  const params = typeof args['params'] === 'object' && args['params'] !== null
    ? (args['params'] as Record<string, unknown>)
    : args;

  // Una pantalla de paciente sin paciente NO se navega: la ruta tiene un
  // destino de reserva y llevaría al panel principal sin decir nada, que es
  // peor que no ir. Se contesta qué falta para que lo resuelva y vuelva.
  // De quién es la ficha: el que diga el modelo y, si no dice ninguno, el paciente
  // activo que añade el backend. Éste viene FRESCO —el backend lo pone al despachar
  // la llamada—, y es el único que vale: lo que tiene este navegador es el paciente
  // de la respuesta del turno anterior, porque de un `set_active_patient` se entera
  // al acabar el turno. Usarlo llevaría a la ficha de otra persona.
  //
  // Sólo en las pantallas de paciente: `MENU` con paciente va a su pestaña de menús
  // y sin él al listado, y eso no debe cambiar porque haya alguien activo.
  const esDePaciente = PATIENT_SCREENS.has(screen as AssistantScreen);
  const explicito = typeof params['patientId'] === 'string' ? params['patientId'].trim() : '';
  const activo = typeof args['activePatientId'] === 'string' ? args['activePatientId'].trim() : '';
  const patientId = explicito !== '' ? explicito : esDePaciente ? activo : '';
  if (esDePaciente && patientId === '') {
    return { ok: false, reason: 'needs_patient', screen };
  }

  const route = routeForScreen(screen, { ...params, patientId });
  if (!route) return { ok: false, reason: 'tool_error', screen };

  // El panel tapa la pantalla a la que se va: si la mascota va a enseñar algo
  // allí, lo primero es dejarlo ver.
  closePanel();
  const navigated = await veil.during(screen, () =>
    router.navigate(route.commands, { queryParams: route.queryParams }),
  );
  if (!navigated) return { ok: false, reason: 'tool_error', screen };

  // Se le da un respiro a la pantalla nueva: lo suyo se apunta al montarse, y
  // declarar el catálogo antes de eso lo devolvería vacío.
  //
  // Se espera también a los OPENERS, no sólo a los formularios montados: en la
  // ficha de un paciente no hay ningún formulario abierto todavía, y lo que el
  // modelo necesita saber es que desde aquí puede abrir la medición. Mirando
  // sólo `surfaces()` esta espera se agotaba entera para nada.
  await fill.wait(SETTLE_MIN_MS);
  const deadline = Date.now() + (SETTLE_MAX_MS - SETTLE_MIN_MS);
  while (fill.surfaces().length === 0 && fill.allOpeners().length === 0 && Date.now() < deadline) {
    await fill.wait(120);
  }

  return { ok: true, route: router.url, clientTools: catalog() };
}
