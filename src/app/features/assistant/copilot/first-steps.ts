import { Injectable, computed, signal } from '@angular/core';

import { FIRST_STEPS_KEY } from '../mascot/first-steps';

export { FIRST_STEPS_KEY };

/**
 * Lo que se le puede pedir la primera vez, según dónde esté la persona.
 *
 * El estreno de la mascota era el mismo en todas las pantallas: tres frases
 * generales que valían para cualquier sitio y, por eso mismo, no encajaban en
 * ninguno. Quien está mirando el menú de la semana no necesita «agendar una
 * cita»; necesita rellenar los huecos de ese menú. Estas listas son el mismo
 * ofrecimiento, pero leído en la pantalla en la que ya está trabajando.
 *
 * Siguen escribiendo el borrador y NO lo envían: la persona lo lee, lo cambia
 * si quiere y envía ella. Una oferta que se ejecuta sola enseña a no leer.
 */
export interface FirstStep {
  /** Identifica la oferta dentro de su lista. */
  id: string;
  /** Clave de i18n de lo que se ofrece. */
  labelKey: string;
  /** Clave de i18n de lo que se escribe en el campo al elegirlo. */
  promptKey: string;
  /** Sin este permiso no se ofrece: ofrecer lo que no se puede hacer es una burla. */
  permission: string;
}

/**
 * Las tres de siempre, para cualquier pantalla que no tenga una lista propia.
 *
 * Se quedan intactas a propósito: son el punto de partida y lo que ven los
 * tests de la barra cuando no hay navegación.
 */
export const FIRST_STEPS: readonly FirstStep[] = [
  {
    id: 'appointment',
    labelKey: 'assistant.first_appointment',
    promptKey: 'assistant.first_appointment_draft',
    permission: 'MANAGE_APPOINTMENTS',
  },
  {
    id: 'measurement',
    labelKey: 'assistant.first_measurement',
    promptKey: 'assistant.first_measurement_draft',
    permission: 'MANAGE_USER',
  },
  {
    id: 'menu',
    labelKey: 'assistant.first_menu',
    promptKey: 'assistant.first_menu_draft',
    permission: 'MANAGE_MENU',
  },
];

/** El tour de la app sirve en cualquier pantalla y no toca datos. */
const TOUR_STEP: FirstStep = {
  id: 'tour',
  labelKey: 'assistant.first_steps.tour_label',
  promptKey: 'assistant.first_steps.tour_prompt',
  permission: 'MANAGE_APPOINTMENTS',
};

/**
 * El detalle de un menú semanal: lo que se hace ahí es rellenarlo y sacar la
 * compra, y el tour para quien acaba de llegar.
 */
const MENU_STEPS: readonly FirstStep[] = [
  TOUR_STEP,
  {
    id: 'menu-fill-empty',
    labelKey: 'assistant.first_steps.menu_empty_label',
    promptKey: 'assistant.first_steps.menu_empty_prompt',
    permission: 'MANAGE_MENU',
  },
  {
    id: 'menu-shopping-list',
    labelKey: 'assistant.first_steps.menu_shopping_label',
    promptKey: 'assistant.first_steps.menu_shopping_prompt',
    permission: 'MANAGE_MENU',
  },
];

/** La ficha clínica de un paciente: medir, mirar la evolución, agendar. */
const PATIENT_STEPS: readonly FirstStep[] = [
  {
    id: 'patient-measurement',
    labelKey: 'assistant.first_steps.patient_measurement_label',
    promptKey: 'assistant.first_steps.patient_measurement_prompt',
    permission: 'MANAGE_USER',
  },
  {
    id: 'patient-evolution',
    labelKey: 'assistant.first_steps.patient_evolution_label',
    promptKey: 'assistant.first_steps.patient_evolution_prompt',
    permission: 'MANAGE_USER',
  },
  {
    id: 'patient-appointment',
    labelKey: 'assistant.first_steps.patient_appointment_label',
    promptKey: 'assistant.first_steps.patient_appointment_prompt',
    permission: 'MANAGE_APPOINTMENTS',
  },
];

/** La agenda: crear la cita, dejarla anotada, y el tour. */
const AGENDA_STEPS: readonly FirstStep[] = [
  {
    id: 'agenda-appointment',
    labelKey: 'assistant.first_steps.agenda_appointment_label',
    promptKey: 'assistant.first_steps.agenda_appointment_prompt',
    permission: 'MANAGE_APPOINTMENTS',
  },
  {
    id: 'agenda-note',
    labelKey: 'assistant.first_steps.agenda_note_label',
    promptKey: 'assistant.first_steps.agenda_note_prompt',
    permission: 'MANAGE_CALENDAR_NOTES',
  },
  TOUR_STEP,
];

/**
 * Las ofertas que encajan en esa ruta. Se compara el camino sin parámetros ni
 * fragmentos: `/menus/42?tab=week` es el mismo detalle de menú que `/menus/42`.
 */
export function firstStepsForUrl(url: string): readonly FirstStep[] {
  const path = (url.split(/[?#]/)[0] ?? '') || '/';

  if (path.startsWith('/menus/')) return MENU_STEPS;
  if (path.startsWith('/users/')) return PATIENT_STEPS;
  if (path.startsWith('/appointments')) return AGENDA_STEPS;
  return FIRST_STEPS;
}

function seen(): boolean {
  try {
    return globalThis.localStorage?.getItem(FIRST_STEPS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Si el estreno sigue pendiente.
 *
 * Se guarda con la misma clave que la lista general: enseñar una oferta de la
 * ruta y volver a enseñar las de siempre al cambiar de pantalla sería el mismo
 * estreno repetido, que es justo lo que `dismiss` evita.
 */
@Injectable({ providedIn: 'root' })
export class FirstStepsService {
  private readonly dismissed = signal(seen());

  /** Hay estreno que enseñar: ni se ha usado una oferta ni se ha cerrado. */
  readonly visible = computed(() => !this.dismissed());

  /** Se enseñan una vez: en cuanto se usa una, o se cierra, no vuelven. */
  dismiss(): void {
    this.dismissed.set(true);
    try {
      globalThis.localStorage?.setItem(FIRST_STEPS_KEY, '1');
    } catch {
      // Sin almacenamiento valen para esta sesión y ya.
    }
  }
}
