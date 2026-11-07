import type { FillOpener } from '../descriptor';
import { APPOINTMENT_OPENER } from './appointment.surface';
import { APPOINTMENT_TYPE_OPENER } from './appointment-type.surface';
import { ASSIGN_NUTRITIONIST_OPENER } from './assign-nutritionist.surface';
import { CLINICAL_STATUS_OPENER } from './clinical-status.surface';
import { HOLIDAY_OPENER } from './holiday.surface';
import { MEAL_TEMPLATE_OPENER } from './meal-template.surface';
import { MEASUREMENT_OPENER } from './measurement.surface';
import { MENU_TEMPLATE_OPENER } from './menu-template.surface';
import { PATIENT_EVENT_OPENER } from './patient-event.surface';
import { SCHEDULE_ASSIGNMENT_OPENER } from './schedule-assignment.surface';
import { SCHEDULE_OPENER } from './schedule.surface';
import { TEMPLATE_OPENER } from './template.surface';
import { TENANT_PROFILE_OPENER } from './tenant-profile.surface';

/**
 * Todos los formularios que la mascota sabe abrir, y en qué pantalla.
 *
 * Esta lista es la que viaja al modelo como `reachableForms`, así que lo que
 * no esté aquí **no existe para él**. Al añadir un opener hay que añadirlo
 * también aquí; un test lo comprueba contra las superficies reales.
 */
export const ALL_OPENERS: readonly FillOpener[] = [
  MEASUREMENT_OPENER,
  APPOINTMENT_OPENER,
  CLINICAL_STATUS_OPENER,
  PATIENT_EVENT_OPENER,
  ASSIGN_NUTRITIONIST_OPENER,
  MENU_TEMPLATE_OPENER,
  SCHEDULE_OPENER,
  SCHEDULE_ASSIGNMENT_OPENER,
  HOLIDAY_OPENER,
  APPOINTMENT_TYPE_OPENER,
  TENANT_PROFILE_OPENER,
  TEMPLATE_OPENER,
  MEAL_TEMPLATE_OPENER,
];
