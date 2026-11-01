import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickOption } from './parse';

/**
 * El estado clínico del paciente (`users/clinical-status.dialog`).
 *
 * El desplegable es un `tuiSelect` que guarda el valor del enum y enseña su
 * etiqueta traducida, así que aquí se devuelve el valor (al revés que los
 * comboboxes de Ajustes, que guardan la etiqueta).
 */

interface ClinicalStatusOptions {
  /** `{ label: "En seguimiento", value: "ACTIVE" }`, como los tiene el diálogo. */
  statuses(): readonly PickOption[];
}

export function clinicalStatusSurface(options: ClinicalStatusOptions): FillSurface {
  return {
    id: 'clinical-status',
    tools: ['update_clinical_status'],
    fields: [
      {
        key: 'clinicalStatus',
        kind: 'choice',
        from: ['clinicalStatus', 'status', 'estado'],
        parse: (raw) => pickOption(options.statuses(), raw),
      },
      { key: 'reason', kind: 'text', from: ['reason', 'motivo', 'razon', 'notes'] },
    ],
  };
}

/**
 * El botón de cambiar estado vive en la cabecera de la ficha, fuera de las
 * pestañas, así que no hace falta abrir nada antes.
 */
export const CLINICAL_STATUS_OPENER: FillOpener = {
  id: 'clinical-status',
  tools: ['update_clinical_status'],
  trigger: '[data-mascot-open="clinical-status"]',
};
