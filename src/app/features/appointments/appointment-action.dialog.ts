import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiTextfield, TuiLabel, TuiDropdown } from '@taiga-ui/core';
import { TuiTextarea, TuiInputDate, TuiInputTime } from '@taiga-ui/kit';
import { TuiDay, TuiTime } from '@taiga-ui/cdk';
import { injectContext } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../core/api/services/appointment-type.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppointmentDto } from '../../core/api/models/appointment.model';
import { NotificationService, ConfirmService } from '../../core/ui';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { ScheduleAvailabilityService } from '../../core/api/services/schedule-availability.service';

@Component({
  selector: 'app-appointment-action-dialog',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslocoDirective, TuiButton, TuiTextarea, TuiTextfield, TuiInputDate, TuiInputTime, TuiLabel, TuiDropdown],
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
  private readonly scheduleAvailability = inject(ScheduleAvailabilityService);

  canManage = computed(() => this.permissionsService.has('MANAGE_APPOINTMENTS'));

  readonly context = injectContext<TuiDialogContext<boolean, { appointment: AppointmentDto }>>();

  appointment: AppointmentDto = this.context.data.appointment;

  appointmentTypes = signal<{ label: string; value: string }[]>([]);
  saving = signal(false);
  error = signal('');

  scheduleInfo = signal<string | null>(null);
  isHolidayDate = signal(false);
  isClosedDate = signal(false);
  availabilityLoaded = signal(false);

  form = this.fb.group({
    date: [null as TuiDay | null, Validators.required],
    time: [null as TuiTime | null, Validators.required],
    typeId: ['', Validators.required],
    notes: ['']
  });

  ngOnInit() {
    this.loadAppointmentTypes();
    this.prefillForm();

    this.scheduleAvailability.load().subscribe(() => {
      this.availabilityLoaded.set(true);
      this.updateScheduleInfo();
    });

    this.form.get('date')?.valueChanges.subscribe(() => {
      this.updateScheduleInfo();
    });
  }

  private updateScheduleInfo() {
    const raw = this.form.get('date')?.value;
    if (!raw || !this.availabilityLoaded()) return;

    const day = raw as TuiDay;
    if (!day) return;

    const dateStr = `${String(day.year).padStart(4, '0')}-${String(day.month + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;

    this.isHolidayDate.set(this.scheduleAvailability.isHolidayCached(dateStr));
    this.isClosedDate.set(false);
    this.scheduleInfo.set(null);
    this.error.set('');

    if (this.isHolidayDate()) {
      return;
    }

    const formatted = this.scheduleAvailability.getFormattedSchedule(dateStr);
    if (formatted) {
      this.scheduleInfo.set(`Horario: ${formatted}`);
    } else {
      this.isClosedDate.set(true);
    }
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
    const day = this.appointment.startTime ? TuiDay.fromLocalNativeDate(new Date(this.appointment.startTime)) : null;
    const time = this.appointment.startTime ? TuiTime.fromLocalNativeDate(new Date(this.appointment.startTime)) : null;
    this.form.patchValue({
      date: day,
      time,
      typeId: this.appointment.typeId || '',
      notes: this.appointment.notes || ''
    });
  }

  submitReschedule() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const day = raw.date as TuiDay | null;
    const time = raw.time as TuiTime | null;

    if (!day || !time) return;

    const dateStr = `${String(day.year).padStart(4, '0')}-${String(day.month + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
    const timeStr = `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
    const localDatetimeStr = `${dateStr}T${timeStr}`;

    const validationError = this.scheduleAvailability.validateAppointmentTime(localDatetimeStr);
    if (validationError) {
      this.error.set(validationError);
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const startDate = day.toLocalNativeDate();
    startDate.setHours(time.hours, time.minutes, 0, 0);

    this.appointmentService.reschedule(tenantId, this.appointment.id, {
      startTime: startDate.toISOString(),
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
          this.error.set(this.transloco.translate('appointments.conflict'));
        } else {
          this.error.set(this.transloco.translate('appointments.reschedule_error'));
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
