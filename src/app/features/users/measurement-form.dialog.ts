import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { StepperModule } from 'primeng/stepper';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { CreateBodyMeasurementRequest } from '../../core/api/models/body-measurement.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-measurement-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, InputTextModule, InputNumberModule, Textarea, DatePickerModule, StepperModule, TranslocoDirective],
  templateUrl: './measurement-form.dialog.html'
})
export class MeasurementFormDialog {
  private fb = inject(FormBuilder);
  private measurementService = inject(BodyMeasurementService);
  private tenantCtx = inject(TenantContextService);
  private transloco = inject(TranslocoService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  saving = false;
  userId = '';
  today = new Date();
  activeStep = 1;

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
    measuredAt: [new Date() as Date | null],
    notes: ['']
  });

  constructor() {
    this.userId = this.config.data.userId;
  }

  nextStep() {
    this.activeStep = this.activeStep + 1;
  }

  prevStep() {
    this.activeStep = this.activeStep - 1;
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
    if (raw.measuredAt) request.measuredAt = (raw.measuredAt as Date).toISOString();
    if (raw.notes) request.notes = raw.notes;

    this.saving = true;
    this.measurementService.create(tenantId, this.userId, request).subscribe({
      next: () => {
        this.saving = false;
        this.ref.close(true);
      },
      error: () => this.saving = false
    });
  }
}
