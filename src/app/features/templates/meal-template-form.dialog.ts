import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { TuiButton } from '@taiga-ui/core';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { MenuTemplateService, UpdateMealTemplateRequest } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MealTemplate } from '../../core/api/models/menu-template.model';

const DAY_VALUES = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_VALUES = ['COMIDA', 'CENA'] as const;

export interface MealTemplateFormDialogInput {
  templateId: string;
  meal?: MealTemplate;
  prefillDay?: string;
}

@Component({
  selector: 'app-meal-template-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TuiButton, TranslocoPipe],
  templateUrl: './meal-template-form.dialog.html'
})
export class MealTemplateFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<MealTemplate, MealTemplateFormDialogInput>>();

  days: { label: string; value: string }[] = [];
  mealTypes: { label: string; value: string }[] = [];

  templateId = '';
  isEdit = false;
  mealId = '';

  saving = signal(false);

  form = this.fb.group({
    dayOfWeek: ['', Validators.required],
    mealType: ['', Validators.required],
    description: ['', Validators.required]
  });

  constructor() {
    const data = this.context.data;
    this.templateId = data.templateId;

    if (data.meal) {
      this.isEdit = true;
      this.mealId = data.meal.id;
      this.form.patchValue({
        dayOfWeek: data.meal.dayOfWeek,
        mealType: data.meal.mealType,
        description: data.meal.description
      });
    } else if (data.prefillDay) {
      this.form.patchValue({ dayOfWeek: data.prefillDay });
    }
  }

  ngOnInit() {
    this.days = DAY_VALUES.map(d => ({
      label: this.transloco.translate(`template_detail.days.${d.toLowerCase()}`),
      value: d
    }));
    this.mealTypes = MEAL_VALUES.map(m => ({
      label: this.transloco.translate(`template_detail.meal_types.${m === 'COMIDA' ? 'lunch' : 'dinner'}`),
      value: m
    }));
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    const payload = this.form.value as UpdateMealTemplateRequest;

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
