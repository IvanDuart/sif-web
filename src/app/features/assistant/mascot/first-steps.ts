import { Injectable, computed, inject, signal } from '@angular/core';

import { PermissionsService } from '../../../core/permissions/permissions.service';

/** Dónde se recuerda que ya se enseñaron. Local: es de esta persona en este navegador. */
export const FIRST_STEPS_KEY = 'mascot-first-steps-seen';

export interface FirstStep {
  /** Clave de i18n de lo que se ofrece. */
  key: string;
  /** Lo que se escribe en el campo al elegirlo. */
  draftKey: string;
  /** Sin este permiso no se ofrece: ofrecer lo que no se puede hacer es una burla. */
  permission: string;
}

/**
 * Las tres primeras cosas que se le pueden pedir.
 *
 * La primera vez que alguien abre la mascota, el campo vacío no dice qué se le
 * puede pedir, y «pregúntame lo que quieras» tampoco. Estas tres son
 * concretas, y sobre todo **escriben el borrador en vez de enviarlo**: la
 * persona lee lo que va a pedir, lo cambia si quiere y envía ella. Una oferta
 * que se ejecuta sola enseña a no leer.
 */
export const FIRST_STEPS: readonly FirstStep[] = [
  { key: 'assistant.first_appointment', draftKey: 'assistant.first_appointment_draft', permission: 'MANAGE_APPOINTMENTS' },
  { key: 'assistant.first_measurement', draftKey: 'assistant.first_measurement_draft', permission: 'MANAGE_USER' },
  { key: 'assistant.first_menu', draftKey: 'assistant.first_menu_draft', permission: 'MANAGE_MENU' },
];

function seen(): boolean {
  try {
    return globalThis.localStorage?.getItem(FIRST_STEPS_KEY) === '1';
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class FirstStepsService {
  private readonly permissions = inject(PermissionsService);

  private readonly dismissed = signal(seen());

  /** Lo que esta persona puede pedir de verdad. */
  readonly steps = computed(() =>
    this.dismissed() ? [] : FIRST_STEPS.filter((step) => this.permissions.has(step.permission)),
  );

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
