import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiDropdown, TuiTextfield, TuiError, TuiInput, TuiLabel } from '@taiga-ui/core';
import { TuiSelect, TuiDataListWrapper, TuiChevron, TuiTextarea } from '@taiga-ui/kit';
import { TranslocoService, TranslocoDirective } from '@jsverse/transloco';
import { MenuTemplateService, UpdateMealTemplateRequest } from '../../core/api/services/menu-template.api';
import { RecipeService } from '../../core/api/services/recipe.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MealTemplate } from '../../core/api/models/menu-template.model';
import { RecipeDto } from '../../core/api/models/recipe.model';
import { ALL_DAYS as DAY_VALUES, MEAL_TYPES as MEAL_VALUES } from '../menus/menu.constants';
import { MascotFillService } from '../assistant/mascot/fill/mascot-fill.service';
import { formAccess } from '../assistant/mascot/fill/descriptor';
import { mealTemplateSurface } from '../assistant/mascot/fill/surfaces/meal-template.surface';

export interface MealTemplateFormDialogInput {
  templateId: string;
  meal?: MealTemplate;
  prefillDay?: string;
  prefillMealType?: string;
}

/** Valor del desplegable de recetas que representa "sin receta (texto libre)". */
const NO_RECIPE = '';

/** Exige contenido: una receta asignada o un texto de descripción. */
function contentRequired(control: AbstractControl): ValidationErrors | null {
  const recipeId = control.get('recipeId')?.value;
  const description = (control.get('description')?.value ?? '').trim();
  return recipeId || description ? null : { descriptionRequired: true };
}

@Component({
  selector: 'app-meal-template-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslocoDirective,
    TuiButton,
    TuiDropdown,
    TuiTextfield,
    TuiError,
    TuiInput,
    TuiLabel,
    TuiSelect,
    TuiDataListWrapper,
    TuiChevron,
    TuiTextarea,
  ],
  templateUrl: './meal-template-form.dialog.html'
})
export class MealTemplateFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
  private readonly recipeService = inject(RecipeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<MealTemplate, MealTemplateFormDialogInput>>();

  days = computed(() => DAY_VALUES.map(d => ({
    value: d,
    label: this.transloco.translate(`template_detail.days.${d.toLowerCase()}`),
  })));

  mealTypes = computed(() => MEAL_VALUES.map(m => ({
    value: m,
    label: this.transloco.translate(`template_detail.meal_types.${m === 'COMIDA' ? 'lunch' : 'dinner'}`),
  })));

  dayValues = computed(() => this.days().map(d => d.value));
  mealTypeValues = computed(() => this.mealTypes().map(m => m.value));

  recipes = signal<RecipeDto[]>([]);
  loadingRecipes = signal(false);
  recipeValues = computed(() => [NO_RECIPE, ...this.recipes().map(r => r.id)]);
  readonly selectedRecipeId = signal<string>(NO_RECIPE);
  readonly hasRecipe = computed(() => !!this.selectedRecipeId());

  templateId = '';
  isEdit = false;
  mealId = '';
  /** Receta que tenía la comida al abrir el diálogo, para detectar si se quitó. */
  initialRecipeId: string | null = null;
  private previousRecipeId: string | null = null;

  saving = signal(false);

  form = this.fb.group({
    dayOfWeek: ['', Validators.required],
    mealType: ['', Validators.required],
    description: [''],
    recipeId: [NO_RECIPE],
    servings: [1 as number | null, [Validators.min(1)]],
  }, { validators: contentRequired });

  dayStringify = (value: string): string => this.days().find(d => d.value === value)?.label ?? value;
  mealTypeStringify = (value: string): string => this.mealTypes().find(m => m.value === value)?.label ?? value;
  recipeStringify = (value: string): string => {
    if (!value) return this.transloco.translate('recipes.no_recipe');
    return this.recipes().find(r => r.id === value)?.name ?? value;
  };

  constructor() {
    // Las comidas de una plantilla se añaden una a una desde la rejilla; sin
    // esto la mascota creaba la plantilla y la dejaba vacía.
    inject(MascotFillService).register(
      mealTemplateSurface({ days: () => this.days(), mealTypes: () => this.mealTypes() }),
      formAccess(this.form),
    );

    const data = this.context.data;
    this.templateId = data.templateId;
    this.loadRecipes();

    this.previousRecipeId = data.meal?.recipeId ?? null;
    if (data.meal) {
      this.isEdit = true;
      this.mealId = data.meal.id;
      this.initialRecipeId = data.meal.recipeId ?? null;
      const recipe = this.recipeById(data.meal.recipeId);
      this.form.patchValue({
        dayOfWeek: data.meal.dayOfWeek,
        mealType: data.meal.mealType,
        description: data.meal.description ?? '',
        recipeId: data.meal.recipeId ?? NO_RECIPE,
        servings: data.meal.servings ?? recipe?.servings ?? 1,
      });
      this.selectedRecipeId.set(data.meal.recipeId ?? NO_RECIPE);
    } else if (data.prefillDay || data.prefillMealType) {
      this.form.patchValue({
        ...(data.prefillDay ? { dayOfWeek: data.prefillDay } : {}),
        ...(data.prefillMealType ? { mealType: data.prefillMealType } : {}),
      });
    }

    this.form.get('recipeId')?.valueChanges.subscribe((recipeId) => {
      const value = recipeId ?? NO_RECIPE;
      this.selectedRecipeId.set(value);
      this.onRecipeChange(value);
    });
  }

  private loadRecipes() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingRecipes.set(true);
    this.recipeService.list(tenantId, { size: 100 }).subscribe({
      next: (page) => {
        this.recipes.set(page.content ?? []);
        this.loadingRecipes.set(false);
      },
      error: () => this.loadingRecipes.set(false),
    });
  }

  private recipeById(recipeId?: string | null): RecipeDto | undefined {
    if (!recipeId) return undefined;
    return this.recipes().find(r => r.id === recipeId);
  }

  /**
   * Al elegir receta se rellena la descripción con su nombre (si estaba vacía o
   * era el nombre de la receta anterior) y las raciones con las suyas.
   */
  private onRecipeChange(recipeId: string) {
    const recipe = this.recipeById(recipeId);
    if (!recipe) {
      this.form.get('servings')?.setValue(1);
      this.previousRecipeId = null;
      return;
    }

    this.form.get('servings')?.setValue(recipe.servings ?? 1);

    const description = (this.form.get('description')?.value ?? '').trim();
    const previousName = this.recipeById(this.previousRecipeId)?.name;
    if (!description || (previousName && description === previousName)) {
      this.form.get('description')?.setValue(recipe.name);
    }
    this.previousRecipeId = recipeId;
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    const raw = this.form.getRawValue();
    const recipeId = raw.recipeId || null;

    const payload: UpdateMealTemplateRequest = {
      dayOfWeek: raw.dayOfWeek!,
      mealType: raw.mealType!,
      description: raw.description ?? '',
      recipeId,
      ...(this.isEdit && !!this.initialRecipeId && !recipeId ? { clearRecipe: true } : {}),
      servings: recipeId ? raw.servings ?? 1 : null,
    };

    const action = this.isEdit
      ? this.templateService.updateMeal(tenantId, this.templateId, this.mealId, payload)
      : this.templateService.addMeal(tenantId, this.templateId, payload);

    action.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.context.$implicit.next(result);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
