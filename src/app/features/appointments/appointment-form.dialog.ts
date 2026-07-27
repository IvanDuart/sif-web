import {Component, inject, signal, OnInit, computed, ChangeDetectionStrategy, effect} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiDropdown, TuiTextfield, TuiLabel, TuiFilterByInputPipe, TuiInput, TuiButton } from '@taiga-ui/core';
import {
  TuiTextarea,
  TuiComboBox,
  TuiDataListWrapper,
  TuiChevron
} from '@taiga-ui/kit';
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
    TuiInput,
    TuiFilterByInputPipe,
    TuiLabel,
    TuiButton,
    TuiChevron
  ],
  templateUrl: './appointment-form.dialog.html',
  styles: [`
    input[type="datetime-local"]::-webkit-calendar-picker-indicator {
      transform: translateY(-2px);
      cursor: pointer;
    }
  `],
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
    startTime: ['', Validators.required],
    notes: ['']
  });

  ngOnInit() {
    this.loadPatients();
    this.loadAppointmentTypes();

    this.scheduleAvailability.load().subscribe(() => {
      this.availabilityLoaded.set(true);
      this.updateScheduleInfo();
    });

    if (this.context.data?.startTime) {
      const d = new Date(this.context.data.startTime);
      const pad = (n: number) => String(n).padStart(2, '0');
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      this.form.patchValue({ startTime: local });
    }
  }

  private updateScheduleInfo() {
    const raw = this.form.get('startTime')?.value;
    if (!raw || !this.availabilityLoaded()) return;
    const dateStr = raw.substring(0, 10);

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

  onStartTimeChange() {
    this.updateScheduleInfo();
  }

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    const user = this.authService.user();
    if (!tenantId || !user) return;

    const raw = this.form.value;
    const startTime = raw.startTime as string;

    const validationError = this.scheduleAvailability.validateAppointmentTime(startTime);
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

    this.appointmentService.create(tenantId, {
      nutritionistId,
      patientId: selectedPatient.value,
      typeId: selectedType.value,
      startTime: new Date(startTime).toISOString(),
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
