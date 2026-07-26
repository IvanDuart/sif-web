import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { MealService, CreateMealRequest } from '../../core/api/services/meal.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Meal } from '../../core/api/models/meal.model';

const DAY_VALUES = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_VALUES = ['COMIDA', 'CENA'] as const;

export interface MealFormDialogInput {
  menuId?: string;
  meal?: Meal;
  prefillDay?: string;
}

@Component({
  selector: 'app-meal-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './meal-form.dialog.html'
})
export class MealFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly mealService = inject(MealService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<Meal, MealFormDialogInput>>();

  days: { label: string; value: string }[] = [];
  mealTypes: { label: string; value: string }[] = [];

  isEdit = false;
  mealId = '';
  saving = signal(false);

  form = this.fb.group({
    dayOfWeek: ['', Validators.required],
    mealType: ['', Validators.required],
    description: ['', Validators.required],
  });

  ngOnInit() {
    this.days = DAY_VALUES.map(d => ({
      label: this.transloco.translate(`diet_detail.days.${d.toLowerCase()}`),
      value: d
    }));
    this.mealTypes = MEAL_VALUES.map(m => ({
      label: this.transloco.translate(`diet_detail.meal_types.${m === 'COMIDA' ? 'lunch' : 'dinner'}`),
      value: m
    }));

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
    } else if (data?.prefillDay) {
      this.form.patchValue({ dayOfWeek: data.prefillDay });
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
