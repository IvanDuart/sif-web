import { Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiTextarea } from '@taiga-ui/kit';
import { Meal } from '../../../core/api/models/meal.model';
import { MACROS, NutrientMap } from '../../../core/api/models/food.model';

/**
 * Una celda de comida de la rejilla semanal: muestra la comida, la edita en
 * línea, o ofrece añadirla si el hueco está libre.
 *
 * Existe porque este bloque estaba copiado seis veces (menús escritorio y
 * móvil × comida y cena, más plantillas × comida y cena), y el editor de
 * alimentos tiene que aterrizar en un solo sitio.
 *
 * Es presentacional: el estado de edición vive en la página, que es la que
 * mantiene el invariante de "solo una celda en edición a la vez".
 */
@Component({
  selector: 'app-meal-cell',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslocoDirective, TuiButton, TuiBadge, TuiTextfield, TuiTextarea],
  templateUrl: './meal-cell.html',
})
export class MealCell {
  /** `undefined` = hueco libre. `MealTemplate` encaja igual: misma forma. */
  meal = input<Meal | undefined>();
  canManage = input(false);
  editing = input(false);
  saving = input(false);
  /** Texto en edición. Lo posee la página, para que Escape pueda descartarlo. */
  draft = input('');
  /** `diet_detail` en menús, `template_detail` en plantillas. */
  i18nPrefix = input.required<string>();
  /** Calorías de la comida, si hay datos nutricionales. */
  kcal = input<number | null>(null);
  /**
   * Nutrientes de la comida, del endpoint de nutrición. Se pintan también en la
   * vista de solo lectura: el paciente ve el reparto, no sólo las calorías.
   */
  nutrients = input<NutrientMap | null>(null);

  readonly macros = computed(() => {
    const nutrients = this.nutrients();
    if (!nutrients) return null;
    const [protein, fat, carbs] = MACROS.map(code => nutrients[code]);
    if (protein === undefined && fat === undefined && carbs === undefined) return null;
    return { protein: protein ?? 0, fat: fat ?? 0, carbs: carbs ?? 0 };
  });

  draftChange = output<string>();
  add = output<void>();
  edit = output<void>();
  remove = output<void>();
  save = output<void>();
  /** No se llama `cancel` a secas: choca con el evento nativo del DOM. */
  cancelEdit = output<void>();

  readonly canSave = computed(() => !this.saving() && this.draft().trim().length > 0);

  /**
   * Enter guarda; Shift+Enter deja escribir un salto de línea, que es lo que se
   * espera en un textarea.
   */
  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return;
    keyboardEvent.preventDefault();
    if (this.canSave()) this.save.emit();
  }
}
