import { Meal } from './meal.model';

export interface Menu {
  id: string;
  name: string;
  isActive: boolean;
  active?: boolean;
  createdAt?: string;
  meals?: Meal[];
}
