import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiDropdown, TuiTextfield, TuiLabel } from '@taiga-ui/core';
import { TuiTextarea, TuiSelect, TuiDataListWrapper, TuiStringifyContentPipe, TuiInputDateTime } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core';
import { TuiDay, TuiTime } from '@taiga-ui/cdk';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../core/api/services/appointment-type.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentTypeDto } from '../../core/api/models/appointment-type.model';
import { AppUserDto } from '../../core/api/models/user.model';
import { NotificationService } from '../../core/ui';

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslocoDirective,
    TuiTextarea,
    TuiDropdown,
    TuiSelect,
    TuiDataListWrapper,
    TuiStringifyContentPipe,
    TuiInputDateTime,
    TuiTextfield,
    TuiLabel
  ],
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

  patientValues = computed(() => this.patients().map(p => p.value));
  patientStringify = (value: string): string => {
    const found = this.patients().find(p => p.value === value);
    return found ? found.label : value;
  };

  typeValues = computed(() => this.appointmentTypes().map(t => t.value));
  typeStringify = (value: string): string => {
    const found = this.appointmentTypes().find(t => t.value === value);
    return found ? found.label : value;
  };

  form = this.fb.group({
    patientId: ['', Validators.required],
    typeId: ['', Validators.required],
    startTime: [null as [TuiDay, TuiTime] | null, Validators.required],
    notes: ['']
  });

  ngOnInit() {
    this.loadPatients();
    this.loadAppointmentTypes();

    if (this.context.data?.startTime) {
      const d = new Date(this.context.data.startTime);
      this.form.patchValue({
        startTime: [
          TuiDay.fromLocalNativeDate(d),
          TuiTime.fromLocalNativeDate(d)
        ]
      });
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
      startTime: (() => {
        const [day, time] = raw.startTime as unknown as [TuiDay, TuiTime];
        return new Date(day.year, day.month, day.day, time.hours, time.minutes, time.seconds || 0, time.ms || 0).toISOString();
      })(),
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
