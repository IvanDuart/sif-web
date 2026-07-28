import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiTextfield, TuiDropdown, TuiFilterByInputPipe, TuiInput } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron, TuiInputDate } from '@taiga-ui/kit';
import { TuiDay } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { HolidayService } from '../../../core/api/services/holiday.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';

@Component({
  selector: 'app-holiday-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslocoDirective,
    TuiButton, TuiTextfield, TuiDropdown, TuiFilterByInputPipe, TuiInput,
    TuiComboBox, TuiDataListWrapper, TuiChevron, TuiInputDate,
  ],
  templateUrl: './holiday-form.dialog.html',
  styleUrls: ['./holiday-form.dialog.scss'],
})
export class HolidayFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly holidayService = inject(HolidayService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean>>();

  readonly typeOptions = signal([
    { label: this.transloco.translate('schedule_settings.national'), value: 'NATIONAL' },
    { label: this.transloco.translate('schedule_settings.local'), value: 'LOCAL' },
  ]);
  readonly typeLabels = computed(() => this.typeOptions().map(t => t.label));

  readonly saving = signal(false);

  readonly form = this.fb.group({
    holidayDate: [null as TuiDay | null, Validators.required],
    description: ['', Validators.required],
    type: ['', Validators.required],
  });

  save() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const day = raw.holidayDate as TuiDay | null;
    if (!day) return;

    // Convert TuiDay to YYYY-MM-DD string
    const holidayDateStr = `${String(day.year).padStart(4, '0')}-${String(day.month + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;

    const selectedType = this.typeOptions().find(t => t.label === raw.type);

    this.saving.set(true);
    this.holidayService.create(tenantId, {
      holidayDate: holidayDateStr,
      description: raw.description as string,
      type: (selectedType?.value as 'NATIONAL' | 'LOCAL') || 'NATIONAL',
    }).subscribe({
      next: () => {
        this.notify.success(this.transloco.translate('schedule_settings.holiday_created'));
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
