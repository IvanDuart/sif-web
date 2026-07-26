import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { TuiButton } from '@taiga-ui/core';
import { NotificationService } from '../../core/ui/notification.service';
import { PatientEventService } from '../../core/api/services/patient-event.api';
import { PatientEventDto, CreatePatientEventRequest, UpdatePatientEventRequest } from '../../core/api/models/patient-event.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-patient-event-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslocoDirective, TuiButton],
  templateUrl: './patient-event-form.dialog.html'
})
export class PatientEventFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly patientEventService = inject(PatientEventService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, { event?: PatientEventDto; userId: string }>>();
  ref = { close: () => this.context.$implicit.complete() };

  saving = false;
  existingEvent: PatientEventDto | null = this.context.data.event || null;
  userId: string = this.context.data.userId;
  minDate = new Date().toISOString().split('T')[0];

  form = this.fb.group({
    title: [this.existingEvent?.title ?? '', Validators.required],
    description: [this.existingEvent?.description ?? ''],
    startTime: [this.existingEvent ? new Date(this.existingEvent.startTime).toISOString().split('T')[0] : null as string | null, Validators.required]
  });

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const startTime = raw.startTime as string | null;

    this.saving = true;

    const startOfDay = startTime ? new Date(startTime + 'T00:00:00') : new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = startTime ? new Date(startTime + 'T00:00:00') : new Date();
    endOfDay.setHours(23, 59, 59, 999);

    if (this.existingEvent) {
      const request: UpdatePatientEventRequest = {};
      if (raw.title !== this.existingEvent.title) request.title = raw.title!;
      if (raw.description !== (this.existingEvent.description ?? '')) request.description = raw.description || null;
      if (startOfDay.getTime() !== new Date(this.existingEvent.startTime).getTime()) {
        request.startTime = startOfDay.toISOString();
        request.endTime = endOfDay.toISOString();
      }

      this.patientEventService.update(tenantId, this.existingEvent.id, request).subscribe({
        next: () => {
          this.notify.success(this.transloco.translate('patient_events.save_success'), this.transloco.translate('common.success'));
          this.context.$implicit.next(true);
          this.context.$implicit.complete();
        },
        error: () => {
          this.saving = false;
          this.notify.error(this.transloco.translate('patient_events.save_error'), this.transloco.translate('common.error'));
        }
      });
    } else {
      const request: CreatePatientEventRequest = {
        title: raw.title!,
        description: raw.description || null,
        startTime: startOfDay.toISOString(),
        endTime: endOfDay.toISOString()
      };

      this.patientEventService.create(tenantId, this.userId, request).subscribe({
        next: () => {
          this.notify.success(this.transloco.translate('patient_events.save_success'), this.transloco.translate('common.success'));
          this.context.$implicit.next(true);
          this.context.$implicit.complete();
        },
        error: () => {
          this.saving = false;
          this.notify.error(this.transloco.translate('patient_events.save_error'), this.transloco.translate('common.error'));
        }
      });
    }
  }
}
