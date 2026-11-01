import type { FillOpener, FillSurface } from '../descriptor';
import { toDay } from './parse';

/**
 * Un evento de la ficha del paciente (`users/patient-event-form.dialog`):
 * título, descripción y día. El formulario solo pide el día, aunque el campo
 * del contrato se llame `startTime`.
 */
export const PATIENT_EVENT_SURFACE: FillSurface = {
  id: 'patient-event',
  tools: ['create_patient_event'],
  fields: [
    { key: 'title', kind: 'text', from: ['title', 'titulo', 'name', 'nombre'] },
    { key: 'description', kind: 'text', from: ['description', 'descripcion', 'notes', 'notas'] },
    {
      key: 'startTime',
      kind: 'date',
      from: ['startTime', 'date', 'fecha', 'day', 'start'],
      parse: toDay,
    },
  ],
};

/** El botón está dentro de la pestaña de eventos, que hay que abrir antes. */
export const PATIENT_EVENT_OPENER: FillOpener = {
  id: 'patient-event',
  tools: ['create_patient_event'],
  reveal: ['[data-mascot-reveal="tab-patient_events"]'],
  trigger: '[data-mascot-open="patient-event"]',
};
