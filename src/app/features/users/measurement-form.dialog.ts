import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

@Component({
  selector: 'app-measurement-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, InputTextModule, InputNumberModule, Textarea, DatePickerModule],
  templateUrl: './measurement-form.dialog.html'
})
export class MeasurementFormDialog {
  private fb = inject(FormBuilder);
  private measurementService = inject(BodyMeasurementService);
  private tenantCtx = inject(TenantContextService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  saving = false;
  userId = '';
  today = new Date();

  form = this.fb.group({
    weightKg: [null as number | null],
    bodyFatPct: [null as number | null],
    muscleMassKg: [null as number | null],
    measuredAt: [new Date() as Date | null],
    notes: ['']
  });

  constructor() {
    this.userId = this.config.data.userId;
  }

  submit() {
    if (this.form.invalid) return;

    const raw = this.form.value;
    const hasMetric = raw.weightKg != null || raw.bodyFatPct != null || raw.muscleMassKg != null;
    if (!hasMetric) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const request: any = {};
    if (raw.weightKg != null) request.weightKg = raw.weightKg;
    if (raw.bodyFatPct != null) request.bodyFatPct = raw.bodyFatPct;
    if (raw.muscleMassKg != null) request.muscleMassKg = raw.muscleMassKg;
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
