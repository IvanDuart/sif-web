import {Component, inject, signal, OnInit, computed, ChangeDetectionStrategy, OnDestroy} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Observable, of, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs';
import { TuiDropdown, TuiTextfield, TuiLabel, TuiFilterByInputPipe, TuiButton, TuiCheckbox, TuiInput } from '@taiga-ui/core';
import {
  TuiTextarea,
  TuiComboBox,
  TuiDataListWrapper,
  TuiChevron,
  TuiInputDate,
  TuiInputTime,
  TuiSelect
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
import { CreateAppointmentRequest } from '../../core/api/models/appointment.model';
import {
  ApiErrorLike,
  isOverlapConflict,
  resolveAppointmentError,
} from '../../core/api/appointment-errors';
import { AppUserDto } from '../../core/api/models/user.model';
import { NotificationService, ConfirmService } from '../../core/ui';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { ScheduleAvailabilityService } from '../../core/api/services/schedule-availability.service';

interface PatientOption {
  label: string;
  value: string;
  assignedNutritionistId?: string | null;
}

interface NutritionistOption {
  label: string;
  value: string;
}

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
    TuiChevron,
    TuiCheckbox,
    TuiInput,
    TuiSelect
  ],
  templateUrl: './appointment-form.dialog.html',
  styleUrls: ['./appointment-form.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppointmentFormDialog implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentService = inject(AppointmentService);
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly confirm = inject(ConfirmService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly scheduleAvailability = inject(ScheduleAvailabilityService);

  private readonly searchSubject = new Subject<string>();

  readonly context = injectContext<TuiDialogContext<boolean, { nutritionistId?: string; startTime?: Date; patientId?: string; patientLabel?: string }>>();

  /**
   * Only staff may decide to schedule appointments in parallel. The backend
   * gates the flag by `MANAGE_APPOINTMENTS`; we also accept `STAFF` as a
   * fallback so the dialog still shows if the permission list is incomplete.
   */
  canManageAppointments = computed(() =>
    this.permissionsService.has('MANAGE_APPOINTMENTS') || this.authService.user()?.userType === 'STAFF'
  );

  patients = signal<PatientOption[]>([]);
  appointmentTypes = signal<{ label: string; value: string }[]>([]);
  nutritionists = signal<NutritionistOption[]>([]);
  patientsLoading = signal(false);
  saving = signal(false);
  error = signal('');

  selectedPatientRef = signal<PatientOption | null>(null);

  scheduleInfo = signal<string | null>(null);
  isHolidayDate = signal(false);
  isClosedDate = signal(false);
  availabilityLoaded = signal(false);

  patientLabels = computed(() => this.patients().map(p => p.label));
  typeLabels = computed(() => this.appointmentTypes().map(t => t.label));

  patientValues = computed(() => this.patients().map(p => p.value));
  patientStringify = (value: string): string => value;

  typeValues = computed(() => this.appointmentTypes().map(t => t.value));
  typeStringify = (value: string): string => value;

  nutritionistValues = computed(() => this.nutritionists().map(n => n.value));
  nutritionistStringify = (value: string): string =>
    this.nutritionists().find(n => n.value === value)?.label ?? value;

  isFirstConsultation = signal(false);

  form = this.fb.group({
    patientId: [''],
    isFirstConsultation: [false],
    newPatientName: [''],
    nutritionistId: ['', Validators.required],
    typeId: ['', Validators.required],
    date: [null as TuiDay | null, Validators.required],
    time: [null as TuiTime | null, Validators.required],
    notes: ['']
  });

  ngOnInit() {
    this.loadPatients('');
    this.loadAppointmentTypes();
    this.loadNutritionists();

    // Default nutritionist: the one passed in (current user for agenda), or
    // the patient's titular once a patient is picked.
    this.form.get('nutritionistId')?.setValue(this.context.data?.nutritionistId || this.authService.user()?.id || '');

    // Prefill the patient when the dialog is opened from the patient's cartera.
    if (this.context.data?.patientId && this.context.data?.patientLabel) {
      const option: PatientOption = {
        label: this.context.data.patientLabel,
        value: this.context.data.patientId
      };
      this.patients.update(list =>
        list.some(p => p.value === option.value) ? list : [option, ...list]
      );
      this.form.get('patientId')?.setValue(option.label);
    }

    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.fetchPatients(term))
      )
      .subscribe((users) => {
        this.patients.set(this.mergePrefilled(users));
        this.patientsLoading.set(false);
      });

    this.scheduleAvailability.load().subscribe(() => {
      this.availabilityLoaded.set(true);
      this.updateScheduleInfo();
    });

    // Subscribe to date changes to update schedule info
    this.form.get('date')?.valueChanges.subscribe(() => {
      this.updateScheduleInfo();
    });

    this.form.get('isFirstConsultation')?.valueChanges.subscribe((checked) => {
      this.isFirstConsultation.set(!!checked);
      const patientControl = this.form.get('patientId');
      
      if (checked) {
        // First consultation: patientId is not required
        patientControl?.clearValidators();
        patientControl?.setValue('');
      } else {
        // Regular appointment: patientId is required
        patientControl?.setValidators([Validators.required]);
      }
      
      patientControl?.updateValueAndValidity();
      
      if (!checked) {
        this.form.get('newPatientName')?.setValue('');
      }
    });

    // Subscribe to patientId changes to track the selected patient object
    this.form.get('patientId')?.valueChanges.subscribe((value) => {
      if (!value) {
        this.selectedPatientRef.set(null);
        return;
      }
      const current = this.selectedPatientRef();
      if (current && current.label !== value) {
        // User edited the text without selecting from dropdown, invalidate
        this.selectedPatientRef.set(null);
      }
      const match = this.patients().find(p => p.label === value);
      if (match) {
        this.selectedPatientRef.set(match);
        // Preselect the patient's titular nutritionist (V45); staff can still
        // override it to cover a substitution.
        this.form.get('nutritionistId')?.setValue(
          match.assignedNutritionistId || this.context.data?.nutritionistId || this.authService.user()?.id || ''
        );
      }
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

  ngOnDestroy() {
    this.searchSubject.complete();
  }

  onPatientSearch(value: string) {
    this.patientsLoading.set(true);
    this.searchSubject.next(value || '');
  }

  private fetchPatients(term: string): Observable<PatientOption[]> {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of([]);
    return this.userRoleService
      .getUsersByTenantAndType(tenantId, 'PATIENT', { search: term || undefined, size: 50 })
      .pipe(
        map((users) =>
          (users.content || []).map((u: AppUserDto) => ({
            label: `${u.firstName} ${u.lastName}`,
            value: u.id,
            assignedNutritionistId: u.assignedNutritionistId ?? null
          }))
        )
      );
  }

  private loadNutritionists() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.userRoleService
      .getUsersByTenantAndType(tenantId, 'STAFF', { size: 100 })
      .subscribe({
        next: (res) => {
          const options = (res.content || [])
            .map((u) => ({
              label: `${u.firstName} ${u.lastName}`.trim(),
              value: u.id
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
          this.nutritionists.set(options);
        }
      });
  }

  private loadPatients(term: string) {
    this.fetchPatients(term).subscribe((users) => this.patients.set(this.mergePrefilled(users)));
  }

  /** Keeps the patient passed in via the dialog data visible even if a later search drops it. */
  private mergePrefilled(users: PatientOption[]): PatientOption[] {
    const data = this.context.data;
    if (!data?.patientId || !data?.patientLabel) return users;

    const prefilled: PatientOption = { label: data.patientLabel, value: data.patientId };
    return users.some(u => u.value === prefilled.value) ? users : [prefilled, ...users];
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

    const selectedPatient = this.selectedPatientRef();
    const selectedType = this.appointmentTypes().find(t => t.label === raw.typeId);

    if (!selectedType) {
      this.error.set('Por favor, selecciona un tipo válido de la lista.');
      return;
    }

    const isFirstConsultation = !!raw.isFirstConsultation;
    const newPatientName = (raw.newPatientName || '').trim();

    if (isFirstConsultation && !newPatientName) {
      this.error.set(this.transloco.translate('appointments.new_patient_name_required'));
      return;
    }

    // Validate patient is selected when not a first consultation
    if (!isFirstConsultation && !selectedPatient) {
      this.error.set(this.transloco.translate('appointments.patient_required'));
      return;
    }

    const nutritionistId = raw.nutritionistId || undefined;
    if (!nutritionistId) {
      this.error.set(this.transloco.translate('appointments.nutritionist_required'));
      return;
    }

    // Convert date and time to ISO string for API
    const startDate = day.toLocalNativeDate();
    startDate.setHours(time.hours, time.minutes, 0, 0);

    const request: CreateAppointmentRequest = {
      nutritionistId,
      typeId: selectedType.value,
      startTime: startDate.toISOString(),
      notes: raw.notes || undefined
    };
    if (isFirstConsultation) {
      request.patientName = newPatientName;
    } else if (selectedPatient?.value) {
      request.patientId = selectedPatient.value;
    }

    this.executeCreate(tenantId, request);
  }

  /**
   * Creates the appointment. When it clashes with another one of the same
   * nutritionist, staff can confirm and retry once with `allowOverlap: true`.
   * Patients never see this option (backend ignores the flag for them).
   */
  private executeCreate(tenantId: string, request: CreateAppointmentRequest, allowOverlap = false): void {
    this.saving.set(true);
    this.error.set('');

    const payload: CreateAppointmentRequest = allowOverlap ? { ...request, allowOverlap: true } : request;

    this.appointmentService.create(tenantId, payload).subscribe({
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

        if (allowOverlap || !isOverlapConflict(err) || !this.canManageAppointments()) {
          this.error.set(this.resolveCreateError(err));
          return;
        }

        this.confirm.confirm({
          label: this.transloco.translate('appointments.overlap_confirm_title'),
          content: this.transloco.translate('appointments.overlap_confirm'),
          yes: this.transloco.translate('appointments.overlap_confirm_yes'),
          no: this.transloco.translate('common.cancel'),
        }).subscribe((confirmed) => {
          if (confirmed) {
            this.executeCreate(tenantId, request, true);
          } else {
            this.error.set(this.resolveCreateError(err));
          }
        });
      }
    });
  }

  /**
   * Cualquier `409` es un dead-end salvo el solape, que se ofrece resolver
   * agendando en paralelo (la clasificación vive en `appointment-errors.ts`
   * para que el widget del panel y este diálogo no puedan divergir).
   */
  private resolveCreateError(err: ApiErrorLike | null | undefined): string {
    return resolveAppointmentError(err, 'appointments.create_error', (key) =>
      this.transloco.translate(key)
    );
  }
}
