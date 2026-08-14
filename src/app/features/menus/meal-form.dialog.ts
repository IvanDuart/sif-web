import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiDropdown, TuiTextfield } from '@taiga-ui/core';
import { TuiSelect, TuiDataListWrapper, TuiChevron, TuiTextarea } from '@taiga-ui/kit';
import { TranslocoService, TranslocoPipe, TranslocoDirective } from '@jsverse/transloco';
import { MealService, CreateMealRequest } from '../../core/api/services/meal.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Meal } from '../../core/api/models/meal.model';

const DAY_VALUES = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_VALUES = ['COMIDA', 'CENA'] as const;

export interface MealFormDialogInput {
  menuId?: string;
  meal?: Meal;
  prefillDay?: string;
  prefillMealType?: string;
}

@Component({
  selector: 'app-meal-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslocoPipe,
    TranslocoDirective,
    TuiButton,
    TuiDropdown,
    TuiTextfield,
    TuiSelect,
    TuiDataListWrapper,
    TuiChevron,
    TuiTextarea,
  ],
  templateUrl: './meal-form.dialog.html'
})
export class MealFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly mealService = inject(MealService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<Meal, MealFormDialogInput>>();

  days = computed(() => DAY_VALUES.map(d => ({
    value: d,
    label: this.transloco.translate(`diet_detail.days.${d.toLowerCase()}`),
  })));

  mealTypes = computed(() => MEAL_VALUES.map(m => ({
    value: m,
    label: this.transloco.translate(`diet_detail.meal_types.${m === 'COMIDA' ? 'lunch' : 'dinner'}`),
  })));

  dayValues = computed(() => this.days().map(d => d.value));
  mealTypeValues = computed(() => this.mealTypes().map(m => m.value));

  isEdit = false;
  mealId = '';
  saving = signal(false);

  form = this.fb.group({
    dayOfWeek: ['', Validators.required],
    mealType: ['', Validators.required],
    description: ['', Validators.required],
  });

  dayStringify = (value: string): string => this.days().find(d => d.value === value)?.label ?? value;
  mealTypeStringify = (value: string): string => this.mealTypes().find(m => m.value === value)?.label ?? value;

  ngOnInit() {
    const data = this.context.data;
    if (data?.meal) {
      const meal = data.meal as Meal;
      this.isEdit = true;
      this.mealId = meal.id;
      this.form.patchValue({
        dayOfWeek: meal.dayOfWeek,
        mealType: meal.mealType,
        description: meal.description,
      });
      this.form.get('dayOfWeek')?.disable();
      this.form.get('mealType')?.disable();
    } else if (data?.prefillDay || data?.prefillMealType) {
      this.form.patchValue({
        ...(data.prefillDay ? { dayOfWeek: data.prefillDay } : {}),
        ...(data.prefillMealType ? { mealType: data.prefillMealType } : {}),
      });
    }
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);

    if (this.isEdit) {
      this.mealService.update(tenantId, this.mealId, {
        description: this.form.getRawValue().description!,
      }).subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.context.$implicit.next(updated);
          this.context.$implicit.complete();
        },
        error: () => this.saving.set(false),
      });
    } else {
      const raw = this.form.getRawValue();
      const payload: CreateMealRequest = {
        menuId: this.context.data?.menuId,
        dayOfWeek: raw.dayOfWeek!,
        mealType: raw.mealType!,
        description: raw.description!,
      };
      this.mealService.create(tenantId, payload).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.context.$implicit.next(created);
          this.context.$implicit.complete();
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
