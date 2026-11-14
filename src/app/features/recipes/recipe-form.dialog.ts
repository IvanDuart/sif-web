import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiButton, TuiDialogContext } from '@taiga-ui/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { RecipeService } from '../../core/api/services/recipe.api';
import { FoodService } from '../../core/api/services/food.api';
import { FoodDto } from '../../core/api/models/food.model';
import {
  RecipeDto,
  RecipeHouseholdMeasureRequest,
  RecipeItemRequest,
  RecipeRequest,
  RecipeStepRequest,
} from '../../core/api/models/recipe.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { NotificationService } from '../../core/ui';
import { bindingAccess } from '../assistant/mascot/fill/descriptor';
import { MascotFillService } from '../assistant/mascot/fill/mascot-fill.service';
import { RECIPE_SURFACE } from '../assistant/mascot/fill/surfaces/recipe.surface';

export interface RecipeFormDialogInput {
  recipe?: RecipeDto;
}

/** Lo que escribe la mascota siempre es texto; el `null` de un campo vaciado, ''. */
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

interface IngredientRow {
  foodId: string | null;
  foodName: string;
  quantityG: number | null;
  householdMeasure: string;
}

interface MeasureRow {
  label: string;
  grams: number | null;
}

@Component({
  selector: 'app-recipe-form',
  standalone: true,
  imports: [FormsModule, TranslocoDirective, TuiButton],
  templateUrl: './recipe-form.dialog.html',
})
export class RecipeFormDialog implements OnDestroy {
  private readonly recipeService = inject(RecipeService);
  private readonly foodService = inject(FoodService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<RecipeDto | null, RecipeFormDialogInput>>();

  readonly isEdit: boolean;
  private readonly recipeId: string | null;

  name = '';
  description = '';
  servings: number | null = null;
  allergensText = '';
  stepsText = '';
  readonly ingredients = signal<IngredientRow[]>([]);
  readonly measures = signal<MeasureRow[]>([]);

  foodQuery = '';
  readonly foodResults = signal<FoodDto[]>([]);
  readonly searchingFoods = signal(false);
  readonly saving = signal(false);

  private readonly foodSearch$ = new Subject<string>();

  constructor() {
    // Mientras el diálogo esté abierto, la mascota puede rellenarlo. Aquí no
    // hay formulario reactivo —son propiedades con `[(ngModel)]`—, así que el
    // acceso se declara campo a campo.
    inject(MascotFillService).register(
      RECIPE_SURFACE,
      bindingAccess({
        name: { get: () => this.name, set: (value) => (this.name = text(value)) },
        description: { get: () => this.description, set: (value) => (this.description = text(value)) },
        servings: {
          get: () => this.servings,
          // El campo es `number | null`: lo que no sea un número lo deja vacío
          // en vez de dejar un `NaN` que el diálogo mandaría al servidor.
          set: (value) => (this.servings = Number.isFinite(Number(value)) ? Number(value) : null),
        },
        allergensText: { get: () => this.allergensText, set: (value) => (this.allergensText = text(value)) },
        stepsText: { get: () => this.stepsText, set: (value) => (this.stepsText = text(value)) },
        // El buscador de alimentos. No es un dato de la receta: es la casilla
        // donde se teclea el nombre antes de pulsar «Añadir como texto libre».
        // `onFoodQuery` es lo que dispara la búsqueda, y por eso se llama.
        foodQuery: {
          get: () => this.foodQuery,
          set: (value) => (this.foodQuery = text(value)),
          after: () => this.onFoodQuery(this.foodQuery),
        },
      }),
    );

    const recipe = this.context.data?.recipe;
    this.isEdit = !!recipe;
    this.recipeId = recipe?.id ?? null;

    if (recipe) {
      this.name = recipe.name;
      this.description = recipe.description ?? '';
      this.servings = recipe.servings;
      this.allergensText = (recipe.allergens ?? []).join(', ');
      this.stepsText = (recipe.steps ?? [])
        .slice()
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map((step) => step.instruction)
        .join('\n');
      this.ingredients.set(
        (recipe.items ?? [])
          .slice()
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((item) => ({
            foodId: item.foodId,
            foodName: item.foodName,
            quantityG: item.quantityG,
            householdMeasure: item.householdMeasure ?? '',
          }))
      );
      this.measures.set(
        (recipe.householdMeasures ?? []).map((measure) => ({
          label: measure.label,
          grams: measure.grams,
        }))
      );
    }

    this.foodSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          const tenantId = this.tenantCtx.currentTenantId();
          if (!tenantId || term.trim().length < 2) return of(null);
          return this.foodService.search(tenantId, term.trim());
        })
      )
      .subscribe((result) => {
        this.foodResults.set(result?.foods ?? []);
        this.searchingFoods.set(false);
      });
  }

  ngOnDestroy(): void {
    this.foodSearch$.complete();
  }

  onFoodQuery(value: string): void {
    this.foodQuery = value;
    if (value.trim().length < 2) {
      this.foodResults.set([]);
      this.searchingFoods.set(false);
      return;
    }
    this.searchingFoods.set(true);
    this.foodSearch$.next(value);
  }

  addFood(food: FoodDto): void {
    if (this.ingredients().some((row) => row.foodId === food.id)) return;
    this.ingredients.update((rows) => [
      ...rows,
      { foodId: food.id, foodName: food.name, quantityG: null, householdMeasure: '' },
    ]);
    this.foodQuery = '';
    this.foodResults.set([]);
  }

  /**
   * Añade el texto escrito como ingrediente libre, sin necesidad de que exista
   * en BEDCA (especias, condimentos, "sal y pimienta"...).
   */
  addFreeTextIngredient(): void {
    const foodName = this.foodQuery.trim();
    if (!foodName) return;
    if (this.ingredients().some(
      (row) => row.foodName.trim().toLowerCase() === foodName.toLowerCase()
    )) {
      this.foodQuery = '';
      this.foodResults.set([]);
      return;
    }
    this.ingredients.update((rows) => [
      ...rows,
      { foodId: null, foodName, quantityG: null, householdMeasure: '' },
    ]);
    this.foodQuery = '';
    this.foodResults.set([]);
    this.searchingFoods.set(false);
  }

  onFoodQueryKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addFreeTextIngredient();
  }

  removeIngredient(index: number): void {
    this.ingredients.update((rows) => rows.filter((_, i) => i !== index));
  }

  addMeasure(): void {
    this.measures.update((rows) => [...rows, { label: '', grams: null }]);
  }

  removeMeasure(index: number): void {
    this.measures.update((rows) => rows.filter((_, i) => i !== index));
  }

  cancel(): void {
    this.context.$implicit.next(null);
    this.context.$implicit.complete();
  }

  save(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.name.trim()) return;

    const items: RecipeItemRequest[] = this.ingredients()
      .filter(
        (row) =>
          (row.foodId || row.foodName.trim()) &&
          (row.householdMeasure.trim() || (row.quantityG ?? 0) > 0)
      )
      .map((row, index) => ({
        foodId: row.foodId ?? null,
        foodName: row.foodName.trim() || null,
        quantityG: (row.quantityG ?? 0) > 0 ? row.quantityG : null,
        householdMeasure: row.householdMeasure.trim() || null,
        sortOrder: index,
      }));

    const steps: RecipeStepRequest[] = this.stepsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((instruction, index) => ({ stepNumber: index + 1, instruction }));

    const householdMeasures: RecipeHouseholdMeasureRequest[] = this.measures()
      .filter((row) => row.label.trim() && (row.grams ?? 0) > 0)
      .map((row) => ({ label: row.label.trim(), grams: row.grams as number }));

    const request: RecipeRequest = {
      name: this.name.trim(),
      description: this.description.trim() || null,
      servings: this.servings,
      allergens: this.allergensText
        .split(',')
        .map((allergen) => allergen.trim())
        .filter((allergen) => allergen.length > 0),
      items,
      steps,
      householdMeasures,
    };

    this.saving.set(true);
    const call =
      this.isEdit && this.recipeId
        ? this.recipeService.update(tenantId, this.recipeId, request)
        : this.recipeService.create(tenantId, request);

    call.subscribe({
      next: (recipe) => {
        this.saving.set(false);
        this.context.$implicit.next(recipe);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(this.transloco.translate('recipes.save_error'));
      },
    });
  }
}
