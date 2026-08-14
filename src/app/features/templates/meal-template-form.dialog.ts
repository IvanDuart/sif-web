import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiDropdown, TuiTextfield } from '@taiga-ui/core';
import { TuiSelect, TuiDataListWrapper, TuiChevron, TuiTextarea } from '@taiga-ui/kit';
import { TranslocoService, TranslocoPipe, TranslocoDirective } from '@jsverse/transloco';
import { MenuTemplateService, UpdateMealTemplateRequest } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MealTemplate } from '../../core/api/models/menu-template.model';

const DAY_VALUES = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_VALUES = ['COMIDA', 'CENA'] as const;

export interface MealTemplateFormDialogInput {
  templateId: string;
  meal?: MealTemplate;
  prefillDay?: string;
  prefillMealType?: string;
}

@Component({
  selector: 'app-meal-template-form',
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
  templateUrl: './meal-template-form.dialog.html'
})
export class MealTemplateFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
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

  templateId = '';
  isEdit = false;
  mealId = '';

  saving = signal(false);

  form = this.fb.group({
    dayOfWeek: ['', Validators.required],
    mealType: ['', Validators.required],
    description: ['', Validators.required]
  });

  dayStringify = (value: string): string => this.days().find(d => d.value === value)?.label ?? value;
  mealTypeStringify = (value: string): string => this.mealTypes().find(m => m.value === value)?.label ?? value;

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
    } else if (data.prefillDay || data.prefillMealType) {
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
