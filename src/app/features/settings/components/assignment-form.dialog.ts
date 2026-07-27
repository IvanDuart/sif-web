import { Component, inject, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiTextfield, TuiDropdown, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ScheduleService } from '../../../core/api/services/schedule.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { ScheduleDto } from '../../../core/api/models/schedule.model';

export interface AssignmentFormDialogInput {
  schedules: ScheduleDto[];
}

@Component({
  selector: 'app-assignment-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslocoDirective,
    TuiButton, TuiTextfield, TuiDropdown, TuiFilterByInputPipe,
    TuiComboBox, TuiDataListWrapper, TuiChevron,
  ],
  templateUrl: './assignment-form.dialog.html',
  styleUrls: ['./assignment-form.dialog.scss'],
})
export class AssignmentFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly scheduleService = inject(ScheduleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, AssignmentFormDialogInput>>();

  readonly schedules = computed(() => this.context.data?.schedules ?? []);
  readonly scheduleLabels = computed(() => this.schedules().map(s => s.name));

  readonly saving = signal(false);
  readonly indefiniteCtrl = this.fb.control(false);

  readonly form = this.fb.group({
    scheduleId: ['', Validators.required],
    year: [new Date().getFullYear(), Validators.required],
    validFrom: ['', Validators.required],
    validTo: [''],
  });

  save() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const selectedSchedule = this.schedules().find(s => s.name === raw.scheduleId);
    if (!selectedSchedule) return;

    this.saving.set(true);
    this.scheduleService.createAssignment(tenantId, {
      scheduleId: selectedSchedule.id,
      year: raw.year as number,
      validFrom: raw.validFrom as string,
      validTo: this.indefiniteCtrl.value ? null : (raw.validTo || null),
    }).subscribe({
      next: () => {
        this.notify.success(this.transloco.translate('schedule_settings.assignment_created'));
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(this.transloco.translate('common.error'));
      },
    });
  }
}
