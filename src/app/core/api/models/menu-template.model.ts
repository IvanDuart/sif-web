import { MealItem } from './meal.model';

export interface MealTemplate {
  id: string;
  dayOfWeek: string;
  mealType: string;
  /** La rellena el servidor a partir de `items` cuando la comida es estructurada. */
  description: string | null;
  /** Receta asignada a la comida de la plantilla, si la hay. */
  recipeId?: string | null;
  /** Nombre de la receta asignada, para pintarlo sin pedir el detalle. */
  recipeName?: string | null;
  /** Personas/raciones pautadas de la receta. */
  servings?: number | null;
  /** Vacío en los centros en modo MANUAL. Viene ordenado por `sortOrder`. */
  items?: MealItem[];
}

export interface MenuTemplate {
  id: string;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
  mealTemplates?: MealTemplate[];
}
