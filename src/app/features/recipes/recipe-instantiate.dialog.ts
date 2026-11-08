import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiButton, TuiDialogContext } from '@taiga-ui/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { RecipeService } from '../../core/api/services/recipe.api';
import { MenuService } from '../../core/api/services/menu.api';
import { MealService } from '../../core/api/services/meal.api';
import { RecipeDto } from '../../core/api/models/recipe.model';
import { Menu } from '../../core/api/models/menu.model';
import { Meal } from '../../core/api/models/meal.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { NotificationService } from '../../core/ui';

export interface RecipeInstantiateDialogInput {
  recipe: RecipeDto;
}

@Component({
  selector: 'app-recipe-instantiate',
  standalone: true,
  imports: [FormsModule, TranslocoDirective, TuiButton],
  templateUrl: './recipe-instantiate.dialog.html',
})
export class RecipeInstantiateDialog {
  private readonly recipeService = inject(RecipeService);
  private readonly menuService = inject(MenuService);
  private readonly mealService = inject(MealService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, RecipeInstantiateDialogInput>>();

  readonly menus = signal<Menu[]>([]);
  readonly meals = signal<Meal[]>([]);
  readonly loadingMenus = signal(true);
  readonly loadingMeals = signal(false);
  readonly saving = signal(false);

  selectedMenuId = '';
  selectedMealId = '';

  constructor() {
    this.loadMenus();
  }

  private loadMenus(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) {
      this.loadingMenus.set(false);
      return;
    }
    this.menuService.search(tenantId, 0, 50, ['name,ASC']).subscribe({
      next: (result) => {
        this.menus.set(result.content ?? []);
        this.loadingMenus.set(false);
      },
      error: () => this.loadingMenus.set(false),
    });
  }

  onMenuChange(menuId: string): void {
    this.selectedMenuId = menuId;
    this.selectedMealId = '';
    this.meals.set([]);

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !menuId) return;

    this.loadingMeals.set(true);
    this.mealService.getByMenuId(tenantId, menuId).subscribe({
      next: (result) => {
        this.meals.set(result.content ?? []);
        this.loadingMeals.set(false);
      },
      error: () => this.loadingMeals.set(false),
    });
  }

  save(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const recipe = this.context.data?.recipe;
    if (!tenantId || !recipe || !this.selectedMealId) return;

    this.saving.set(true);
    this.recipeService.instantiate(tenantId, recipe.id, this.selectedMealId).subscribe({
      next: () => {
        this.saving.set(false);
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(this.transloco.translate('recipes.instantiate_error'));
      },
    });
  }

  cancel(): void {
    this.context.$implicit.next(false);
    this.context.$implicit.complete();
  }

  mealLabel(meal: Meal): string {
    return `${meal.dayOfWeek} · ${meal.mealType}${meal.description ? ' · ' + meal.description : ''}`;
  }
}
