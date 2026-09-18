import { Component, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoDirective } from '@jsverse/transloco';
import { TuiButton, TuiInput, TuiTextfield, TuiError } from '@taiga-ui/core';

import { FoodDto } from '../../../core/api/models/food.model';
import { CreateFoodRequest, FoodService } from '../../../core/api/services/food.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/**
 * Alta de un alimento que no está en BEDCA, en línea dentro de la fila que se
 * estaba editando.
 *
 * Es un panel y no un diálogo a propósito: el catálogo oficial tiene 957
 * alimentos genéricos y ninguna marca comercial, así que crear un alimento
 * propio es parte del uso normal, no un caso excepcional. Abrir una pantalla
 * nueva perdería lo que el nutricionista llevaba escrito en la comida.
 */
@Component({
  selector: 'app-food-create-panel',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslocoDirective, TuiButton, TuiInput, TuiTextfield, TuiError],
  templateUrl: './food-create-panel.html',
})
export class FoodCreatePanel {
  private readonly fb = inject(FormBuilder);
  private readonly foodService = inject(FoodService);
  private readonly tenantCtx = inject(TenantContextService);

  /** Lo que el usuario había tecleado en el buscador. */
  initialName = input('');

  created = output<FoodDto>();
  cancelled = output<void>();

  readonly saving = signal(false);
  /** Nombre duplicado en el centro: se ofrece usar el que ya existe. */
  readonly duplicateName = signal<string | null>(null);

  private readonly kcalInput = viewChild<ElementRef<HTMLInputElement>>('kcalInput');

  form = this.fb.group({
    name: ['', Validators.required],
    foodGroup: [''],
    // Las kcal son obligatorias: sin ellas el alimento no suma nada y el menú
    // parecería correcto sin serlo.
    kcal: [null as number | null, [Validators.required, Validators.min(0)]],
    protein: [null as number | null],
    fat: [null as number | null],
    carbs: [null as number | null],
  });

  constructor() {
    afterNextRender(() => {
      this.form.patchValue({ name: this.initialName() });
      // El nombre ya viene precargado, así que el foco va donde falta escribir.
      this.kcalInput()?.nativeElement.focus();
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const { name, foodGroup, kcal, protein, fat, carbs } = this.form.getRawValue();

    const nutrients: Record<string, number> = { ENERC_KCAL: kcal! };
    if (protein !== null) nutrients['PROT'] = protein;
    if (fat !== null) nutrients['FAT'] = fat;
    if (carbs !== null) nutrients['CHO'] = carbs;

    const request: CreateFoodRequest = {
      name: name!.trim(),
      ...(foodGroup?.trim() ? { foodGroup: foodGroup.trim() } : {}),
      nutrients,
    };

    this.saving.set(true);
    this.duplicateName.set(null);
    this.foodService.create(tenantId, request).subscribe({
      next: food => {
        this.saving.set(false);
        this.created.emit(food);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (error.status === 409) {
          this.duplicateName.set(request.name);
        }
      },
    });
  }

  /** Faltan macros: el total sale bajo sin avisar, así que se marca en el panel. */
  get missingMacros(): boolean {
    const { protein, fat, carbs } = this.form.getRawValue();
    return protein === null || fat === null || carbs === null;
  }
}
