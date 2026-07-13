import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../core/api/services/appointment-type.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentTypeDto } from '../../core/api/models/appointment-type.model';
import { AppUserDto } from '../../core/api/models/user.model';
import { NotificationService } from '../../core/ui';
import { toLocalISOString } from '../../shared/utils/date';

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslocoDirective, TuiTextfield, TuiTextarea],
  templateUrl: './appointment-form.dialog.html'
})
export class AppointmentFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentService = inject(AppointmentService);
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  readonly context = injectContext<TuiDialogContext<boolean, { nutritionistId?: string; startTime?: Date }>>();

  patients = signal<{ label: string; value: string }[]>([]);
  appointmentTypes = signal<{ label: string; value: string }[]>([]);
  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    patientId: ['', Validators.required],
    typeId: ['', Validators.required],
    startTime: ['', Validators.required],
    notes: ['']
  });

  ngOnInit() {
    this.loadPatients();
    this.loadAppointmentTypes();

    if (this.context.data?.startTime) {
      const d = new Date(this.context.data.startTime);
      this.form.patchValue({ startTime: toLocalISOString(d) });
    }
  }

  private loadPatients() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.userRoleService.getUsersByTenantAndType(tenantId, 'PATIENT').subscribe({
      next: (users) => {
        this.patients.set(
          (users || []).map((u: AppUserDto) => ({
            label: `${u.firstName} ${u.lastName}`,
            value: u.id
          }))
        );
      }
    });
  }

  private loadAppointmentTypes() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.appointmentTypeService.getAll(tenantId).subscribe({
      next: (types) => {
        this.appointmentTypes.set(
          (types || []).map((t: AppointmentTypeDto) => ({
            label: `${t.name} (${t.durationMinutes} min)`,
            value: t.id
          }))
        );
      }
    });
  }

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    const user = this.authService.user();
    if (!tenantId || !user) return;

    const nutritionistId = this.context.data?.nutritionistId || user.id;
    const raw = this.form.value;

    this.saving.set(true);
    this.error.set('');

    this.appointmentService.create(tenantId, {
      nutritionistId,
      patientId: raw.patientId!,
      typeId: raw.typeId!,
      startTime: new Date(raw.startTime!).toISOString(),
      notes: raw.notes || undefined
    }).subscribe({
      next: () => {
        this.notify.success(
          this.transloco.translate('appointments.create_success'),
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
          this.error.set(this.transloco.translate('appointments.create_error'));
        }
      }
    });
  }
}
