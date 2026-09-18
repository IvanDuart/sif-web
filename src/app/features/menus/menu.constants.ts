/**
 * Días y tipos de comida. El backend los guarda como texto libre `string(20)`:
 * estos son los valores que ya usa la aplicación y no deben cambiarse.
 *
 * Desayuno y merienda no están aquí a propósito — viven en el perfil del paciente.
 */

export const ALL_DAYS = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
  'DOMINGO',
] as const;

export const MEAL_TYPES = ['COMIDA', 'CENA'] as const;

export type DayOfWeek = (typeof ALL_DAYS)[number];
export type MealType = (typeof MEAL_TYPES)[number];

/** Orden de las comidas dentro de un día. */
export const MEAL_ORDER: Record<string, number> = { COMIDA: 0, CENA: 1 };

/** Clave transloco del nombre del día, p. ej. `diet_detail.days.lunes`. */
export function dayLabelKey(prefix: string, day: string): string {
  return `${prefix}.days.${day.toLowerCase()}`;
}
