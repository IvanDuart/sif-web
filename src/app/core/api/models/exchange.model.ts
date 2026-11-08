/**
 * Grupos de intercambio y planificación por raciones.
 *
 * Solo operativo si el centro tiene `preferences.exchangeGroupsEnabled`; en
 * caso contrario el backend responde `403` en todos los endpoints.
 */
export interface ExchangeGroupDto {
  id: string;
  code: string;
  name: string;
  sortOrder?: number | null;
  colorHex?: string | null;
}

/** Alimento equivalente dentro de un grupo, con su equivalencia en raciones. */
export interface ExchangeEquivalentDto {
  id: string;
  groupId: string;
  foodId: string;
  foodName: string;
  /** Raciones que aporta una unidad del alimento. */
  rationsPerUnit: number;
  householdMeasure?: string | null;
  /** Gramos que componen una ración. */
  gramsPerRation: number;
}

/** Raciones objetivo de un grupo dentro de una comida concreta. */
export interface MealExchangeDto {
  id: string;
  groupId: string;
  groupName: string;
  targetRations: number;
}

export interface CreateExchangeGroupRequest {
  code: string;
  name: string;
  sortOrder?: number | null;
  colorHex?: string | null;
}

export interface CreateExchangeEquivalentRequest {
  foodId: string;
  /** > 0. */
  rationsPerUnit: number;
  householdMeasure?: string | null;
  /** > 0. */
  gramsPerRation: number;
}

export interface MealExchangeItemRequest {
  groupId: string;
  /** > 0. */
  targetRations: number;
}

/**
 * Reemplaza las raciones objetivo de la comida.
 * `syncItems = true` reescribe también los gramos de los `MealItems`.
 */
export interface SetMealExchangesRequest {
  exchanges: MealExchangeItemRequest[];
  syncItems?: boolean;
}
