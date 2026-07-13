import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { CreateBodyMeasurementRequest } from '../../core/api/models/body-measurement.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { toLocalISOString } from '../../shared/utils/date';

@Component({
  selector: 'app-measurement-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslocoDirective],
  templateUrl: './measurement-form.dialog.html'
})
export class MeasurementFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly measurementService = inject(BodyMeasurementService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, { userId: string }>>();
  ref = { close: () => this.context.$implicit.complete() };

  saving = signal(false);
  userId = this.context.data.userId;
  activeStep = signal(1);

  form = this.fb.group({
    weightKg: [null as number | null],
    bodyFatPct: [null as number | null],
    muscleMassKg: [null as number | null],
    bodyWaterPct: [null as number | null],
    waistCm: [null as number | null],
    chestCm: [null as number | null],
    hipsCm: [null as number | null],
    contourCm: [null as number | null],
    armCm: [null as number | null],
    measuredAt: [toLocalISOString(new Date()) as string | null],
    notes: ['']
  });

  nextStep() {
    this.activeStep.set(this.activeStep() + 1);
  }

  prevStep() {
    this.activeStep.set(this.activeStep() - 1);
  }

  submit() {
    if (this.form.invalid) return;

    const raw = this.form.value;
    const hasMetric =
      raw.weightKg != null || raw.bodyFatPct != null || raw.muscleMassKg != null ||
      raw.bodyWaterPct != null ||
      raw.waistCm != null || raw.chestCm != null || raw.hipsCm != null ||
      raw.contourCm != null || raw.armCm != null;
    if (!hasMetric) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const request: CreateBodyMeasurementRequest = {};
    if (raw.weightKg != null) request.weightKg = raw.weightKg;
    if (raw.bodyFatPct != null) request.bodyFatPct = raw.bodyFatPct;
    if (raw.muscleMassKg != null) request.muscleMassKg = raw.muscleMassKg;
    if (raw.bodyWaterPct != null) request.bodyWaterPct = raw.bodyWaterPct;
    if (raw.waistCm != null) request.waistCm = raw.waistCm;
    if (raw.chestCm != null) request.chestCm = raw.chestCm;
    if (raw.hipsCm != null) request.hipsCm = raw.hipsCm;
    if (raw.contourCm != null) request.contourCm = raw.contourCm;
    if (raw.armCm != null) request.armCm = raw.armCm;
    if (raw.measuredAt) request.measuredAt = new Date(raw.measuredAt).toISOString();
    if (raw.notes) request.notes = raw.notes;

    this.saving.set(true);
    this.measurementService.create(tenantId, this.userId, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
