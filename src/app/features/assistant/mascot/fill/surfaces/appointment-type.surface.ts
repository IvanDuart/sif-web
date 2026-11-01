import type { FillSurface, FillOpener } from '../descriptor';
import { toNumber } from './measurement.surface';
import { toActive } from './menu-template.surface';
import { SETTINGS_APPOINTMENT_TYPES_TAB } from './settings-section';

/**
 * Un tipo de cita (`settings/components/appointment-type-form.dialog`).
 *
 * El diálogo no usa formulario reactivo sino `[(ngModel)]` sobre propiedades
 * de la clase, así que su acceso se construye con `bindingAccess` en vez de
 * con `formAccess`.
 *
 * `isActive` está en el contrato pero no en el diálogo: solo se puede desactivar
 * desde el listado, así que ese campo se queda sin rellenar a propósito.
 */
export const APPOINTMENT_TYPE_SURFACE: FillSurface = {
  id: 'appointment-type',
  tools: ['create_appointment_type', 'update_appointment_type'],
  fields: [
    { key: 'name', kind: 'text', from: ['name', 'nombre', 'typeName'] },
    {
      key: 'durationMinutes',
      kind: 'number',
      from: ['durationMinutes', 'duration', 'duracion', 'minutes', 'minutos'],
      parse: toNumber,
    },
    { key: 'price', kind: 'number', from: ['price', 'precio', 'cost'], parse: toNumber },
    {
      key: 'isDefault',
      kind: 'boolean',
      from: ['isDefault', 'default', 'porDefecto', 'predeterminado'],
      parse: toActive,
    },
  ],
};

/** Ajustes → Tipos de cita → "Nuevo tipo". */
export const APPOINTMENT_TYPE_OPENER: FillOpener = {
  id: 'appointment-type',
  tools: ['create_appointment_type', 'update_appointment_type'],
  reveal: [SETTINGS_APPOINTMENT_TYPES_TAB],
  trigger: '[data-mascot-open="appointment-type"]',
};
