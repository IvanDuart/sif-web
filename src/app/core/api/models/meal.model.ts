import { FoodRef } from './food.model';

/** Un alimento con su gramaje dentro de una comida. */
export interface MealItem {
  id: string;
  food: FoodRef;
  quantityG: number;
  notes?: string | null;
  sortOrder?: number | null;
}

export interface Meal {
  id: string;
  dayOfWeek: string;
  mealType: string;
  /**
   * Texto de la comida. El servidor la rellena sola a partir de `items` cuando
   * la comida es estructurada, uniendo los alimentos con `" · "`. No parsearla
   * para recuperar los alimentos: para eso está `items`.
   */
  description: string | null;
  /** Receta asignada a la comida, si la hay. */
  recipeId?: string | null;
  /** Nombre de la receta asignada, para pintarlo sin pedir el detalle. */
  recipeName?: string | null;
  /** Personas/raciones pautadas de la receta. */
  servings?: number | null;
  /** Vacío en los centros en modo MANUAL. Viene ordenado por `sortOrder`. */
  items?: MealItem[];
}
