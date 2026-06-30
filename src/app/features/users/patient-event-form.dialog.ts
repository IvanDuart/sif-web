import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { PatientEventService } from '../../core/api/services/patient-event.api';
import { PatientEventDto, CreatePatientEventRequest, UpdatePatientEventRequest } from '../../core/api/models/patient-event.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-patient-event-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, DatePickerModule, InputTextModule, Textarea, TranslocoDirective],
  templateUrl: './patient-event-form.dialog.html'
})
export class PatientEventFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly patientEventService = inject(PatientEventService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly messageService = inject(MessageService);
  private readonly transloco = inject(TranslocoService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  saving = false;
  existingEvent: PatientEventDto | null = this.config.data.event || null;
  userId: string = this.config.data.userId;
  minDate = new Date();

  form = this.fb.group({
    title: [this.existingEvent?.title ?? '', Validators.required],
    description: [this.existingEvent?.description ?? ''],
    startTime: [this.existingEvent ? new Date(this.existingEvent.startTime) : null as Date | null, Validators.required]
  });

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const startTime = raw.startTime as Date;

    this.saving = true;

    const startOfDay = new Date(startTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startTime);
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
          this.messageService.add({
            severity: 'success',
            summary: this.transloco.translate('common.success'),
            detail: this.transloco.translate('patient_events.save_success')
          });
          this.ref.close(true);
        },
        error: () => {
          this.saving = false;
          this.messageService.add({
            severity: 'error',
            summary: this.transloco.translate('common.error'),
            detail: this.transloco.translate('patient_events.save_error')
          });
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
          this.messageService.add({
            severity: 'success',
            summary: this.transloco.translate('common.success'),
            detail: this.transloco.translate('patient_events.save_success')
          });
          this.ref.close(true);
        },
        error: () => {
          this.saving = false;
          this.messageService.add({
            severity: 'error',
            summary: this.transloco.translate('common.error'),
            detail: this.transloco.translate('patient_events.save_error')
          });
        }
      });
    }
  }
}
