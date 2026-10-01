import {Component, inject, signal, OnInit, AfterViewInit, OnDestroy, ViewChild, computed, ChangeDetectionStrategy} from '@angular/core';
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
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { CalendarOptions, EventSourceInput } from '@fullcalendar/core';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../core/api/services/appointment-type.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentDto, CreateAppointmentRequest } from '../../core/api/models/appointment.model';
import {
  ApiErrorLike,
  isOverlapConflict,
  resolveAppointmentError,
} from '../../core/api/appointment-errors';
import { AppUserDto } from '../../core/api/models/user.model';
import { NotificationService, ConfirmService } from '../../core/ui';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { ScheduleAvailabilityService } from '../../core/api/services/schedule-availability.service';
import { ACTIVE_HOURS_COLOR, statusColor } from '../../shared/utils/status-colors';
import { hexToRgba } from '../../shared/utils/chart-config';

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
    TuiSelect,
    FullCalendarModule
  ],
  templateUrl: './appointment-form.dialog.html',
  styleUrls: ['./appointment-form.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppointmentFormDialog implements OnInit, AfterViewInit, OnDestroy {
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

  isPatientContext = computed(() => !!this.context.data?.patientId);

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

  // ── Agenda del día (panel de la derecha) ─────────────────────────────────
  private calendarRef?: FullCalendarComponent;

  /**
   * El calendario se crea de forma diferida (sólo cuando `agendaReady()` pasa a
   * true). Al recibir la instancia se coloca en el día elegido, que es cuando
   * `getApi()` ya es seguro.
   */
  @ViewChild('agendaCalendar')
  set agendaCalendarRef(component: FullCalendarComponent | undefined) {
    this.calendarRef = component;
    if (component) {
      queueMicrotask(() => this.syncCalendarDate());
    }
  }

  /** Día y nutricionista del formulario, reflejados como señales para la vista. */
  agendaDate = signal<TuiDay | null>(null);
  agendaNutritionistId = signal('');
  agendaEvents = signal<EventSourceInput>([]);
  loadingAgenda = signal(false);

  /** El calendario sólo se pinta cuando hay día + nutricionista y horario cargado. */
  readonly agendaReady = computed(() =>
    this.availabilityLoaded() && !!this.agendaDate() && !!this.agendaNutritionistId()
  );

  protected readonly activeHoursDot = hexToRgba(ACTIVE_HOURS_COLOR, 0.6);

  /** Vista de un solo día, sin barra propia: manda el campo de fecha del formulario. */
  calendarOptions: CalendarOptions = {
    plugins: [timeGridPlugin, interactionPlugin],
    initialView: 'timeGridDay',
    headerToolbar: false,
    locales: [esLocale],
    locale: 'es',
    allDaySlot: false,
    slotEventOverlap: false,
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    firstDay: 1,
    height: 'auto',
    editable: false,
    selectable: false,
    nowIndicator: true,
    dateClick: (info: DateClickArg) => this.onAgendaSlotClick(info)
  };

  /** Hasta que la vista no está lista no se pinta/navega el calendario. */
  private viewReady = false;

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
      this.selectedPatientRef.set(option);
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
      if (this.viewReady) this.reloadDayAgenda();
    });

    // Subscribe to date changes to update schedule info
    this.form.get('date')?.valueChanges.subscribe(() => {
      this.updateScheduleInfo();
      if (this.viewReady) this.reloadDayAgenda();
    });

    // El panel de agenda sigue al nutricionista elegido.
    this.form.get('nutritionistId')?.valueChanges.subscribe(() => {
      if (this.viewReady) this.reloadDayAgenda();
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

  ngAfterViewInit() {
    // La vista ya existe: primer pintado de la agenda del día.
    this.viewReady = true;
    this.reloadDayAgenda();
  }

  // ── Agenda del día ───────────────────────────────────────────────────────

  /** Refresca el panel: navega al día elegido y recarga las citas del nutricionista. */
  private reloadDayAgenda(): void {
    const day = (this.form.get('date')?.value as TuiDay | null) ?? null;
    const nutritionistId = (this.form.get('nutritionistId')?.value as string) || '';
    this.agendaDate.set(day);
    this.agendaNutritionistId.set(nutritionistId);

    if (!day) {
      this.agendaEvents.set([]);
      return;
    }

    const nativeDay = day.toLocalNativeDate();
    this.syncCalendarDate();

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !nutritionistId) {
      this.agendaEvents.set(this.buildAgendaBackground(day));
      return;
    }

    const start = new Date(nativeDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(nativeDay);
    end.setHours(23, 59, 59, 999);

    this.loadingAgenda.set(true);
    this.appointmentService
      .getByNutritionist(tenantId, nutritionistId, start.toISOString(), end.toISOString())
      .subscribe({
        next: (res) => {
          this.agendaEvents.set(this.buildAgendaEvents(res || [], day));
          this.loadingAgenda.set(false);
        },
        error: () => {
          this.agendaEvents.set(this.buildAgendaBackground(day));
          this.loadingAgenda.set(false);
        }
      });
  }

  /** Clic en una franja del calendario: fija esa hora en el formulario. */
  private onAgendaSlotClick(info: DateClickArg): void {
    const day = this.agendaDate();
    if (!day) return;

    const dateStr = this.tuiDayToStr(day);
    if (this.scheduleAvailability.isHolidayCached(dateStr)) {
      this.notify.info(this.transloco.translate('appointments.holiday_closed_notice'));
      return;
    }

    const schedule = this.scheduleAvailability.getScheduleForDate(dateStr);
    if (!schedule) {
      this.notify.info(this.transloco.translate('appointments.day_closed_notice'));
      return;
    }

    const timeStr = `${String(info.date.getHours()).padStart(2, '0')}:${String(info.date.getMinutes()).padStart(2, '0')}`;
    const within = schedule.details.some(
      (d) => timeStr >= d.startTime.substring(0, 5) && timeStr < d.endTime.substring(0, 5)
    );
    if (!within) {
      this.notify.info(this.transloco.translate('appointments.outside_operating_hours'));
      return;
    }

    this.form.get('time')?.setValue(TuiTime.fromLocalNativeDate(info.date));
  }

  /** Coloca la vista del calendario en el día elegido, si ya existe la instancia. */
  private syncCalendarDate(): void {
    const day = this.agendaDate();
    if (!day) return;
    this.calendarRef?.getApi()?.gotoDate(day.toLocalNativeDate());
  }

  private buildAgendaEvents(appointments: AppointmentDto[], day: TuiDay): object[] {
    const events: object[] = this.buildAgendaBackground(day);

    appointments.forEach((a) => {
      events.push({
        id: a.id,
        title: a.patientName ?? this.transloco.translate('appointments.no_patient'),
        start: a.startTime,
        end: a.endTime,
        backgroundColor: statusColor(a.status) + '20',
        borderColor: statusColor(a.status),
        extendedProps: { status: a.status, typeName: a.typeName }
      });
    });

    return events;
  }

  /** Franjas de jornada activa (fondo verde tenue) para leer de un vistazo los huecos. */
  private buildAgendaBackground(day: TuiDay): object[] {
    const dateStr = this.tuiDayToStr(day);
    const schedule = this.scheduleAvailability.getScheduleForDate(dateStr);
    if (!schedule) return [];

    return schedule.details.map((detail) => ({
      start: `${dateStr}T${detail.startTime}`,
      end: `${dateStr}T${detail.endTime}`,
      display: 'background' as const,
      backgroundColor: hexToRgba(ACTIVE_HOURS_COLOR, 0.15)
    }));
  }

  private tuiDayToStr(day: TuiDay): string {
    return `${String(day.year).padStart(4, '0')}-${String(day.month + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
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
      .getUsersByTenantAndType(tenantId, 'PATIENT', {
        search: term || undefined,
        size: 50,
        // Solo pacientes activos en el desplegable de agendar.
        enabled: true
      })
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
          
          const current = this.form.get("nutritionistId")?.value;
          if (current) this.form.get("nutritionistId")?.setValue(current);
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
        const rawTypes = types || [];
          const mapped = rawTypes.map((t) => ({
            label: `${t.name} (${t.durationMinutes} min)`,
            value: t.id
          }));
          this.appointmentTypes.set(mapped);
          
          if (mapped.length > 0 && !this.form.get("typeId")?.value) {
            const defaultType = rawTypes.find(t => t.isDefault);
            const fallbackIndex = defaultType ? rawTypes.indexOf(defaultType) : 0;
            this.form.get("typeId")?.setValue(mapped[fallbackIndex].label);
          }
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
