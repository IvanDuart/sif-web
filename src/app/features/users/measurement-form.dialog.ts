import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiInput, TuiTextfield, TuiLabel, TuiCalendar, TuiDropdown } from '@taiga-ui/core';
import { TuiTextarea, TuiInputDate, TuiInputTime } from '@taiga-ui/kit';
import { TuiDay, TuiTime } from '@taiga-ui/cdk';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { CreateBodyMeasurementRequest } from '../../core/api/models/body-measurement.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-measurement-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslocoDirective,
    TuiButton,
    TuiInput,
    TuiTextfield,
    TuiLabel,
    TuiTextarea,
    TuiInputDate,
    TuiInputTime,
    TuiCalendar,
    TuiDropdown,
  ],
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
    boneMassKg: [null as number | null],
    waistCm: [null as number | null],
    chestCm: [null as number | null],
    hipsCm: [null as number | null],
    contourCm: [null as number | null],
    armCm: [null as number | null],
    wristCircumferenceCm: [null as number | null],
    trunkFatPct: [null as number | null],
    trunkMassKg: [null as number | null],
    rightArmFatPct: [null as number | null],
    rightArmMassKg: [null as number | null],
    leftArmFatPct: [null as number | null],
    leftArmMassKg: [null as number | null],
    rightLegFatPct: [null as number | null],
    rightLegMassKg: [null as number | null],
    leftLegFatPct: [null as number | null],
    leftLegMassKg: [null as number | null],
    measuredDate: [TuiDay.fromLocalNativeDate(new Date())],
    measuredTime: [new TuiTime(new Date().getHours(), new Date().getMinutes())],
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
      raw.bodyWaterPct != null || raw.boneMassKg != null ||
      raw.waistCm != null || raw.chestCm != null || raw.hipsCm != null ||
      raw.contourCm != null || raw.armCm != null || raw.wristCircumferenceCm != null ||
      raw.trunkFatPct != null || raw.trunkMassKg != null ||
      raw.rightArmFatPct != null || raw.rightArmMassKg != null ||
      raw.leftArmFatPct != null || raw.leftArmMassKg != null ||
      raw.rightLegFatPct != null || raw.rightLegMassKg != null ||
      raw.leftLegFatPct != null || raw.leftLegMassKg != null;
    if (!hasMetric) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const request: CreateBodyMeasurementRequest = {};
    if (raw.weightKg != null) request.weightKg = raw.weightKg;
    if (raw.bodyFatPct != null) request.bodyFatPct = raw.bodyFatPct;
    if (raw.muscleMassKg != null) request.muscleMassKg = raw.muscleMassKg;
    if (raw.bodyWaterPct != null) request.bodyWaterPct = raw.bodyWaterPct;
    if (raw.boneMassKg != null) request.boneMassKg = raw.boneMassKg;
    if (raw.waistCm != null) request.waistCm = raw.waistCm;
    if (raw.chestCm != null) request.chestCm = raw.chestCm;
    if (raw.hipsCm != null) request.hipsCm = raw.hipsCm;
    if (raw.contourCm != null) request.contourCm = raw.contourCm;
    if (raw.armCm != null) request.armCm = raw.armCm;
    if (raw.wristCircumferenceCm != null) request.wristCircumferenceCm = raw.wristCircumferenceCm;
    if (raw.trunkFatPct != null) request.trunkFatPct = raw.trunkFatPct;
    if (raw.trunkMassKg != null) request.trunkMassKg = raw.trunkMassKg;
    if (raw.rightArmFatPct != null) request.rightArmFatPct = raw.rightArmFatPct;
    if (raw.rightArmMassKg != null) request.rightArmMassKg = raw.rightArmMassKg;
    if (raw.leftArmFatPct != null) request.leftArmFatPct = raw.leftArmFatPct;
    if (raw.leftArmMassKg != null) request.leftArmMassKg = raw.leftArmMassKg;
    if (raw.rightLegFatPct != null) request.rightLegFatPct = raw.rightLegFatPct;
    if (raw.rightLegMassKg != null) request.rightLegMassKg = raw.rightLegMassKg;
    if (raw.leftLegFatPct != null) request.leftLegFatPct = raw.leftLegFatPct;
    if (raw.leftLegMassKg != null) request.leftLegMassKg = raw.leftLegMassKg;

    if (raw.measuredDate && raw.measuredTime) {
      const d = raw.measuredDate as TuiDay;
      const t = raw.measuredTime as TuiTime;
      const localDate = new Date(d.year, d.month, d.day, t.hours, t.minutes);
      request.measuredAt = localDate.toISOString();
    }
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
