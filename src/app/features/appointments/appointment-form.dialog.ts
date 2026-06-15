import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../core/api/services/appointment-type.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentTypeDto } from '../../core/api/models/appointment-type.model';
import { AppUserDto } from '../../core/api/models/user.model';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, SelectModule, DatePickerModule, InputTextModule, TranslocoDirective],
  templateUrl: './appointment-form.dialog.html'
})
export class AppointmentFormDialog implements OnInit {
  private fb = inject(FormBuilder);
  private appointmentService = inject(AppointmentService);
  private appointmentTypeService = inject(AppointmentTypeService);
  private userRoleService = inject(UserTenantRoleService);
  private tenantCtx = inject(TenantContextService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private transloco = inject(TranslocoService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  patients = signal<{ label: string; value: string }[]>([]);
  appointmentTypes = signal<{ label: string; value: string }[]>([]);
  saving = signal(false);
  error = signal('');

  minDate = new Date();

  form = this.fb.group({
    patientId: ['', Validators.required],
    typeId: ['', Validators.required],
    startTime: [null as Date | null, Validators.required],
    notes: ['']
  });

  ngOnInit() {
    this.loadPatients();
    this.loadAppointmentTypes();
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

    const nutritionistId = this.config.data?.nutritionistId || user.id;
    const raw = this.form.value;
    const startTime = raw.startTime as Date;

    this.saving.set(true);
    this.error.set('');

    this.appointmentService.create(tenantId, {
      nutritionistId,
      patientId: raw.patientId!,
      typeId: raw.typeId!,
      startTime: startTime.toISOString(),
      notes: raw.notes || undefined
    }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.transloco.translate('common.success'),
          detail: this.transloco.translate('appointments.create_success')
        });
        this.ref.close(true);
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
