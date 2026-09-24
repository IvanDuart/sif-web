import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Observable, Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { TuiButton, TuiDataList, TuiDropdown, TuiHint, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

import { Meal } from '../../../core/api/models/meal.model';
import {
  FoodDto,
  FoodRef,
  KCAL,
  MACROS,
  NutrientMap,
  RecipeDto,
} from '../../../core/api/models/food.model';
import { MealItemRequest } from '../../../core/api/services/meal.api';
import { FoodService } from '../../../core/api/services/food.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { FoodCreatePanel } from './food-create-panel';

/** Una fila del editor. `food` puede ser un `FoodRef` sin nutrientes si viene del servidor. */
interface ItemRow {
  food: FoodDto | FoodRef | null;
  quantityG: number | null;
  notes: string | null;
  query: string;
}

/** Una entrada de la lista de sugerencias, aplanada para poder recorrerla con ↑/↓. */
type Suggestion =
  | { kind: 'food'; food: FoodDto }
  | { kind: 'recipe'; recipe: RecipeDto }
  | { kind: 'create' };

const SEARCH_DEBOUNCE_MS = 250;
const SAVE_DEBOUNCE_MS = 1500;
const MIN_QUERY_LENGTH = 2;

function hasNutrients(food: FoodDto | FoodRef | null): food is FoodDto {
  return !!food && 'nutrients' in food && !!(food as FoodDto).nutrients;
}

function emptyRow(): ItemRow {
  return { food: null, quantityG: null, notes: null, query: '' };
}

/**
 * Editor de una comida estructurada: filas de alimento + gramos, con buscador
 * y macros en vivo.
 *
 * El ciclo completo de añadir un ingrediente se hace sin ratón y sin abrir
 * ningún diálogo: escribir, ↑/↓, Enter (pasa a gramos), Enter (nueva fila).
 * Cada modal rompería ese ciclo, que es justo lo que esta pantalla evita.
 */
@Component({
  selector: 'app-meal-items-editor',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    TranslocoDirective,
    TuiButton,
    TuiBadge,
    TuiDataList,
    TuiDropdown,
    TuiHint,
    TuiInput,
    TuiTextfield,
    FoodCreatePanel,
  ],
  templateUrl: './meal-items-editor.html',
  styleUrls: ['./meal-items-editor.scss'],
})
export class MealItemsEditor {
  private readonly foodService = inject(FoodService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  meal = input.required<Meal>();
  canManage = input(false);
  i18nPrefix = input.required<string>();
  /**
   * Cómo persiste el padre la lista. Menús y plantillas usan endpoints distintos,
   * así que la página inyecta su propia llamada en vez de duplicar el editor.
   *
   * Recibe el `mealId` como argumento para que la página pueda pasar una
   * referencia estable y no una closure nueva en cada ciclo de detección.
   */
  saveFn = input.required<
    (mealId: string, items: MealItemRequest[], fallbackDescription: string | null) => Observable<unknown>
  >();

  /** Emite tras guardar, para que la página refresque la nutrición del servidor. */
  saved = output<void>();

  readonly rows = signal<ItemRow[]>([]);
  readonly activeRow = signal<number | null>(null);
  readonly suggestions = signal<Suggestion[]>([]);
  readonly highlighted = signal(0);
  readonly searching = signal(false);
  readonly saveState = signal<'idle' | 'saving' | 'saved'>('idle');
  /** Fila para la que está abierto el panel de alta de alimento propio. */
  readonly creatingFoodFor = signal<number | null>(null);
  readonly createFoodName = signal('');

  private readonly searchInputs = viewChildren<ElementRef<HTMLInputElement>>('searchInput');
  private readonly quantityInputs = viewChildren<ElementRef<HTMLInputElement>>('quantityInput');

  private readonly search$ = new Subject<string>();
  private readonly save$ = new Subject<void>();
  /** Comida ya cargada en `rows`, para no rehidratar de más. */
  private hydratedMealId: string | null = null;
  /** Cuántas veces se ha pulsado Escape seguidas: la segunda descarta la fila. */
  private escapeCount = 0;

  constructor() {
    // Sólo se rehidrata al cambiar de comida, no cada vez que llega un objeto
    // nuevo del servidor: tras cada autoguardado la página recarga las comidas,
    // y rehidratar ahí borraría la fila a medio escribir y degradaría los macros
    // en vivo (el `food` del servidor no trae nutrientes).
    effect(() => {
      const meal = this.meal();
      if (meal.id === this.hydratedMealId) return;
      this.hydratedMealId = meal.id;
      const items = meal.items ?? [];
      this.rows.set([
        ...items.map(item => ({
          food: item.food,
          quantityG: item.quantityG,
          notes: item.notes ?? null,
          query: item.food.name,
        })),
        emptyRow(),
      ]);
      this.closeSuggestions();
    });

    // Un guardado pendiente no se pierde al colapsar el editor o al navegar.
    this.destroyRef.onDestroy(() => this.flush());

    // switchMap cancela la petición en vuelo al teclear de nuevo.
    this.search$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap(term => {
          const tenantId = this.tenantCtx.currentTenantId();
          if (!tenantId || term.trim().length < MIN_QUERY_LENGTH) {
            return of({ foods: [], recipes: [] });
          }
          return this.foodService.search(tenantId, term.trim());
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => {
        const query = this.currentQuery();
        this.suggestions.set([
          ...(result.foods ?? []).map(food => ({ kind: 'food' as const, food })),
          ...(result.recipes ?? []).map(recipe => ({ kind: 'recipe' as const, recipe })),
          ...(query.trim().length >= MIN_QUERY_LENGTH ? [{ kind: 'create' as const }] : []),
        ]);
        this.highlighted.set(0);
        this.searching.set(false);
      });

    this.save$
      .pipe(debounceTime(SAVE_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persist());
  }

  // ── Totales ────────────────────────────────────────────────────────────────

  /** Filas completas, que son las que se persisten y las que cuentan para los macros. */
  private readonly validRows = computed(() =>
    this.rows().filter(row => row.food && (row.quantityG ?? 0) > 0)
  );

  /**
   * Cuántas filas no pueden entrar en el cálculo local.
   *
   * ponytail: el `food` anidado que devuelve el servidor no trae nutrientes (ni
   * en vista Full), así que una fila cargada de base no se puede recalcular en
   * local. Se marca el total como aproximado en vez de fingir precisión; el
   * número exacto llega de `GET /menu/{id}/nutrition` al guardar. Si el backend
   * añade un `GET /food/{id}`, hidratar aquí y quitar el aviso.
   */
  readonly rowsWithoutNutrientData = computed(
    () => this.validRows().filter(row => !hasNutrients(row.food)).length
  );

  readonly isApproximate = computed(() => this.rowsWithoutNutrientData() > 0);

  private total(code: string): number {
    return this.validRows().reduce((sum, row) => {
      if (!hasNutrients(row.food)) return sum;
      return sum + ((row.food.nutrients[code] ?? 0) * (row.quantityG ?? 0)) / 100;
    }, 0);
  }

  readonly kcal = computed(() => this.total(KCAL));
  readonly protein = computed(() => this.total(MACROS[0]));
  readonly fat = computed(() => this.total(MACROS[1]));
  readonly carbs = computed(() => this.total(MACROS[2]));

  /** Reparto porcentual por peso de los tres macros, para la barra. */
  readonly macroSplit = computed(() => {
    const p = this.protein();
    const f = this.fat();
    const c = this.carbs();
    const sum = p + f + c;
    if (sum <= 0) return { protein: 0, fat: 0, carbs: 0 };
    return {
      protein: (p / sum) * 100,
      fat: (f / sum) * 100,
      carbs: (c / sum) * 100,
    };
  });

  // ── Buscador ───────────────────────────────────────────────────────────────

  private currentQuery(): string {
    const index = this.activeRow();
    return index === null ? '' : (this.rows()[index]?.query ?? '');
  }

  onQueryChange(index: number, query: string): void {
    this.escapeCount = 0;
    this.patchRow(index, { query, food: null });
    this.activeRow.set(index);
    if (query.trim().length < MIN_QUERY_LENGTH) {
      this.suggestions.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.search$.next(query);
  }

  closeSuggestions(): void {
    this.suggestions.set([]);
    this.highlighted.set(0);
    this.searching.set(false);
  }

  onSearchKeydown(event: KeyboardEvent, index: number): void {
    const options = this.suggestions();

    switch (event.key) {
      case 'ArrowDown':
        if (!options.length) return;
        event.preventDefault();
        this.highlighted.update(current => (current + 1) % options.length);
        return;

      case 'ArrowUp':
        if (!options.length) return;
        event.preventDefault();
        this.highlighted.update(current => (current - 1 + options.length) % options.length);
        return;

      case 'Enter':
      case 'Tab': {
        const option = options[this.highlighted()];
        if (!option) return;
        event.preventDefault();
        this.choose(option, index);
        return;
      }

      case 'Escape':
        event.preventDefault();
        if (options.length) {
          this.closeSuggestions();
          this.escapeCount = 1;
          return;
        }
        // Segunda pulsación: descarta la fila en edición.
        if (this.escapeCount >= 1) {
          this.escapeCount = 0;
          this.resetRow(index);
        }
        return;

      case 'Backspace':
        // Sólo con el buscador vacío: si no, es un borrado de texto normal.
        if (this.rows()[index]?.query) return;
        event.preventDefault();
        this.removeRow(index);
        return;

      default:
        return;
    }
  }

  onQuantityKeydown(event: KeyboardEvent, index: number): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.confirmRow(index);
  }

  /**
   * Selección con el ratón. Pasa por el mismo camino que el teclado: escribir
   * el nombre en el buscador dispararía otra búsqueda en vez de seleccionar.
   */
  chooseAt(rowIndex: number, optionIndex: number): void {
    const option = this.suggestions()[optionIndex];
    if (option) this.choose(option, rowIndex);
  }

  private choose(option: Suggestion, index: number): void {
    if (option.kind === 'create') {
      this.openFoodCreation(index);
      return;
    }
    if (option.kind === 'recipe') {
      this.expandRecipe(option.recipe, index);
      return;
    }
    this.patchRow(index, { food: option.food, query: option.food.name });
    this.closeSuggestions();
    this.focusQuantity(index);
  }

  /**
   * Elegir una receta no añade una fila: despliega sus ingredientes como N filas
   * que el nutricionista puede ajustar después.
   */
  private expandRecipe(recipe: RecipeDto, index: number): void {
    const expanded: ItemRow[] = recipe.items.map(item => ({
      food: { id: item.foodId, source: 'BEDCA', name: item.name },
      quantityG: item.quantityG,
      notes: item.notes ?? null,
      query: item.name,
    }));
    this.rows.update(rows => {
      const next = [...rows];
      next.splice(index, 1, ...expanded);
      if (!next.some(row => !row.food)) next.push(emptyRow());
      return next;
    });
    this.closeSuggestions();
    this.queueSave();
    this.focusSearch(index + expanded.length);
  }

  // ── Filas ──────────────────────────────────────────────────────────────────

  private patchRow(index: number, patch: Partial<ItemRow>): void {
    this.rows.update(rows => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  onQuantityChange(index: number, value: number | null): void {
    this.patchRow(index, { quantityG: value });
    this.queueSave();
  }

  onNotesChange(index: number, value: string): void {
    this.patchRow(index, { notes: value || null });
    this.queueSave();
  }

  /** Confirma la fila, crea una vacía debajo y deja el foco en su buscador. */
  confirmRow(index: number): void {
    const row = this.rows()[index];
    if (!row?.food || (row.quantityG ?? 0) <= 0) return;

    this.closeSuggestions();
    this.queueSave();

    const isLast = index === this.rows().length - 1;
    if (isLast) {
      this.rows.update(rows => [...rows, emptyRow()]);
    }
    this.focusSearch(index + 1);
  }

  private resetRow(index: number): void {
    this.patchRow(index, emptyRow());
    this.closeSuggestions();
  }

  removeRow(index: number): void {
    const rows = this.rows();
    // Siempre queda al menos una fila, para no dejar el editor sin punto de entrada.
    if (rows.length <= 1) {
      this.resetRow(0);
      this.queueSave();
      return;
    }
    const removed = rows[index];
    this.rows.update(list => list.filter((_, i) => i !== index));
    this.closeSuggestions();
    this.queueSave();
    this.focusSearch(Math.max(0, index - 1));

    // Se puede reinsertar en su índice original (Guía §6).
    this.notify.undo(this.transloco.translate('common.item_removed'), () => {
      this.rows.update(list => {
        const next = [...list];
        next.splice(index, 0, removed);
        return next;
      });
      this.queueSave();
    }, this.transloco.translate('common.undo'));
  }

  moveRow(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.rows().length) return;
    this.rows.update(rows => {
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    this.queueSave();
  }

  // ── Alta de alimento propio ────────────────────────────────────────────────

  openFoodCreation(index: number): void {
    this.createFoodName.set(this.rows()[index]?.query ?? '');
    this.creatingFoodFor.set(index);
    this.closeSuggestions();
  }

  cancelFoodCreation(): void {
    const index = this.creatingFoodFor();
    this.creatingFoodFor.set(null);
    if (index !== null) this.focusSearch(index);
  }

  /** Inserta el alimento recién creado en la misma fila y pasa a gramos. */
  onFoodCreated(food: FoodDto): void {
    const index = this.creatingFoodFor();
    this.creatingFoodFor.set(null);
    if (index === null) return;
    this.patchRow(index, { food, query: food.name });
    this.focusQuantity(index);
  }

  // ── Guardado ───────────────────────────────────────────────────────────────

  private queueSave(): void {
    this.saveState.set('saving');
    this.save$.next();
  }

  /** Fuerza el guardado pendiente, p. ej. al colapsar el editor. */
  flush(): void {
    if (this.saveState() === 'saving') this.persist();
  }

  private persist(): void {
    if (!this.canManage()) return;

    const items: MealItemRequest[] = this.validRows().map((row, index) => ({
      foodId: row.food!.id,
      quantityG: row.quantityG!,
      notes: row.notes,
      sortOrder: index,
    }));

    // Con la lista vacía el servidor exige una descripción, así que se reenvía la
    // que ya tenía: es la combinación que devuelve la comida al modo texto sin
    // perder lo que se veía.
    const fallbackDescription = items.length === 0 ? this.meal().description : null;

    this.saveFn()(this.meal().id, items, fallbackDescription).subscribe({
      next: () => {
        this.saveState.set('saved');
        this.saved.emit();
      },
      error: () => this.saveState.set('idle'),
    });
  }

  // ── Foco ───────────────────────────────────────────────────────────────────

  /** El foco se mueve tras el repintado, de ahí el salto de macrotarea. */
  private focusSearch(index: number): void {
    setTimeout(() => this.searchInputs()[index]?.nativeElement.focus(), 0);
  }

  private focusQuantity(index: number): void {
    setTimeout(() => this.quantityInputs()[index]?.nativeElement.focus(), 0);
  }

  // ── Presentación ───────────────────────────────────────────────────────────

  isTenantFood(food: FoodDto | FoodRef | null): boolean {
    return food?.source === 'TENANT';
  }

  foodKcal(nutrients: NutrientMap): number {
    return nutrients[KCAL] ?? 0;
  }
}
