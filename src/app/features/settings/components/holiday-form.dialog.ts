import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiTextfield, TuiDropdown, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
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
    TuiButton, TuiTextfield, TuiDropdown, TuiFilterByInputPipe,
    TuiComboBox, TuiDataListWrapper, TuiChevron,
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
    holidayDate: ['', Validators.required],
    description: ['', Validators.required],
    type: ['', Validators.required],
  });

  save() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const selectedType = this.typeOptions().find(t => t.label === raw.type);

    this.saving.set(true);
    this.holidayService.create(tenantId, {
      holidayDate: raw.holidayDate as string,
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
