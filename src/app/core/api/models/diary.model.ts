/**
 * Diario alimentario y adherencia del paciente.
 *
 * El diario lo registra el propio paciente (`LOG_PATIENT_DIARY`); el personal
 * con `VIEW_PATIENT_DIARY` consulta diario y adherencia.
 */
export type DiaryStatus = 'DONE' | 'SWAPPED' | 'SKIPPED' | 'PARTIAL';

export interface DiaryEntryItemDto {
  id: string;
  foodId: string;
  foodName: string;
  quantityG: number;
  notes?: string | null;
}

/** Entrada del diario con URL prefirmada de la foto, si la tiene. */
export interface DiaryEntryDto {
  id: string;
  tenantId: string;
  userId: string;
  /** Fecha local del diario en formato `YYYY-MM-DD`. */
  date: string;
  mealId: string;
  mealType: string;
  status: DiaryStatus;
  notes: string | null;
  photoUrl: string | null;
  /** Caducidad de `photoUrl`, ISO 8601. */
  photoExpiresAt: string | null;
  items: DiaryEntryItemDto[];
  createdAt: string;
}

export interface DiaryEntryItemRequest {
  foodId?: string | null;
  quantityG?: number | null;
  notes?: string | null;
}

export interface DiaryEntryRequest {
  mealId: string;
  status: DiaryStatus;
  notes?: string | null;
  items?: DiaryEntryItemRequest[];
}

export interface MealTypeAdherenceDto {
  plannedMeals: number;
  doneMeals: number;
  partialMeals: number;
  /** `(done + 0.5 * partial) / planned`. */
  adherenceRate: number;
}

export interface WeeklyAdherenceDto {
  /** Lunes de la semana, `YYYY-MM-DD`. */
  weekStart: string;
  plannedMeals: number;
  doneMeals: number;
  partialMeals: number;
  adherenceRate: number;
}

/**
 * Reporte de adherencia del rango.
 * `adherenceRate = (done + 0.5 * partial) / plannedMeals`.
 */
export interface AdherenceDto {
  from: string;
  to: string;
  plannedMeals: number;
  doneMeals: number;
  partialMeals: number;
  swappedMeals: number;
  skippedMeals: number;
  adherenceRate: number;
  /** Clave: tipo de comida (`BREAKFAST`, `LUNCH`…). */
  byMealType: Record<string, MealTypeAdherenceDto>;
  weekly: WeeklyAdherenceDto[];
}

/** Rango de fechas `YYYY-MM-DD`; por defecto el backend usa los últimos 30 días. */
export interface DiaryRangeQuery {
  from?: string;
  to?: string;
}
