import type { AssistantScreen } from '../../../core/api/models/assistant.model';

/**
 * De una pantalla del asistente a una ruta de la aplicación.
 *
 * Es una lista cerrada a propósito: la mascota solo va donde esta tabla dice,
 * así que no puede acabar en una pantalla que no existe ni, peor, en la ficha
 * de un paciente que no es el de la conversación.
 *
 * Lo usan los dos caminos: el `NAVIGATE` de `uiActions` (que se retira en F8) y
 * la herramienta de cliente `navigate`. Mientras convivan tienen que llevar al
 * mismo sitio, y por eso el mapa está aquí y no dentro de ninguno de los dos.
 */

export interface ScreenRoute {
  commands: string[];
  queryParams?: Record<string, string>;
}

/** Las pantallas a las que se puede ir, para enumerarlas en el esquema de `navigate`. */
export const NAVIGABLE_SCREENS: readonly AssistantScreen[] = [
  'DASHBOARD',
  'PATIENTS',
  'AGENDA',
  'APPOINTMENTS',
  'PATIENT_APPOINTMENTS',
  'MENUS',
  'TEMPLATES',
  'MENU',
  'PATIENT_MENU',
  'SHOPPING_LIST',
  'EVOLUTION',
  'REVENUE',
  'STAFF',
  'SETTINGS',
  'SETTINGS_BRANDING',
  'SETTINGS_SCHEDULES',
  'SETTINGS_ASSIGNMENTS',
  'SETTINGS_HOLIDAYS',
  'PATIENT_PROFILE',
  'PROFILE',
  'ANAMNESIS',
  'PATIENT_MEASUREMENTS',
  'MEASUREMENTS',
  'DIARY',
];

const text = (params: Record<string, unknown>, key: string): string =>
  typeof params[key] === 'string' ? (params[key] as string).trim() : '';

export function routeForScreen(
  screen: AssistantScreen | string | undefined,
  params: Record<string, unknown> = {},
): ScreenRoute | null {
  const patientId = text(params, 'patientId');
  const patientRoute = patientId === '' ? null : ['/users', patientId];
  /** La ficha del paciente, con su pestaña; sin paciente, a donde se pueda. */
  const onPatient = (tab: string, fallback: string): ScreenRoute =>
    patientRoute ? { commands: patientRoute, queryParams: { tab } } : { commands: [fallback] };
  /** Un listado que admite búsqueda: se abre ya filtrado, como lo haría la persona. */
  const searchable = (path: string): ScreenRoute => {
    const query = text(params, 'query');
    return query === '' ? { commands: [path] } : { commands: [path], queryParams: { q: query } };
  };

  switch (screen) {
    case 'PATIENTS':
      return searchable('/patients');
    case 'MENUS':
      return searchable('/menus');
    case 'TEMPLATES':
      return searchable('/templates');
    case 'AGENDA':
    case 'APPOINTMENTS':
    case 'PATIENT_APPOINTMENTS':
      return { commands: ['/appointments'] };
    case 'DASHBOARD':
      return { commands: ['/dashboard'] };
    case 'SHOPPING_LIST':
      return { commands: ['/shopping-lists'] };
    case 'EVOLUTION':
      return { commands: ['/evolution'] };
    case 'REVENUE':
      return { commands: ['/revenue'] };
    case 'STAFF':
      return { commands: ['/staff'] };
    // Ajustes es maestro-detalle: las secciones no tienen ruta propia, así que
    // se abren con la pestaña puesta en los query params.
    case 'SETTINGS':
      return { commands: ['/settings'] };
    case 'SETTINGS_BRANDING':
      return { commands: ['/settings'], queryParams: { tab: 'branding' } };
    case 'SETTINGS_SCHEDULES':
      return { commands: ['/settings'], queryParams: { tab: 'schedules', section: 'schedules' } };
    case 'SETTINGS_ASSIGNMENTS':
      return { commands: ['/settings'], queryParams: { tab: 'schedules', section: 'assignments' } };
    case 'SETTINGS_HOLIDAYS':
      return { commands: ['/settings'], queryParams: { tab: 'schedules', section: 'holidays' } };
    case 'PATIENT_PROFILE':
    case 'PROFILE':
    case 'ANAMNESIS':
      return onPatient('patient_profile', '/dashboard');
    case 'PATIENT_MEASUREMENTS':
    case 'MEASUREMENTS':
      return onPatient('measurements', '/dashboard');
    case 'PATIENT_MENU':
      return onPatient('menus', '/dashboard');
    case 'MENU':
      return onPatient('menus', '/menus');
    case 'DIARY':
      return onPatient('menus', '/dashboard');
    default:
      return null;
  }
}
