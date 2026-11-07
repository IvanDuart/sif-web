import type { FillField, FillSurface } from '../descriptor';

/**
 * La anamnesis del paciente (`users/user-detail.page`). A diferencia de los
 * diálogos, aquí no hay formulario reactivo ni botón de guardar: la página
 * escribe en un signal y se guarda sola. Así que esta superficie se marca con
 * `data-mascot-field` en la plantilla y su acceso lo construye la página.
 */

/** Los antecedentes de la anamnesis: un interruptor y sus notas, cada uno. */
const CHECKLIST = [
  ['hasDiabetes', 'diabetesNotes', 'diabetes'],
  ['hasHypertension', 'hypertensionNotes', 'hipertension'],
  ['hasHeartDisease', 'heartDiseaseNotes', 'cardiopatia'],
  ['hasCholesterol', 'cholesterolNotes', 'colesterol'],
  ['hasAllergiesAsthma', 'allergiesAsthmaNotes', 'alergias'],
  ['hasLiverDisease', 'liverDiseaseNotes', 'higado'],
  ['hasGallbladderDisease', 'gallbladderDiseaseNotes', 'vesicula'],
  ['hasKidneyDisease', 'kidneyDiseaseNotes', 'rinon'],
  ['hasStomachDisease', 'stomachDiseaseNotes', 'estomago'],
  ['hasUricAcidGout', 'uricAcidGoutNotes', 'acidoUrico'],
  ['hasCirculationIssues', 'circulationIssuesNotes', 'circulacion'],
  ['hasThyroidIssues', 'thyroidIssuesNotes', 'tiroides'],
  ['hasAnemia', 'anemiaNotes', 'anemia'],
  ['hasConstipation', 'constipationNotes', 'estrenimiento'],
  ['hasMusculoskeletalIssues', 'musculoskeletalIssuesNotes', 'musculoesqueletico'],
  ['hasSurgeries', 'surgeriesNotes', 'cirugias'],
  ['hasMenstrualCycleIssues', 'menstrualCycleIssuesNotes', 'cicloMenstrual'],
  ['hasSleepIssues', 'sleepIssuesNotes', 'sueno'],
] as const;

/** "sí", "true", "1" y sus variantes; cualquier otra cosa es que no. */
export function toBoolean(raw: string): boolean {
  const plain = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  return ['si', 'true', '1', 'yes', 'y'].includes(plain);
}

/** La anamnesis vive en su pestaña: hay que abrirla antes de escribir en ella. */
const REVEAL = '[data-mascot-reveal="tab-patient_profile"]';

const fields: FillField[] = CHECKLIST.flatMap(([id, notesId, alias]) => [
  { key: id, kind: 'boolean', from: [id, alias], reveal: REVEAL, parse: toBoolean } satisfies FillField,
  { key: notesId, kind: 'text', from: [notesId, `${alias}Notas`], reveal: REVEAL } satisfies FillField,
]);

/**
 * El texto libre de la anamnesis (`doc/contrato-api/assistant/assistant-frontend.md` §6).
 *
 * **Sin alias en castellano a propósito**: `alergias` ya es el alias de
 * `hasAllergiesAsthma`, y un nombre ambiguo se lo quedaría el primero que lo
 * pidiera. El contrato nombra estos campos en inglés y no hay más.
 *
 * Falta `allergiesIntolerances`, que el backend sí manda: está en
 * `UserTenantProfileDto` pero **la ficha no lo pinta en ninguna parte**, así
 * que no hay dónde escribirlo. Mientras no exista el campo, que caiga en la
 * tarjeta de confirmar es lo correcto.
 */
const NOTES: FillField[] = [
  { key: 'consultationReason', kind: 'text', from: ['consultationReason'], reveal: REVEAL },
  { key: 'habits', kind: 'text', from: ['habits'], reveal: REVEAL },
  { key: 'lifestyle', kind: 'text', from: ['lifestyle'], reveal: REVEAL },
  { key: 'exercise', kind: 'text', from: ['exercise'], reveal: REVEAL },
  { key: 'foodPreferences', kind: 'text', from: ['foodPreferences'], reveal: REVEAL },
  {
    // Las observaciones no están en la anamnesis sino en las pautas fijas, que
    // además se editan a mano: la pestaña y luego el botón de editar.
    key: 'observations',
    kind: 'text',
    from: ['observations'],
    reveal: ['[data-mascot-reveal="tab-fixed_guidelines"]', '[data-mascot-open="patient-guidelines"]'],
  },
];

/**
 * `update_profile` **no** se rellena aquí: sus campos (`firstName`, `phone`,
 * `birthDate`…) son los del diálogo de editar usuario, no los de la anamnesis.
 * Declararla aquí hacía que cayera siempre en la tarjeta de confirmar con todo
 * el preview sin reconocer.
 */
export const PATIENT_PROFILE_SURFACE: FillSurface = {
  id: 'patient-profile',
  tools: ['update_anamnesis'],
  fields: [...fields, ...NOTES],
};
