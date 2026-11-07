import type { FillSurface } from '../mascot/fill/descriptor';
import { appointmentSurface } from '../mascot/fill/surfaces/appointment.surface';
import { APPOINTMENT_TYPE_SURFACE } from '../mascot/fill/surfaces/appointment-type.surface';
import { assignNutritionistSurface } from '../mascot/fill/surfaces/assign-nutritionist.surface';
import { CALENDAR_NOTE_SURFACE } from '../mascot/fill/surfaces/calendar-note.surface';
import { clinicalStatusSurface } from '../mascot/fill/surfaces/clinical-status.surface';
import { holidaySurface } from '../mascot/fill/surfaces/holiday.surface';
import { mealSurface } from '../mascot/fill/surfaces/meal.surface';
import { MEASUREMENT_SURFACE } from '../mascot/fill/surfaces/measurement.surface';
import { MENU_RENAME_SURFACE } from '../mascot/fill/surfaces/menu-rename.surface';
import { menuTemplateSurface } from '../mascot/fill/surfaces/menu-template.surface';
import { PATIENT_EVENT_SURFACE } from '../mascot/fill/surfaces/patient-event.surface';
import { PATIENT_PROFILE_SURFACE } from '../mascot/fill/surfaces/patient-profile.surface';
import { scheduleAssignmentSurface } from '../mascot/fill/surfaces/schedule-assignment.surface';
import { scheduleSurface } from '../mascot/fill/surfaces/schedule.surface';
import { tenantProfileSurface } from '../mascot/fill/surfaces/tenant-profile.surface';

const options = (...labels: string[]) => () => labels.map((label) => ({ label, value: label.toLowerCase() }));

/**
 * Las 15 surfaces tal y como las montan sus diálogos, con opciones de relleno.
 * Es lo que permite probar el catálogo contra los formularios reales y no
 * contra uno inventado.
 */
export function allSurfaces(): FillSurface[] {
  return [
    appointmentSurface({
      patients: options('Ana García', 'Luis Pérez'),
      nutritionists: options('Marta Ruiz'),
      types: options('Primera visita', 'Revisión'),
    }),
    APPOINTMENT_TYPE_SURFACE,
    assignNutritionistSurface({ nutritionists: options('Marta Ruiz') }),
    CALENDAR_NOTE_SURFACE,
    clinicalStatusSurface({ statuses: options('Activo', 'Baja') } as never),
    holidaySurface({ types: options('Nacional', 'Local') } as never),
    mealSurface({ days: options('Lunes', 'Martes'), mealTypes: options('Desayuno', 'Comida') } as never),
    MEASUREMENT_SURFACE,
    MENU_RENAME_SURFACE,
    menuTemplateSurface({ templates: options('Mediterránea') } as never),
    PATIENT_EVENT_SURFACE,
    PATIENT_PROFILE_SURFACE,
    scheduleAssignmentSurface({ schedules: options('Mañanas') } as never),
    scheduleSurface({ days: options('Lunes', 'Martes'), blocks: () => 0 } as never),
    tenantProfileSurface({
      loaded: () => true,
      countries: options('España'),
      states: options('Madrid'),
      cities: options('Madrid'),
    }),
  ];
}
