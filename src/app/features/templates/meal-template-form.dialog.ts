import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MenuTemplateService, UpdateMealTemplateRequest } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

const DAYS = [
  { label: 'Lunes', value: 'LUNES' },
  { label: 'Martes', value: 'MARTES' },
  { label: 'Miércoles', value: 'MIERCOLES' },
  { label: 'Jueves', value: 'JUEVES' },
  { label: 'Viernes', value: 'VIERNES' },
  { label: 'Sábado', value: 'SABADO' },
  { label: 'Domingo', value: 'DOMINGO' },
];

const MEAL_TYPES = [
  { label: 'Comida', value: 'COMIDA' },
  { label: 'Cena', value: 'CENA' },
];

@Component({
  selector: 'app-meal-template-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Button, Textarea, Select],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4 mt-2">
      <div class="field flex flex-col gap-2">
        <label for="dayOfWeek" class="font-medium">Día de la semana</label>
        <p-select
          id="dayOfWeek"
          formControlName="dayOfWeek"
          [options]="days"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleccionar día"
          class="w-full"
          appendTo="body">
        </p-select>
      </div>

      <div class="field flex flex-col gap-2">
        <label for="mealType" class="font-medium">Tipo de comida</label>
        <p-select
          id="mealType"
          formControlName="mealType"
          [options]="mealTypes"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleccionar tipo"
          class="w-full"
          appendTo="body">
        </p-select>
      </div>

      <div class="field flex flex-col gap-2">
        <label for="description" class="font-medium">Descripción del plato</label>
        <textarea id="description" pTextarea formControlName="description" class="w-full" rows="3" placeholder="Ej: Pechuga de pollo con arroz y verduras"></textarea>
      </div>

      <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
        <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="ref.close()"></p-button>
        <p-button
          [label]="isEdit ? 'Guardar Cambios' : 'Añadir Plato'"
          type="submit"
          [disabled]="form.invalid"
          [loading]="saving()">
        </p-button>
      </div>
    </form>
  `
})
export class MealTemplateFormDialog {
  private fb = inject(FormBuilder);
  private templateService = inject(MenuTemplateService);
  private tenantCtx = inject(TenantContextService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  days = DAYS;
  mealTypes = MEAL_TYPES;

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
    const data = this.config.data;
    this.templateId = data.templateId;

    if (data.meal) {
      this.isEdit = true;
      this.mealId = data.meal.id;
      this.form.patchValue({
        dayOfWeek: data.meal.dayOfWeek,
        mealType: data.meal.mealType,
        description: data.meal.description
      });
    }
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
        this.ref.close(result);
      },
      error: () => this.saving.set(false)
    });
  }
}
