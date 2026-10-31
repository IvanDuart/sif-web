/**
 * Cómo se llega a un formulario de Ajustes.
 *
 * Ajustes es maestro-detalle con pestañas y la sección de Horarios tiene a su
 * vez sub-pestañas, y en los dos casos sólo está montada la activa: el botón
 * de "Nueva jornada" no existe en el DOM hasta que alguien pulsa las dos
 * pestañas. Por eso los `FillOpener` de esta sección llevan `reveal`: la
 * mascota pulsa la pestaña, luego la sub-pestaña y luego el botón, que es
 * exactamente lo que haría una persona.
 */

/** La pestaña de Horarios dentro de Ajustes. */
export const SETTINGS_SCHEDULES_TAB = '[data-mascot-reveal="settings-tab-schedules"]';

/** Las sub-pestañas de Horarios. */
export const SCHEDULE_SUBTAB = {
  schedules: '[data-mascot-reveal="schedule-subtab-schedules"]',
  assignments: '[data-mascot-reveal="schedule-subtab-assignments"]',
  holidays: '[data-mascot-reveal="schedule-subtab-holidays"]',
} as const;

export type ScheduleSection = keyof typeof SCHEDULE_SUBTAB;

/** El camino de pestañas hasta una sub-sección de Horarios. */
export function scheduleReveal(section: ScheduleSection): readonly string[] {
  return [SETTINGS_SCHEDULES_TAB, SCHEDULE_SUBTAB[section]];
}
