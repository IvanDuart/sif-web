import type { ReachableForm } from '../../../core/api/models/assistant.model';
import { slugOf } from './tool-names';

/**
 * Dónde vive cada formulario de la aplicación.
 *
 * Sin esto, el modelo sólo conoce los formularios de la pantalla en la que
 * está. Desde el panel principal `fill_measurement` no se declara, así que
 * desde donde él mira **la medición no tiene formulario**: lo único que sabe
 * para apuntar un peso es `create_measurement`, y la persona acaba confirmando
 * una tarjeta en vez de ver lo que se guarda.
 *
 * Con este mapa puede razonar «la medición se rellena en
 * `PATIENT_MEASUREMENTS`, voy allí», que es justo lo que queremos que haga
 * (`assistant-contract` §3.2).
 *
 * Es una tabla y no algo deducido de las rutas porque la relación no es
 * automática: un formulario puede vivir en una pestaña de otra pantalla, y eso
 * sólo lo sabe quien la montó.
 */

/** Lo mismo que `FillSurface.id`, para que no se puedan separar. */
type SurfaceId =
  | 'appointment'
  | 'appointment-type'
  | 'assign-nutritionist'
  | 'calendar-note'
  | 'clinical-status'
  | 'holiday'
  | 'meal'
  | 'measurement'
  | 'menu-rename'
  | 'menu-template'
  | 'patient-event'
  | 'patient-profile'
  | 'schedule'
  | 'schedule-assignment'
  | 'tenant-profile';

interface Where {
  surface: SurfaceId;
  screen: ReachableForm['screen'];
  needsPatient: boolean;
}

const WHERE: readonly Where[] = [
  // ── La ficha del paciente ─────────────────────────────────────────
  { surface: 'measurement', screen: 'PATIENT_MEASUREMENTS', needsPatient: true },
  { surface: 'appointment', screen: 'PATIENT_APPOINTMENTS', needsPatient: true },
  { surface: 'patient-profile', screen: 'PATIENT_PROFILE', needsPatient: true },
  { surface: 'clinical-status', screen: 'PATIENT_PROFILE', needsPatient: true },
  { surface: 'patient-event', screen: 'PATIENT_PROFILE', needsPatient: true },
  { surface: 'assign-nutritionist', screen: 'PATIENT_PROFILE', needsPatient: true },
  { surface: 'menu-template', screen: 'PATIENT_MENU', needsPatient: true },

  // ── Menús ─────────────────────────────────────────────────────────
  { surface: 'meal', screen: 'MENU', needsPatient: true },
  { surface: 'menu-rename', screen: 'MENUS', needsPatient: false },

  // ── Agenda ────────────────────────────────────────────────────────
  { surface: 'calendar-note', screen: 'AGENDA', needsPatient: false },

  // ── Ajustes del centro ────────────────────────────────────────────
  { surface: 'schedule', screen: 'SETTINGS_SCHEDULES', needsPatient: false },
  { surface: 'schedule-assignment', screen: 'SETTINGS_ASSIGNMENTS', needsPatient: false },
  { surface: 'holiday', screen: 'SETTINGS_HOLIDAYS', needsPatient: false },
  { surface: 'appointment-type', screen: 'SETTINGS', needsPatient: false },
  { surface: 'tenant-profile', screen: 'SETTINGS', needsPatient: false },
];

/**
 * El mapa como lo espera el backend.
 *
 * El `id` va por `slugOf`, el mismo que convierte `patient-profile` en
 * `fill_patient_profile`: si aquí fuera con guion, el modelo navegaría a un
 * formulario cuyo nombre de herramienta no existe.
 */
export function reachableForms(): ReachableForm[] {
  return WHERE.map(({ surface, screen, needsPatient }) => ({
    id: slugOf(surface),
    screen,
    needsPatient,
  }));
}
