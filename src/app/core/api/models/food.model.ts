/**
 * Catálogo de alimentos (BEDCA + propios del centro) y nutrición de menús.
 *
 * Los valores de `nutrients` son SIEMPRE por 100 g de porción comestible, y
 * `quantityG` es peso comestible, así que el cálculo es directo: no se aplica
 * `ediblePortion`.
 */

export type FoodSource = 'BEDCA' | 'TENANT';

/** Código de nutriente (`ENERC_KCAL`, `PROT`…) → valor por 100 g. */
export type NutrientMap = Record<string, number>;

/** Alimento sin datos nutricionales, tal y como viene anidado en un `MealItem`. */
export interface FoodRef {
  id: string;
  source: FoodSource;
  name: string;
  foodGroup?: string | null;
}

/** Alimento completo, tal y como lo devuelven el buscador y `POST /food`. */
export interface FoodDto extends FoodRef {
  ediblePortion?: number;
  nutrients: NutrientMap;
}

export interface RecipeItemDto {
  foodId: string;
  name: string;
  quantityG: number;
  notes?: string | null;
  sortOrder?: number | null;
}

/** Comida de una plantilla, ofrecida como receta reutilizable en el buscador. */
export interface RecipeDto {
  id: string;
  name: string;
  dayOfWeek: string;
  mealType: string;
  description: string;
  items: RecipeItemDto[];
}

export interface FoodSearchResultDto {
  foods: FoodDto[];
  recipes: RecipeDto[];
}

export interface NutrientDto {
  code: string;
  name: string;
  unit: string;
  nutrientGroup?: string | null;
}

export interface MealNutritionDto {
  mealId: string;
  dayOfWeek: string;
  mealType: string;
  nutrients: NutrientMap;
}

export interface MenuNutritionDto {
  menuId: string;
  meals: MealNutritionDto[];
  /** dayOfWeek → totales del día. */
  days: Record<string, NutrientMap>;
  total: NutrientMap;
  /** Ítems cuyo alimento no tiene kcal registradas. Si es > 0, hay que avisar. */
  incompleteItems: number;
}

/**
 * Energía en kcal. El catálogo también trae `ENERC` en kJ: mostrarlo por error
 * multiplica las calorías por 4,184, así que nunca se pinta.
 */
export const KCAL = 'ENERC_KCAL';

/** Proteína, grasa total e hidratos de carbono. */
export const MACROS = ['PROT', 'FAT', 'CHO'] as const;

/** Suma un nutriente sobre una lista de ítems con gramaje. */
export function sumNutrient(
  items: readonly { food: { nutrients: NutrientMap } | null; quantityG: number | null }[],
  code: string
): number {
  return items.reduce(
    (sum, item) => sum + ((item.food?.nutrients[code] ?? 0) * (item.quantityG ?? 0)) / 100,
    0
  );
}
