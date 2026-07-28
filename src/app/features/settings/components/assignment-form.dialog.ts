import { Component, inject, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiTextfield, TuiDropdown, TuiFilterByInputPipe, TuiCheckbox } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron, TuiInputDate } from '@taiga-ui/kit';
import { TuiDay } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ScheduleService } from '../../../core/api/services/schedule.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { ScheduleDto, TenantScheduleAssignmentDto } from '../../../core/api/models/schedule.model';

export interface AssignmentFormDialogInput {
  schedules: ScheduleDto[];
  assignment?: TenantScheduleAssignmentDto;
}

@Component({
  selector: 'app-assignment-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslocoDirective,
    TuiButton, TuiTextfield, TuiDropdown, TuiFilterByInputPipe,
    TuiComboBox, TuiDataListWrapper, TuiChevron, TuiInputDate, TuiCheckbox,
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
  readonly editing = signal(false);
  readonly indefiniteCtrl = this.fb.control(false);
  private assignmentId: string | null = null;

  readonly form = this.fb.group({
    scheduleId: ['', Validators.required],
    validFrom: [null as TuiDay | null, Validators.required],
    validTo: [null as TuiDay | null],
  });

  constructor() {
    const data = this.context.data;
    const assignment = data?.assignment;

    if (assignment) {
      this.editing.set(true);
      this.assignmentId = assignment.id;

      // Set schedule combobox to the schedule name
      this.form.patchValue({
        scheduleId: assignment.schedule.name,
      });

      // Parse validFrom string (YYYY-MM-DD) to TuiDay
      const validFromParts = assignment.validFrom.split('-');
      const validFromDay = new TuiDay(
        parseInt(validFromParts[0], 10),
        parseInt(validFromParts[1], 10) - 1, // TuiDay months are 0-indexed
        parseInt(validFromParts[2], 10)
      );
      this.form.patchValue({ validFrom: validFromDay });

      // Parse validTo string to TuiDay if it exists
      if (assignment.validTo) {
        const validToParts = assignment.validTo.split('-');
        const validToDay = new TuiDay(
          parseInt(validToParts[0], 10),
          parseInt(validToParts[1], 10) - 1,
          parseInt(validToParts[2], 10)
        );
        this.form.patchValue({ validTo: validToDay });
        this.indefiniteCtrl.setValue(false);
      } else {
        this.indefiniteCtrl.setValue(true);
      }
    }
  }

  save() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const selectedSchedule = this.schedules().find(s => s.name === raw.scheduleId);
    if (!selectedSchedule) return;

    // Convert TuiDay to YYYY-MM-DD string
    const validFromDay = raw.validFrom as TuiDay | null;
    if (!validFromDay) return;
    
    const validFromStr = `${String(validFromDay.year).padStart(4, '0')}-${String(validFromDay.month + 1).padStart(2, '0')}-${String(validFromDay.day).padStart(2, '0')}`;
    
    // Auto-calculate year from validFrom.year
    const year = validFromDay.year;
    
    let validToStr: string | null = null;
    if (!this.indefiniteCtrl.value && raw.validTo) {
      const validToDay = raw.validTo as TuiDay;
      validToStr = `${String(validToDay.year).padStart(4, '0')}-${String(validToDay.month + 1).padStart(2, '0')}-${String(validToDay.day).padStart(2, '0')}`;
    }

    const request = {
      scheduleId: selectedSchedule.id,
      year,
      validFrom: validFromStr,
      validTo: validToStr,
    };

    this.saving.set(true);
    
    // Conditional: create vs update
    const operation$ = this.editing() && this.assignmentId
      ? this.scheduleService.updateAssignment(tenantId, this.assignmentId, request)
      : this.scheduleService.createAssignment(tenantId, request);

    operation$.subscribe({
      next: () => {
        const msgKey = this.editing() ? 'schedule_settings.assignment_updated' : 'schedule_settings.assignment_created';
        this.notify.success(this.transloco.translate(msgKey));
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
