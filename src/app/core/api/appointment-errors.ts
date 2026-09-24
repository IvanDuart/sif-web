/**
 * Clasificación de los errores del backend de citas.
 *
 * El backend puede devolver el código (`error.appointment_overlap`) o el
 * mensaje en inglés ("The nutritionist already has an appointment in that time
 * slot"), así que aquí se comprueban ambas formas.
 *
 * Sin esto, cualquier `409` se interpretaba como solape y se ofrecía "agendar
 * en paralelo" aunque el motivo real fuera otro: el caso más habitual es que el
 * paciente ya tenga una cita activa, un `409` que se produce con independencia
 * de la hora elegida.
 */

export interface ApiErrorLike {
  status?: number;
  error?: unknown;
}

/** Campos donde el backend puede colocar el código o el mensaje. */
const ERROR_FIELDS = ['error', 'code', 'message', 'detail', 'title'] as const;

/**
 * Patrones de error del backend de citas mapeados a su clave i18n.
 *
 * Se comprueban en minúsculas y por subcadena, e incluyen tanto el código
 * (`error.appointment_overlap`) como el mensaje en inglés de las respuestas
 * documentadas (`The nutritionist already has an appointment in that time
 * slot`), porque el backend no es consistente entre ambos formatos.
 * El orden importa.
 */
const ERROR_KEYS: readonly (readonly [pattern: string, key: string])[] = [
  ['appointment_patient_has_active', 'appointments.patient_has_active'],
  ['patient already has an upcoming appointment', 'appointments.patient_has_active'],
  ['appointment_no_nutritionist_assigned', 'appointments.no_nutritionist_assigned'],
  ["you don't have an assigned nutritionist yet", 'appointments.no_nutritionist_assigned'],
  ['appointment_nutritionist_required', 'appointments.nutritionist_required'],
  ['a nutritionist must be provided', 'appointments.nutritionist_required'],
  ['appointment_reschedule_requires_start_time', 'appointments.reschedule_requires_start_time'],
  ['appointment_outside_operating_hours', 'appointments.outside_operating_hours'],
  ['appointment_in_past', 'appointments.in_past'],
  ['appointment_overlap', 'appointments.conflict'],
  ['already has an appointment in that time slot', 'appointments.conflict'],
];

/** Texto crudo del error (código y/o mensaje) tal y como lo devuelve el backend. */
export function apiErrorText(err: ApiErrorLike | null | undefined): string {
  const payload = err?.error;
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return '';

  const record = payload as Record<string, unknown>;
  return ERROR_FIELDS.map((field) => record[field])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' | ');
}

const normalize = (value: string): string => value.toLowerCase();

/** Clave i18n del error, si es uno de los códigos conocidos. */
export function appointmentErrorKey(err: ApiErrorLike | null | undefined): string | null {
  const text = normalize(apiErrorText(err));
  if (!text) return null;

  const match = ERROR_KEYS.find(([pattern]) => text.includes(pattern));
  return match ? match[1] : null;
}

/**
 * `409` porque el paciente ya tiene una cita activa (`SCHEDULED`/`PROPOSED`).
 * Se produce para cualquier hora, así que nunca debe ofrecerse "solapar".
 */
export function isPatientBusyConflict(err: ApiErrorLike | null | undefined): boolean {
  if (err?.status !== 409) return false;

  const text = normalize(apiErrorText(err));
  return (
    text.includes('appointment_patient_has_active') ||
    text.includes('patient already has an upcoming appointment')
  );
}

/**
 * `409` de solape con otra cita del nutricionista: el único caso en el que el
 * staff puede reintentar con `allowOverlap: true`.
 */
export function isOverlapConflict(err: ApiErrorLike | null | undefined): boolean {
  if (err?.status !== 409 || isPatientBusyConflict(err)) return false;

  const text = normalize(apiErrorText(err)).trim();
  if (!text) return true; // 409 sin cuerpo reconocible: se asume solape.

  return (
    text.includes('appointment_overlap') ||
    text.includes('already has an appointment in that time slot')
  );
}

/**
 * Mensaje a mostrar para un error de cita.
 *
 * Prioriza la traducción del código conocido; si el backend devolvió un mensaje
 * suelto (no un `error.*`) se muestra tal cual, de modo que un error no
 * contemplado nunca quede enmascarado por un mensaje genérico.
 */
export function resolveAppointmentError(
  err: ApiErrorLike | null | undefined,
  fallbackKey: string,
  translate: (key: string) => string
): string {
  const key = appointmentErrorKey(err);
  if (key) return translate(key);

  const text = apiErrorText(err).trim();
  if (text && !text.startsWith('error.')) return text;

  if (err?.status === 409) return translate('appointments.conflict');
  return translate(fallbackKey);
}
