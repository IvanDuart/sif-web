import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiInput, TuiTextfield, TuiLabel, TuiCalendar, TuiDropdown } from '@taiga-ui/core';
import { TuiTextarea, TuiInputDate, TuiInputTime } from '@taiga-ui/kit';
import { TuiDay, TuiTime } from '@taiga-ui/cdk';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import {
  BodyMeasurementDto,
  CreateBodyMeasurementRequest,
  UpdateBodyMeasurementRequest
} from '../../core/api/models/body-measurement.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

/**
 * Campos numéricos de una medición, en el mismo orden que el formulario. Se recorren en lugar de
 * enumerarlos uno a uno al construir el payload: el `PUT` es un reemplazo completo, así que cada
 * campo tiene que viajar aunque esté vacío, y una lista única evita que alguno se quede atrás al
 * añadir métricas nuevas.
 */
const MEASUREMENT_METRIC_FIELDS = [
  'weightKg', 'bodyFatPct', 'muscleMassPct', 'bodyWaterPct', 'visceralFatLevel', 'boneMassKg',
  'waistCm', 'chestCm', 'hipsCm', 'contourCm', 'armCm', 'wristCircumferenceCm',
  'trunkFatPct', 'trunkMassKg',
  'rightArmFatPct', 'rightArmMassKg', 'leftArmFatPct', 'leftArmMassKg',
  'rightLegFatPct', 'rightLegMassKg', 'leftLegFatPct', 'leftLegMassKg'
] as const;

type MeasurementMetricField = typeof MEASUREMENT_METRIC_FIELDS[number];

export interface MeasurementFormDialogData {
  userId: string;
  /** Medición a editar. Sin ella el diálogo da de alta una nueva. */
  measurement?: BodyMeasurementDto | null;
}

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
  readonly context = injectContext<TuiDialogContext<boolean, MeasurementFormDialogData>>();
  ref = { close: () => this.context.$implicit.complete() };

  saving = signal(false);
  userId = this.context.data.userId;
  activeStep = signal(1);

  private readonly measurement = this.context.data.measurement ?? null;
  readonly isEdit = this.measurement !== null;

  form = this.fb.group({
    weightKg: [null as number | null],
    bodyFatPct: [null as number | null],
    muscleMassPct: [null as number | null],
    bodyWaterPct: [null as number | null],
    visceralFatLevel: [null as number | null, [Validators.min(1), Validators.max(59)]],
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

  constructor() {
    if (this.measurement) {
      this.patchFromMeasurement(this.measurement);
    }
  }

  private patchFromMeasurement(m: BodyMeasurementDto) {
    for (const field of MEASUREMENT_METRIC_FIELDS) {
      this.form.controls[field].setValue(m[field] ?? null);
    }

    if (m.measuredAt) {
      const measuredAt = new Date(m.measuredAt);
      if (!Number.isNaN(measuredAt.getTime())) {
        this.form.controls.measuredDate.setValue(TuiDay.fromLocalNativeDate(measuredAt));
        this.form.controls.measuredTime.setValue(
          new TuiTime(measuredAt.getHours(), measuredAt.getMinutes())
        );
      }
    }

    this.form.controls.notes.setValue(m.notes ?? '');
  }

  nextStep() {
    this.activeStep.set(this.activeStep() + 1);
  }

  prevStep() {
    this.activeStep.set(this.activeStep() - 1);
  }

  submit() {
    if (this.form.invalid) return;

    const raw = this.form.value;
    const hasMetric = MEASUREMENT_METRIC_FIELDS.some(field => raw[field] != null);
    if (!hasMetric) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    // En edición el backend reemplaza la fila entera, así que todos los campos viajan: los que el
    // usuario ha vaciado llegan como null y así se borran, que es como se corrige una toma errónea.
    const request: CreateBodyMeasurementRequest = {};
    for (const field of MEASUREMENT_METRIC_FIELDS) {
      request[field as MeasurementMetricField] = raw[field] ?? null;
    }

    if (raw.measuredDate && raw.measuredTime) {
      const d = raw.measuredDate as TuiDay;
      const t = raw.measuredTime as TuiTime;
      const localDate = new Date(d.year, d.month, d.day, t.hours, t.minutes);
      request.measuredAt = localDate.toISOString();
    }
    request.notes = raw.notes || null;

    this.saving.set(true);

    const save$ = this.measurement
      ? this.measurementService.update(tenantId, this.userId, this.measurement.id, request as UpdateBodyMeasurementRequest)
      : this.measurementService.create(tenantId, this.userId, request);

    save$.subscribe({
      next: () => {
        this.saving.set(false);
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
