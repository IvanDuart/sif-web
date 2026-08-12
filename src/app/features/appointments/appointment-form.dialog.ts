import {Component, inject, signal, OnInit, computed, ChangeDetectionStrategy} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiDropdown, TuiTextfield, TuiLabel, TuiFilterByInputPipe, TuiButton } from '@taiga-ui/core';
import {
  TuiTextarea,
  TuiComboBox,
  TuiDataListWrapper,
  TuiChevron,
  TuiInputDate,
  TuiInputTime
} from '@taiga-ui/kit';
import { TuiDay, TuiTime } from '@taiga-ui/cdk';
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
import { ScheduleAvailabilityService } from '../../core/api/services/schedule-availability.service';

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslocoDirective,
    TuiTextarea,
    TuiDropdown,
    TuiComboBox,
    TuiDataListWrapper,
    TuiTextfield,
    TuiInputDate,
    TuiInputTime,
    TuiFilterByInputPipe,
    TuiLabel,
    TuiButton,
    TuiChevron
  ],
  templateUrl: './appointment-form.dialog.html',
  styleUrls: ['./appointment-form.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  private readonly scheduleAvailability = inject(ScheduleAvailabilityService);

  readonly context = injectContext<TuiDialogContext<boolean, { nutritionistId?: string; startTime?: Date }>>();

  patients = signal<{ label: string; value: string }[]>([]);
  appointmentTypes = signal<{ label: string; value: string }[]>([]);
  saving = signal(false);
  error = signal('');

  scheduleInfo = signal<string | null>(null);
  isHolidayDate = signal(false);
  isClosedDate = signal(false);
  availabilityLoaded = signal(false);

  patientLabels = computed(() => this.patients().map(p => p.label));
  typeLabels = computed(() => this.appointmentTypes().map(t => t.label));

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
    date: [null as TuiDay | null, Validators.required],
    time: [null as TuiTime | null, Validators.required],
    notes: ['']
  });

  ngOnInit() {
    this.loadPatients();
    this.loadAppointmentTypes();

    this.scheduleAvailability.load().subscribe(() => {
      this.availabilityLoaded.set(true);
      this.updateScheduleInfo();
    });

    // Subscribe to date changes to update schedule info
    this.form.get('date')?.valueChanges.subscribe(() => {
      this.updateScheduleInfo();
    });

    if (this.context.data?.startTime) {
      const d = new Date(this.context.data.startTime);
      const day = TuiDay.fromLocalNativeDate(d);
      const time = TuiTime.fromLocalNativeDate(d);
      this.form.patchValue({ date: day, time });
    }
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

  private loadPatients() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.userRoleService.getUsersByTenantAndType(tenantId, 'PATIENT', { size: 1000 }).subscribe({
      next: (users) => {
        this.patients.set(
          (users.content || []).map((u: AppUserDto) => ({
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

    const raw = this.form.value;
    const day = raw.date as TuiDay | null;
    const time = raw.time as TuiTime | null;
    
    if (!day || !time) return;

    // Build local datetime string for validation
    const dateStr = `${String(day.year).padStart(4, '0')}-${String(day.month + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
    const timeStr = `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
    const localDatetimeStr = `${dateStr}T${timeStr}`;

    const validationError = this.scheduleAvailability.validateAppointmentTime(localDatetimeStr);
    if (validationError) {
      this.error.set(validationError);
      return;
    }

    const selectedPatient = this.patients().find(p => p.label === raw.patientId);
    const selectedType = this.appointmentTypes().find(t => t.label === raw.typeId);

    if (!selectedPatient || !selectedType) {
      this.error.set('Por favor, selecciona un paciente y tipo válidos de la lista.');
      return;
    }

    const nutritionistId = this.context.data?.nutritionistId || user.id;

    this.saving.set(true);
    this.error.set('');

    // Convert date and time to ISO string for API
    const startDate = day.toLocalNativeDate();
    startDate.setHours(time.hours, time.minutes, 0, 0);

    this.appointmentService.create(tenantId, {
      nutritionistId,
      patientId: selectedPatient.value,
      typeId: selectedType.value,
      startTime: startDate.toISOString(),
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
