export interface MealTemplate {
  id: string;
  dayOfWeek: string;
  mealType: string;
  description: string;
}

export interface MenuTemplate {
  id: string;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
  mealTemplates?: MealTemplate[];
}
