import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiInput } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../core/api/services/appointment-type.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppointmentDto } from '../../core/api/models/appointment.model';
import { NotificationService, ConfirmService } from '../../core/ui';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { toLocalISOString } from '../../shared/utils/date';

@Component({
  selector: 'app-appointment-action-dialog',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslocoDirective, TuiInput, TuiTextarea],
  templateUrl: './appointment-action.dialog.html'
})
export class AppointmentActionDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentService = inject(AppointmentService);
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly permissionsService = inject(PermissionsService);

  canManage = computed(() => this.permissionsService.has('MANAGE_APPOINTMENTS'));

  readonly context = injectContext<TuiDialogContext<boolean, { appointment: AppointmentDto }>>();

  appointment: AppointmentDto = this.context.data.appointment;

  appointmentTypes = signal<{ label: string; value: string }[]>([]);
  saving = signal(false);

  form = this.fb.group({
    startTime: ['', Validators.required],
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
    this.form.patchValue({
      startTime: this.appointment.startTime ? toLocalISOString(new Date(this.appointment.startTime)) : '',
      typeId: this.appointment.typeId || '',
      notes: this.appointment.notes || ''
    });
  }

  submitReschedule() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;

    this.saving.set(true);

    this.appointmentService.reschedule(tenantId, this.appointment.id, {
      startTime: new Date(raw.startTime!).toISOString(),
      typeId: raw.typeId!,
      notes: raw.notes || undefined
    }).subscribe({
      next: () => {
        this.notify.success(
          this.transloco.translate('appointments.reschedule_success'),
          this.transloco.translate('common.success')
        );
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 409) {
          this.notify.error(
            this.transloco.translate('appointments.conflict'),
            this.transloco.translate('common.error')
          );
        } else {
          this.notify.error(
            this.transloco.translate('appointments.reschedule_error'),
            this.transloco.translate('common.error')
          );
        }
      }
    });
  }

  approveProposal() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    this.appointmentService.reschedule(tenantId, this.appointment.id, {
      startTime: new Date(this.appointment.startTime).toISOString(),
      typeId: this.appointment.typeId || undefined,
      notes: this.appointment.notes || undefined
    }).subscribe({
      next: () => {
        this.notify.success('Cita aprobada y programada', this.transloco.translate('common.success'));
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error('No se pudo aprobar la cita', this.transloco.translate('common.error'));
      }
    });
  }

  confirmCancel() {
    this.confirm.confirm({
      label: this.transloco.translate('appointments.cancel'),
      content: this.transloco.translate('appointments.cancel_confirm'),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (confirmed) {
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
        this.notify.success(
          this.transloco.translate('appointments.update_success'),
          this.transloco.translate('common.success')
        );
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(
          this.transloco.translate('appointments.update_error'),
          this.transloco.translate('common.error')
        );
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
