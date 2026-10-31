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

export const PATIENT_PROFILE_SURFACE: FillSurface = {
  id: 'patient-profile',
  tools: ['update_anamnesis', 'update_profile'],
  fields,
};
