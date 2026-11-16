import { fillTools, openTool } from '../../../copilot/schema';
import { withParam } from '../descriptor';
import { APPOINTMENT_STATUS_OPENER, appointmentStatusSurface } from './appointment-status.surface';

describe('estado de una cita', () => {
  it('no se rellena: son botones que pulsa la persona, así que no hay fill_', () => {
    const surface = appointmentStatusSurface(() => 'a-1');
    expect(fillTools(surface)).toEqual([]);
    expect(surface.tools).toEqual(['update_appointment_status']);
    expect(surface.subject?.()).toBe('a-1');
  });

  it('se abre pulsando ESA cita en la agenda, y open_ pide su id', () => {
    expect(APPOINTMENT_STATUS_OPENER.screen).toBe('AGENDA');
    expect(withParam(APPOINTMENT_STATUS_OPENER, { appointmentId: 'a-9' })?.trigger).toBe('[data-mascot-appointment="a-9"]');
    const decl = openTool(APPOINTMENT_STATUS_OPENER.id, APPOINTMENT_STATUS_OPENER.param);
    expect(decl?.parameters).toEqual(jasmine.objectContaining({ required: ['appointmentId'] }));
  });
});
