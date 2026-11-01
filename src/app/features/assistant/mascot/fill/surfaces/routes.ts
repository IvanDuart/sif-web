/**
 * Dónde vive el formulario de cada tool.
 *
 * Hace falta porque una propuesta de escritura **no trae navegación**: el
 * backend emite su `NAVIGATE` en el `apply`, es decir después de confirmar
 * (`AssistantPreparedAction` ni siquiera tiene campo para `uiActions`). Así
 * que si la persona pide "cambia el horario" desde el panel principal, cuando
 * llega la propuesta no hay en pantalla ni el formulario ni el botón que lo
 * abre, y la acción se quedaba siempre en la tarjeta de confirmar.
 *
 * Con esto la mascota va ella a la pantalla donde está el formulario, y desde
 * allí sigue el camino de siempre: pestaña, botón, y a escribir.
 *
 * Es una lista cerrada, como las pantallas de `navigate_to`: una tool que no
 * esté aquí no navega a ninguna parte.
 */
export interface FillRoute {
  /** Las tools cuyo formulario está en esta pantalla. */
  tools: readonly string[];
  commands: readonly string[];
  queryParams?: Record<string, string>;
  /**
   * El formulario vive en la ficha de un paciente, así que `:patientId` del
   * `commands` se sustituye por el paciente de la sesión. Sin paciente no se
   * navega: abrir la ficha de quien no es sería peor que no hacer nada.
   */
  needsPatient?: boolean;
}

const SETTINGS = (tab: string, section?: string): Pick<FillRoute, 'commands' | 'queryParams'> => ({
  commands: ['/settings'],
  queryParams: section ? { tab, section } : { tab },
});

export const FILL_ROUTES: readonly FillRoute[] = [
  // ── Configuración del centro ──────────────────────────────────────
  { tools: ['create_schedule', 'update_schedule'], ...SETTINGS('schedules', 'schedules') },
  { tools: ['assign_schedule', 'update_schedule_assignment'], ...SETTINGS('schedules', 'assignments') },
  { tools: ['create_holiday'], ...SETTINGS('schedules', 'holidays') },
  { tools: ['create_appointment_type', 'update_appointment_type'], ...SETTINGS('appointment-types') },
  { tools: ['update_tenant_profile'], ...SETTINGS('address') },

  // ── Ficha del paciente ────────────────────────────────────────────
  {
    tools: [
      'create_measurement',
      'update_measurement',
      'update_anamnesis',
      'update_clinical_status',
      'assign_nutritionist',
      'create_patient_event',
      'create_menu_from_template',
      'create_appointment',
      'reschedule_appointment',
    ],
    commands: ['/users', ':patientId'],
    needsPatient: true,
  },
];

/** La pantalla donde se rellena esa tool, si la mascota sabe llegar. */
export function routeForTool(toolName: string): FillRoute | null {
  return FILL_ROUTES.find((route) => route.tools.includes(toolName)) ?? null;
}

/** La ruta concreta, con el paciente puesto. `null` si hace falta y no lo hay. */
export function resolveFillRoute(
  route: FillRoute,
  patientId: string | null,
): { commands: string[]; queryParams?: Record<string, string> } | null {
  if (!route.needsPatient) {
    return { commands: [...route.commands], queryParams: route.queryParams };
  }
  if (!patientId) return null;
  return {
    commands: route.commands.map((part) => (part === ':patientId' ? patientId : part)),
    queryParams: route.queryParams,
  };
}
