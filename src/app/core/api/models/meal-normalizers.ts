import { Meal } from './meal.model';
import { Menu } from './menu.model';
import { MealTemplate, MenuTemplate } from './menu-template.model';
import { RecipeDto } from './food.model';
import { normalizeDayOfWeek, normalizeMealType } from './meal-enums';

/** Adapta una comida de la API (enums ingleses) al formato legacy de la UI. */
export function normalizeMeal(meal: Meal): Meal {
  return {
    ...meal,
    dayOfWeek: normalizeDayOfWeek(meal.dayOfWeek),
    mealType: normalizeMealType(meal.mealType),
  };
}

export function normalizeMeals(meals: Meal[] | null | undefined): Meal[] | undefined {
  return meals ? meals.map(normalizeMeal) : meals ?? undefined;
}

export function normalizeMenu(menu: Menu): Menu {
  return { ...menu, meals: normalizeMeals(menu.meals) };
}

export function normalizeMealTemplate(meal: MealTemplate): MealTemplate {
  return {
    ...meal,
    dayOfWeek: normalizeDayOfWeek(meal.dayOfWeek),
    mealType: normalizeMealType(meal.mealType),
  };
}

export function normalizeMenuTemplate(template: MenuTemplate): MenuTemplate {
  return {
    ...template,
    mealTemplates: template.mealTemplates?.map(normalizeMealTemplate),
  };
}

export function normalizeRecipe(recipe: RecipeDto): RecipeDto {
  return {
    ...recipe,
    dayOfWeek: normalizeDayOfWeek(recipe.dayOfWeek),
    mealType: normalizeMealType(recipe.mealType),
  };
}
