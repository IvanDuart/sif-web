import type { FillOpener, FillSurface } from '../descriptor';

/**
 * El diálogo de una cita de la agenda (`appointments/appointment-action.dialog`),
 * para cambiarle el estado: atendida, no asistió o cancelada.
 *
 * No es un formulario que se rellene: son botones. La mascota no los pulsa
 * (D4: lo que escribe, lo decide la persona). Abre la cita, **señala** con
 * `point_at` el botón que toca (`appointment-attended`, `appointment-no-show`,
 * `appointment-cancel`) y espera con `ask_user`; el clic de la persona es la
 * respuesta, porque los botones llevan `data-mascot-submit`.
 *
 * Por eso no tiene campos (no sale `fill_`), pero sí se apunta: es lo que hace
 * que `open_appointment_status` sepa que el diálogo llegó a abrirse y de qué
 * cita es (`subject`), y lo que retira `update_appointment_status` del backend.
 */
export function appointmentStatusSurface(appointmentId: () => string): FillSurface {
  return {
    id: 'appointment-status',
    tools: ['update_appointment_status'],
    fields: [],
    subject: appointmentId,
  };
}

/**
 * Se abre pulsando la cita en el calendario, que FullCalendar pinta y la
 * página marca con `data-mascot-appointment`. Para que la cita esté en
 * pantalla hay que llegar a su día: `navigate` a `AGENDA` con su `date`.
 */
export const APPOINTMENT_STATUS_OPENER: FillOpener = {
  id: 'appointment-status',
  tools: ['update_appointment_status'],
  screen: 'AGENDA',
  trigger: '[data-mascot-appointment="{appointmentId}"]',
  param: { name: 'appointmentId', description: 'Id de la cita. Antes, navigate a AGENDA con su date' },
};
