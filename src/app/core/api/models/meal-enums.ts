/**
 * Compatibilidad con los enums `DayOfWeek` y `MealType` del backend (T6).
 *
 * La API devuelve siempre los nombres ingleses (`MONDAY`, `BREAKFAST`…), pero
 * la UI histórica usa los valores legacy en español para claves i18n y orden.
 * La capa de servicios normaliza las respuestas a español y convierte las
 * peticiones a inglés antes de enviarlas, de modo que el resto de componentes
 * no tenga que cambiar sus constantes.
 */

export type ApiDayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'
  | 'OTHER';

export type ApiMealType =
  | 'BREAKFAST'
  | 'MID_MORNING'
  | 'LUNCH'
  | 'SNACK'
  | 'DINNER'
  | 'OTHER';

export type LegacyDayOfWeek =
  | 'LUNES'
  | 'MARTES'
  | 'MIERCOLES'
  | 'JUEVES'
  | 'VIERNES'
  | 'SABADO'
  | 'DOMINGO'
  | 'FESTIVO';

export type LegacyMealType =
  | 'DESAYUNO'
  | 'MEDIA_MAÑANA'
  | 'COMIDA'
  | 'ALMUERZO'
  | 'MERIENDA'
  | 'CENA'
  | 'FESTIVO';

const DAY_TO_LEGACY: Record<string, LegacyDayOfWeek> = {
  MONDAY: 'LUNES',
  TUESDAY: 'MARTES',
  WEDNESDAY: 'MIERCOLES',
  THURSDAY: 'JUEVES',
  FRIDAY: 'VIERNES',
  SATURDAY: 'SABADO',
  SUNDAY: 'DOMINGO',
  OTHER: 'FESTIVO',
  LUNES: 'LUNES',
  MARTES: 'MARTES',
  MIERCOLES: 'MIERCOLES',
  MIÉRCOLES: 'MIERCOLES',
  JUEVES: 'JUEVES',
  VIERNES: 'VIERNES',
  SABADO: 'SABADO',
  SÁBADO: 'SABADO',
  DOMINGO: 'DOMINGO',
  FESTIVO: 'FESTIVO',
};

const DAY_TO_API: Record<string, ApiDayOfWeek> = {
  LUNES: 'MONDAY',
  MARTES: 'TUESDAY',
  MIERCOLES: 'WEDNESDAY',
  MIÉRCOLES: 'WEDNESDAY',
  JUEVES: 'THURSDAY',
  VIERNES: 'FRIDAY',
  SABADO: 'SATURDAY',
  SÁBADO: 'SATURDAY',
  DOMINGO: 'SUNDAY',
  FESTIVO: 'OTHER',
  MONDAY: 'MONDAY',
  TUESDAY: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SUNDAY: 'SUNDAY',
  OTHER: 'OTHER',
};

const MEAL_TO_LEGACY: Record<string, LegacyMealType> = {
  BREAKFAST: 'DESAYUNO',
  MID_MORNING: 'MEDIA_MAÑANA',
  LUNCH: 'COMIDA',
  SNACK: 'MERIENDA',
  DINNER: 'CENA',
  OTHER: 'FESTIVO',
  DESAYUNO: 'DESAYUNO',
  MEDIA_MAÑANA: 'MEDIA_MAÑANA',
  MEDIA_MANANA: 'MEDIA_MAÑANA',
  COMIDA: 'COMIDA',
  ALMUERZO: 'ALMUERZO',
  MERIENDA: 'MERIENDA',
  CENA: 'CENA',
  FESTIVO: 'FESTIVO',
};

const MEAL_TO_API: Record<string, ApiMealType> = {
  DESAYUNO: 'BREAKFAST',
  MEDIA_MAÑANA: 'MID_MORNING',
  MEDIA_MANANA: 'MID_MORNING',
  COMIDA: 'LUNCH',
  ALMUERZO: 'LUNCH',
  MERIENDA: 'SNACK',
  CENA: 'DINNER',
  FESTIVO: 'OTHER',
  BREAKFAST: 'BREAKFAST',
  MID_MORNING: 'MID_MORNING',
  LUNCH: 'LUNCH',
  SNACK: 'SNACK',
  DINNER: 'DINNER',
  OTHER: 'OTHER',
};

/** Normaliza la respuesta del backend al valor legacy que usa la UI. */
export function normalizeDayOfWeek(value: string | null | undefined): string {
  if (!value) return '';
  return DAY_TO_LEGACY[value.toUpperCase()] ?? value;
}

/** Normaliza la respuesta del backend al valor legacy que usa la UI. */
export function normalizeMealType(value: string | null | undefined): string {
  if (!value) return '';
  return MEAL_TO_LEGACY[value.toUpperCase()] ?? value;
}

/** Convierte el valor de la UI al nombre inglés que espera la API. */
export function toApiDayOfWeek(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return DAY_TO_API[value.toUpperCase()] ?? value;
}

/** Convierte el valor de la UI al nombre inglés que espera la API. */
export function toApiMealType(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return MEAL_TO_API[value.toUpperCase()] ?? value;
}
