import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../core/api/services/appointment-type.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppointmentDto } from '../../core/api/models/appointment.model';

@Component({
  selector: 'app-appointment-action-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, SelectModule, DatePickerModule, InputTextModule, ConfirmDialogModule, TranslocoDirective],
  providers: [ConfirmationService, MessageService],
  templateUrl: './appointment-action.dialog.html'
})
export class AppointmentActionDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentService = inject(AppointmentService);
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly transloco = inject(TranslocoService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  appointment: AppointmentDto = this.config.data.appointment;

  appointmentTypes = signal<{ label: string; value: string }[]>([]);
  saving = signal(false);

  minDate = new Date();

  form = this.fb.group({
    startTime: [null as Date | null, Validators.required],
    typeId: ['', Validators.required],
    notes: ['']
  });

  ngOnInit() {
    this.loadAppointmentTypes();
    this.prefillForm();
  }

  private loadAppointmentTypes() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.appointmentTypeService.getAll(tenantId).subscribe({
      next: (types) => {
        this.appointmentTypes.set(
          (types || []).map(t => ({
            label: `${t.name} (${t.durationMinutes} min)`,
            value: t.id
          }))
        );
      }
    });
  }

  private prefillForm() {
    const startDate = new Date(this.appointment.startTime);
    this.form.patchValue({
      startTime: startDate,
      typeId: this.appointment.typeId || '',
      notes: this.appointment.notes || ''
    });
  }

  submitReschedule() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const startTime = raw.startTime as Date;

    this.saving.set(true);

    this.appointmentService.reschedule(tenantId, this.appointment.id, {
      startTime: startTime.toISOString(),
      typeId: raw.typeId!,
      notes: raw.notes || undefined
    }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.transloco.translate('common.success'),
          detail: this.transloco.translate('appointments.reschedule_success')
        });
        this.ref.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 409) {
          this.messageService.add({
            severity: 'error',
            summary: this.transloco.translate('common.error'),
            detail: this.transloco.translate('appointments.conflict')
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: this.transloco.translate('common.error'),
            detail: this.transloco.translate('appointments.reschedule_error')
          });
        }
      }
    });
  }

  confirmCancel() {
    this.confirmationService.confirm({
      message: this.transloco.translate('appointments.cancel_confirm'),
      header: this.transloco.translate('appointments.cancel'),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: this.transloco.translate('common.yes'),
      rejectLabel: this.transloco.translate('common.no'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.cancelAppointment();
      }
    });
  }

  private cancelAppointment() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    this.appointmentService.updateStatus(tenantId, this.appointment.id, { status: 'CANCELLED' }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.transloco.translate('common.success'),
          detail: this.transloco.translate('appointments.update_success')
        });
        this.ref.close(true);
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: this.transloco.translate('appointments.update_error')
        });
      }
    });
  }

  formatDateTime(isoString: string): string {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
