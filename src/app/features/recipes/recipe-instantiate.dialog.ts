import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import {
  TuiButton,
  TuiDialogContext,
  TuiDropdown,
  TuiInput,
  TuiLabel,
  TuiTextfield,
} from '@taiga-ui/core';
import { TuiChevron, TuiDataListWrapper, TuiSelect } from '@taiga-ui/kit';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { RecipeService } from '../../core/api/services/recipe.api';
import { MenuService } from '../../core/api/services/menu.api';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { MealService } from '../../core/api/services/meal.api';
import { RecipeDto } from '../../core/api/models/recipe.model';
import { Menu } from '../../core/api/models/menu.model';
import { Meal } from '../../core/api/models/meal.model';
import { MealTemplate, MenuTemplate } from '../../core/api/models/menu-template.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { NotificationService } from '../../core/ui';

export interface RecipeInstantiateDialogInput {
  recipe: RecipeDto;
}

type InstantiateTarget = 'menu' | 'template';

@Component({
  selector: 'app-recipe-instantiate',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoDirective,
    TuiButton,
    TuiTextfield,
    TuiInput,
    TuiLabel,
    TuiSelect,
    TuiChevron,
    TuiDropdown,
    TuiDataListWrapper,
  ],
  templateUrl: './recipe-instantiate.dialog.html',
})
export class RecipeInstantiateDialog {
  private readonly recipeService = inject(RecipeService);
  private readonly menuService = inject(MenuService);
  private readonly templateService = inject(MenuTemplateService);
  private readonly mealService = inject(MealService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, RecipeInstantiateDialogInput>>();

  readonly targetTypes: InstantiateTarget[] = ['menu', 'template'];
  readonly targetType = signal<InstantiateTarget>('menu');

  readonly menus = signal<Menu[]>([]);
  readonly templates = signal<MenuTemplate[]>([]);
  readonly meals = signal<(Meal | MealTemplate)[]>([]);
  readonly loadingSources = signal(true);
  readonly loadingMeals = signal(false);
  readonly saving = signal(false);

  readonly targetTypeControl = new FormControl<InstantiateTarget>({ value: 'menu', disabled: false }, { nonNullable: true });
  readonly sourceControl = new FormControl<string>({ value: '', disabled: true }, { nonNullable: true, validators: [Validators.required] });
  readonly mealControl = new FormControl<string>({ value: '', disabled: true }, { nonNullable: true, validators: [Validators.required] });
  readonly servingsControl = new FormControl<number>({ value: 1, disabled: false }, { nonNullable: true, validators: [Validators.required, Validators.min(1)] });

  readonly targetTypeValues = computed(() => this.targetTypes);
  readonly sourceValues = computed(() =>
    this.targetType() === 'menu'
      ? this.menus().map((m) => m.id)
      : this.templates().map((t) => t.id)
  );
  readonly mealValues = computed(() => this.meals().map((m) => m.id));

  readonly targetTypeStringify = (type: InstantiateTarget): string =>
    this.transloco.translate(type === 'menu' ? 'recipes.target_menu' : 'recipes.target_template');

  readonly sourceStringify = (id: string): string => {
    if (this.targetType() === 'menu') {
      return this.menus().find((m) => m.id === id)?.name ?? id;
    }
    return this.templates().find((t) => t.id === id)?.name ?? id;
  };

  readonly mealStringify = (mealId: string): string => {
    const meal = this.meals().find((m) => m.id === mealId);
    return meal ? this.mealLabel(meal) : mealId;
  };

  constructor() {
    const recipeServings = this.context.data?.recipe?.servings;
    this.servingsControl.setValue(recipeServings && recipeServings > 0 ? recipeServings : 1);

    this.targetTypeControl.valueChanges.subscribe((type) => {
      this.targetType.set(type);
      this.onTargetTypeChange();
    });
    this.sourceControl.valueChanges.subscribe((id) => {
      this.onSourceChange(id);
    });

    this.loadSources();
  }

  private loadSources(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) {
      this.loadingSources.set(false);
      return;
    }
    this.loadingSources.set(true);
    this.menuService.search(tenantId, 0, 50, ['name,ASC']).subscribe({
      next: (result) => {
        this.menus.set(result.content ?? []);
        this.loadingSources.set(false);
        this.sourceControl.enable();
      },
      error: () => this.loadingSources.set(false),
    });
  }

  private loadTemplates(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.templates().length > 0) return;
    this.templateService.search(tenantId, 0, 50, ['name,ASC']).subscribe({
      next: (result) => this.templates.set(result.content ?? []),
      error: () => this.templates.set([]),
    });
  }

  private onTargetTypeChange(): void {
    this.sourceControl.setValue('');
    this.sourceControl.disable();
    this.mealControl.setValue('');
    this.mealControl.disable();
    this.meals.set([]);

    if (this.targetType() === 'template') {
      this.loadTemplates();
    }
    this.sourceControl.enable();
  }

  private onSourceChange(sourceId: string): void {
    this.mealControl.setValue('');
    this.mealControl.disable();
    this.meals.set([]);

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !sourceId) return;

    this.loadingMeals.set(true);
    if (this.targetType() === 'menu') {
      this.mealService.getByMenuId(tenantId, sourceId).subscribe({
        next: (result) => {
          const list = result.content ?? [];
          this.meals.set(list);
          this.loadingMeals.set(false);
          if (list.length > 0) this.mealControl.enable();
        },
        error: () => this.loadingMeals.set(false),
      });
      return;
    }

    this.templateService.getById(tenantId, sourceId).subscribe({
      next: (template) => {
        const list = template.mealTemplates ?? [];
        this.meals.set(list);
        this.loadingMeals.set(false);
        if (list.length > 0) this.mealControl.enable();
      },
      error: () => this.loadingMeals.set(false),
    });
  }

  save(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const recipe = this.context.data?.recipe;
    const mealId = this.mealControl.value;
    const servings = this.servingsControl.value;
    if (!tenantId || !recipe || !mealId || this.servingsControl.invalid) return;

    this.saving.set(true);
    const payload = this.targetType() === 'menu'
      ? { mealId, servings }
      : { mealTemplateId: mealId, servings };

    this.recipeService.instantiate(tenantId, recipe.id, payload).subscribe({
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

  mealLabel(meal: Meal | MealTemplate): string {
    return `${meal.dayOfWeek} · ${meal.mealType}${meal.description ? ' · ' + meal.description : ''}`;
  }
}
