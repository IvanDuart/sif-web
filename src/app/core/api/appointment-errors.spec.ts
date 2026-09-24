import {
  apiErrorText,
  appointmentErrorKey,
  isOverlapConflict,
  isPatientBusyConflict,
  resolveAppointmentError,
} from './appointment-errors';

/**
 * Un `409` mal clasificado hacía que el panel del profesional ofreciese
 * "agendar en paralelo" para CUALQUIER conflicto. El caso real que lo destapó:
 * un paciente que ya tiene una cita activa devuelve `409` para cualquier hora,
 * así que el usuario veía "Horario ocupado" eligiese la hora que eligiese.
 * Estas pruebas fijan esa distinción, que es la que evita el diálogo engañoso.
 */
describe('appointment-errors', () => {
  const httpError = (status: number, body: unknown) => ({ status, error: body });

  describe('formas del cuerpo de error', () => {
    it('lee el código en `error`', () => {
      expect(apiErrorText(httpError(409, { error: 'error.appointment_overlap' }))).toBe(
        'error.appointment_overlap'
      );
    });

    it('lee el mensaje en prosa en `error`', () => {
      expect(
        apiErrorText(
          httpError(409, { error: 'The nutritionist already has an appointment in that time slot' })
        )
      ).toBe('The nutritionist already has an appointment in that time slot');
    });

    it('acepta un cuerpo que es una cadena', () => {
      expect(apiErrorText(httpError(400, 'algo salió mal'))).toBe('algo salió mal');
    });

    it('no revienta sin cuerpo', () => {
      expect(apiErrorText(httpError(500, null))).toBe('');
      expect(apiErrorText(undefined)).toBe('');
    });
  });

  describe('solape vs. paciente ocupado', () => {
    it('reconoce el solape por código', () => {
      const err = httpError(409, { error: 'error.appointment_overlap' });
      expect(isOverlapConflict(err)).toBe(true);
      expect(isPatientBusyConflict(err)).toBe(false);
    });

    it('reconoce el solape por mensaje en prosa', () => {
      const err = httpError(409, {
        error: 'The nutritionist already has an appointment in that time slot',
      });
      expect(isOverlapConflict(err)).toBe(true);
    });

    it('NO trata como solape al paciente con cita activa (código)', () => {
      const err = httpError(409, { error: 'error.appointment_patient_has_active' });
      expect(isPatientBusyConflict(err)).toBe(true);
      expect(isOverlapConflict(err)).toBe(false);
    });

    it('NO trata como solape al paciente con cita activa (prosa)', () => {
      const err = httpError(409, {
        error: 'This patient already has an upcoming appointment. Use reschedule to change it',
      });
      expect(isPatientBusyConflict(err)).toBe(true);
      expect(isOverlapConflict(err)).toBe(false);
    });

    it('asume solape en un 409 sin cuerpo (comportamiento histórico)', () => {
      expect(isOverlapConflict(httpError(409, null))).toBe(true);
    });

    it('un 400 de horario no es un solape', () => {
      const err = httpError(400, { error: 'error.appointment_outside_operating_hours' });
      expect(isOverlapConflict(err)).toBe(false);
    });
  });

  describe('traducción del error', () => {
    const translate = (key: string) => `t:${key}`;

    it('traduce los códigos conocidos', () => {
      expect(
        resolveAppointmentError(
          httpError(409, { error: 'error.appointment_patient_has_active' }),
          'appointments.create_error',
          translate
        )
      ).toBe('t:appointments.patient_has_active');

      expect(
        appointmentErrorKey(httpError(400, { error: 'error.appointment_in_past' }))
      ).toBe('appointments.in_past');

      expect(
        appointmentErrorKey(httpError(400, { error: 'error.appointment_outside_operating_hours' }))
      ).toBe('appointments.outside_operating_hours');
    });

    it('traduce también la prosa documentada del paciente ocupado', () => {
      expect(
        resolveAppointmentError(
          httpError(409, {
            error: 'This patient already has an upcoming appointment. Use reschedule to change it',
          }),
          'appointments.create_error',
          translate
        )
      ).toBe('t:appointments.patient_has_active');
    });

    it('muestra el mensaje crudo si no reconoce el código', () => {
      expect(
        resolveAppointmentError(
          httpError(500, { error: 'boom' }),
          'appointments.create_error',
          translate
        )
      ).toBe('boom');
    });

    it('cae en la clave genérica si no hay nada que mostrar', () => {
      expect(
        resolveAppointmentError(httpError(500, null), 'appointments.create_error', translate)
      ).toBe('t:appointments.create_error');
      expect(
        resolveAppointmentError(
          httpError(409, { error: 'error.desconocido' }),
          'appointments.create_error',
          translate
        )
      ).toBe('t:appointments.conflict');
    });
  });
});
