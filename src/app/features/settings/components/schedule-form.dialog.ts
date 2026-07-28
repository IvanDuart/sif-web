import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiTextfield, TuiDropdown, TuiFilterByInputPipe, TuiInput } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron, TuiInputTime, TuiInputColor } from '@taiga-ui/kit';
import { TuiTime } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ScheduleService } from '../../../core/api/services/schedule.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { ScheduleDto } from '../../../core/api/models/schedule.model';

export interface ScheduleFormDialogInput {
  schedule?: ScheduleDto;
}

@Component({
  selector: 'app-schedule-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslocoDirective,
    TuiButton, TuiTextfield, TuiDropdown, TuiFilterByInputPipe, TuiInput,
    TuiComboBox, TuiDataListWrapper, TuiChevron, TuiInputTime, TuiInputColor,
  ],
  templateUrl: './schedule-form.dialog.html',
  styleUrls: ['./schedule-form.dialog.scss'],
})
export class ScheduleFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly scheduleService = inject(ScheduleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, ScheduleFormDialogInput>>();

  readonly dayOptions = signal([
    { label: this.transloco.translate('schedule_settings.monday'), value: 1 },
    { label: this.transloco.translate('schedule_settings.tuesday'), value: 2 },
    { label: this.transloco.translate('schedule_settings.wednesday'), value: 3 },
    { label: this.transloco.translate('schedule_settings.thursday'), value: 4 },
    { label: this.transloco.translate('schedule_settings.friday'), value: 5 },
    { label: this.transloco.translate('schedule_settings.saturday'), value: 6 },
    { label: this.transloco.translate('schedule_settings.sunday'), value: 7 },
  ]);
  readonly dayLabels = computed(() => this.dayOptions().map(d => d.label));

  readonly editing = signal(false);
  readonly saving = signal(false);
  private scheduleId: string | null = null;

  readonly form = this.fb.group({
    name: ['', Validators.required],
    color: ['#4F46E5'],
    details: this.fb.array([]),
  });

  get details(): FormArray {
    return this.form.get('details') as FormArray;
  }

  constructor() {
    const data = this.context.data;
    if (data?.schedule) {
      const s = data.schedule;
      this.editing.set(true);
      this.scheduleId = s.id;
      this.form.patchValue({ name: s.name, color: s.color });
      for (const detail of s.details) {
        const dayLabel = this.dayOptions().find(d => d.value === detail.dayOfWeek)?.label ?? '';
        // Parse time strings (HH:mm:ss) to TuiTime objects
        const startTime = this.parseTimeString(detail.startTime);
        const endTime = this.parseTimeString(detail.endTime);
        this.details.push(
          this.fb.group({
            dayOfWeek: [dayLabel, Validators.required],
            startTime: [startTime, Validators.required],
            endTime: [endTime, Validators.required],
          }),
        );
      }
    }
  }

  addBlock() {
    this.details.push(
      this.fb.group({
        dayOfWeek: [this.dayLabels()[0], Validators.required],
        startTime: [new TuiTime(9, 0), Validators.required],
        endTime: [new TuiTime(17, 0), Validators.required],
      }),
    );
  }

  removeBlock(index: number) {
    this.details.removeAt(index);
  }

  save() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const details = (raw.details as Array<{ dayOfWeek: string; startTime: TuiTime; endTime: TuiTime }>).map(d => ({
      dayOfWeek: this.dayOptions().find(o => o.label === d.dayOfWeek)?.value ?? 1,
      startTime: this.formatTimeToString(d.startTime),
      endTime: this.formatTimeToString(d.endTime),
    }));

    const request = {
      name: raw.name as string,
      color: raw.color as string,
      details,
    };

    this.saving.set(true);
    
    // Conditional: create vs update
    const operation$ = this.editing() && this.scheduleId
      ? this.scheduleService.update(tenantId, this.scheduleId, request)
      : this.scheduleService.create(tenantId, request);

    operation$.subscribe({
      next: () => {
        this.notify.success(this.transloco.translate('schedule_settings.schedule_saved'));
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(this.transloco.translate('common.error'));
      },
    });
  }

  private parseTimeString(timeStr: string): TuiTime {
    // Parse "HH:mm:ss" or "HH:mm" to TuiTime
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return new TuiTime(hours, minutes);
  }

  private formatTimeToString(time: TuiTime): string {
    // Format TuiTime to "HH:mm:ss"
    const hours = String(time.hours).padStart(2, '0');
    const minutes = String(time.minutes).padStart(2, '0');
    return `${hours}:${minutes}:00`;
  }
}
