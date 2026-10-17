import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton, TuiCalendar, TuiDropdown, TuiInput, TuiLabel, TuiTextfield } from '@taiga-ui/core';
import { TuiAvatar, TuiChip, TuiInputDate } from '@taiga-ui/kit';
import { TuiDay } from '@taiga-ui/cdk';
import { Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, of, switchMap } from 'rxjs';

import { AppointmentService } from '../../../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../../../core/api/services/appointment-type.api';
import { ScheduleAvailabilityService } from '../../../../core/api/services/schedule-availability.service';
import { CalendarNoteService } from '../../../../core/api/services/calendar-note.api';
import { CalendarNoteDto } from '../../../../core/api/models/calendar-note.model';
import { PermissionsService } from '../../../../core/permissions/permissions.service';
import { UserTenantRoleService } from '../../../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppointmentTypeDto } from '../../../../core/api/models/appointment-type.model';
import {
  AppointmentDto,
  CreateAppointmentRequest,
  RescheduleAppointmentRequest,
} from '../../../../core/api/models/appointment.model';
import { AppUserDto } from '../../../../core/api/models/user.model';
import {
  ApiErrorLike,
  isOverlapConflict,
  resolveAppointmentError,
} from '../../../../core/api/appointment-errors';
import { ConfirmService, NotificationService } from '../../../../core/ui';

/** Opción de paciente del buscador. */
interface PatientRow {
  id: string;
  label: string;
  email: string;
  initials: string;
}

/** Chip de día del agendado rápido. */
interface DayChip {
  iso: string;
  dayNumber: number;
  label: string;
  disabled: boolean;
}

/** Resumen mostrado tras agendar. */
interface ScheduledSummary {
  patient: string;
  type: string;
  date: string;
  time: string;
}

/**
 * Agendado rápido del panel del profesional (prototipo
 * `design/dashboard-nutricionista.html`, columna derecha).
 *
 * Reutiliza las reglas reales del centro: jornada de
 * `ScheduleAvailabilityService`, festivos, citas ya ocupadas del profesional y
 * la duración de cada tipo de cita. La creación reutiliza el mismo contrato que
 * el diálogo de citas, incluido el 409 por solape (confirmar y reintentar con
 * `allowOverlap`).
 *
 * Con `rescheduleAppointment` el widget cambia a **modo reagendar**: el paciente
 * y el tipo ya los fija la cita, solo se elige día y hora, y al confirmar se
 * manda el mismo `PATCH` de siempre en vez de crear una cita nueva. Así el
 * paciente elige entre horas reales libres en lugar de escribir una hora a
 * ciegas.
 */
@Component({
  selector: 'app-quick-schedule',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslocoDirective,
    TuiAvatar,
    TuiButton,
    TuiCalendar,
    TuiChip,
    TuiDropdown,
    TuiInput,
    TuiInputDate,
    TuiLabel,
    TuiTextfield,
  ],
  templateUrl: './quick-schedule-widget.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickScheduleWidget implements OnInit, OnDestroy {
  /** Emite tras crear una cita para que el panel refresque "Tu día". */
  readonly scheduled = output<void>();

  /** Paciente que ya viene elegido al abrir el agendado desde su ficha. */
  readonly prefilledPatient = input<{ id: string; label: string; email?: string } | null>(null);
  /** Profesional para el que se agenda. Por defecto, el usuario conectado. */
  readonly nutritionistId = input<string | null>(null);
  /** Tarjeta del panel. Se desactiva al incrustar el widget en un diálogo. */
  readonly bordered = input(true);
  /** Título propio del widget. Se oculta cuando el diálogo ya lo titula. */
  readonly showTitle = input(true);
  /**
   * Cita que se está reagendando. Al recibirla el widget deja de crear citas y
   * pasa a mover esta: paciente y tipo quedan fijos y solo se elige el hueco.
   */
  readonly rescheduleAppointment = input<AppointmentDto | null>(null);

  private readonly tenantCtx = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly typeService = inject(AppointmentTypeService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly availability = inject(ScheduleAvailabilityService);
  private readonly calendarNoteService = inject(CalendarNoteService);
  private readonly permissions = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  private readonly search$ = new Subject<string>();

  /** Rejilla de inicio de cita, igual que el prototipo. */
  private readonly STEP_MINUTES = 15;
  /** No se ofrecen huecos que empiezan de inmediato. */
  private readonly BUFFER_MINUTES = 10;

  readonly today = TuiDay.currentLocal();

  readonly loading = signal(true);
  readonly loadingSlots = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly days = signal<DayChip[]>([]);
  readonly selectedDate = signal(toIsoDate(new Date()));
  readonly customDay = signal<TuiDay | null>(null);

  readonly types = signal<AppointmentTypeDto[]>([]);
  readonly selectedTypeId = signal('');

  readonly patientQuery = signal('');
  readonly patientResults = signal<PatientRow[]>([]);
  readonly searchingPatients = signal(false);
  readonly selectedPatient = signal<PatientRow | null>(null);

  readonly slots = signal<number[]>([]);
  readonly selectedSlot = signal<number | null>(null);
  /** `holiday` | `closed` | `none-left` | `null` cuando hay huecos. */
  readonly emptyReason = signal<'holiday' | 'closed' | 'none-left' | null>(null);

  readonly done = signal<ScheduledSummary | null>(null);

  readonly selectedType = computed(() =>
    this.types().find((type) => type.id === this.selectedTypeId()) ?? null
  );

  /** Modo reagendar: hay una cita que mover en vez de una que crear. */
  readonly isReschedule = computed(() => !!this.rescheduleAppointment());

  /**
   * Al reagendar, el paciente no decide el cambio: su propuesta vuelve a
   * `PROPOSED` y la confirma el centro. Solo quien gestiona citas la mueve en
   * firme.
   */
  readonly needsApproval = computed(
    () => this.isReschedule() && !this.permissions.has('MANAGE_APPOINTMENTS')
  );

  /**
   * Duración del hueco a buscar. Si el tipo de la cita ya no está activo (o aún
   * no han cargado los tipos) se respeta la duración que la cita tiene ahora.
   */
  readonly duration = computed(() => {
    const type = this.selectedType();
    if (type) return type.durationMinutes;

    const current = this.rescheduleAppointment();
    if (current?.startTime && current?.endTime) {
      const minutes = Math.round(
        (new Date(current.endTime).getTime() - new Date(current.startTime).getTime()) / 60_000
      );
      if (minutes > 0) return minutes;
    }

    return 30;
  });

  readonly canSubmit = computed(() => {
    if (this.selectedSlot() === null) return false;
    // Reagendando, paciente y tipo vienen dados por la propia cita.
    if (this.isReschedule()) return true;
    return !!this.selectedPatient() && !!this.selectedType();
  });

  /** Fecha seleccionada en formato largo para el resumen y la confirmación. */
  readonly selectedDateLong = computed(() =>
    new Date(`${this.selectedDate()}T00:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  );

  /** Día y hora que la cita tiene ahora, para enmarcar el reagendado. */
  readonly currentAppointmentWhen = computed(() => {
    const current = this.rescheduleAppointment();
    if (!current?.startTime) return '';

    const date = new Date(current.startTime);
    if (Number.isNaN(date.getTime())) return '';

    const day = date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const time = date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${day} · ${time}`;
  });

  readonly formattedSlot = computed(() => {
    const slot = this.selectedSlot();
    return slot === null ? '' : minutesToHHMM(slot);
  });

  /**
   * Profesional para el que se agendan los huecos: el de la cita que se
   * reagenda (no se transfiere a otro), el indicado por la ficha, o el usuario
   * conectado (comportamiento del panel principal).
   */
  private readonly effectiveNutritionistId = computed(
    () =>
      this.rescheduleAppointment()?.nutritionistId ||
      this.nutritionistId() ||
      this.auth.user()?.id ||
      ''
  );

  ngOnInit(): void {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.fetchPatients(term))
      )
      .subscribe((rows) => {
        this.patientResults.set(rows);
        this.searchingPatients.set(false);
      });

    this.loadTypes();
    this.applyPrefilledPatient();
    this.applyRescheduleDefaults();

    this.availability.load().subscribe(() => {
      this.buildDays();
      this.applyRescheduleDay();
      this.loading.set(false);
      this.refreshSlots();
    });
  }

  ngOnDestroy(): void {
    this.search$.complete();
  }

  // ── Día ────────────────────────────────────────────────────────────────

  private buildDays(): void {
    const base = new Date();
    const todayLabel = this.transloco.translate('tenant_dashboard.today_short');
    const chips: DayChip[] = [];

    for (let offset = 0; offset < 7; offset++) {
      const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
      const iso = toIsoDate(date);
      chips.push({
        iso,
        dayNumber: date.getDate(),
        label: offset === 0 ? todayLabel : shortWeekday(date),
        disabled: !this.isOpenDay(iso),
      });
    }

    this.days.set(chips);
  }

  /** Un día es hábil si no es festivo y el centro tiene jornada ese día. */
  private isOpenDay(iso: string): boolean {
    if (this.availability.isHolidayCached(iso)) return false;
    const schedule = this.availability.getScheduleForDate(iso);
    return !!schedule && schedule.details.length > 0;
  }

  pickDay(iso: string): void {
    if (this.selectedDate() === iso) return;
    this.selectedDate.set(iso);
    this.customDay.set(null);
    this.selectedSlot.set(null);
    this.refreshSlots();
  }

  pickCustomDay(day: TuiDay | null): void {
    this.customDay.set(day);
    if (!day) return;
    this.selectedDate.set(toIsoDate(day.toLocalNativeDate()));
    this.selectedSlot.set(null);
    this.refreshSlots();
  }

  // ── Tipo de cita ───────────────────────────────────────────────────────

  private loadTypes(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.typeService.getAll(tenantId).subscribe({
      next: (types) => {
        const active = (types || []).filter((type) => type.isActive !== false);
        this.types.set(active);

        // Reagendando no se cambia el tipo: manda el que ya tiene la cita.
        const current = this.rescheduleAppointment();
        const preferred = current
          ? active.find((type) => type.id === current.typeId)
          : active.find((type) => type.isDefault) ?? active[0];

        if (preferred) this.selectedTypeId.set(preferred.id);

        // Los tipos llegan por su cuenta: si los huecos ya se calcularon con
        // la duración por defecto, hay que rehacerlos con la real.
        if (!this.loading()) this.refreshSlots();
      },
    });
  }

  pickType(id: string): void {
    if (this.selectedTypeId() === id) return;
    this.selectedTypeId.set(id);
    this.selectedSlot.set(null);
    this.refreshSlots();
  }

  // ── Paciente ───────────────────────────────────────────────────────────

  onPatientQuery(value: string): void {
    this.patientQuery.set(value);
    const term = value.trim();
    if (!term) {
      this.patientResults.set([]);
      return;
    }
    this.searchingPatients.set(true);
    this.search$.next(term);
  }

  private fetchPatients(term: string) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of<PatientRow[]>([]);

    return this.userRoleService
      .getUsersByTenantAndType(tenantId, 'PATIENT', { search: term, size: 6 })
      .pipe(
        switchMap((res) =>
          of(
            (res.content || []).map((user: AppUserDto) => ({
              id: user.id,
              label: `${user.firstName} ${user.lastName}`.trim(),
              email: user.email ?? '',
              initials: initialsOf(user.firstName, user.lastName),
            }))
          )
        )
      );
  }

  pickPatient(patient: PatientRow): void {
    this.selectedPatient.set(patient);
    this.patientResults.set([]);
    this.patientQuery.set('');
    this.error.set('');
  }

  clearPatient(): void {
    this.selectedPatient.set(null);
    this.patientQuery.set('');
    this.patientResults.set([]);
  }

  // ── Huecos libres ──────────────────────────────────────────────────────

  private refreshSlots(): void {
    const iso = this.selectedDate();
    const tenantId = this.tenantCtx.currentTenantId();
    const nutritionistId = this.effectiveNutritionistId();

    this.selectedSlot.set(null);

    if (!tenantId || !nutritionistId) {
      this.slots.set([]);
      return;
    }

    if (this.availability.isHolidayCached(iso)) {
      this.slots.set([]);
      this.emptyReason.set('holiday');
      return;
    }

    const schedule = this.availability.getScheduleForDate(iso);
    if (!schedule || schedule.details.length === 0) {
      this.slots.set([]);
      this.emptyReason.set('closed');
      return;
    }

    this.loadingSlots.set(true);
    const from = new Date(`${iso}T00:00:00`).toISOString();
    const to = new Date(`${iso}T23:59:59`).toISOString();

    /*
     * Los bloqueos son privados de su autor: solo se pueden descontar cuando se
     * agenda para uno mismo. Al agendar para otro profesional sus bloqueos son
     * invisibles y el choque solo puede salir como `409` del backend — no hay
     * endpoint que permita consultarlos, ni siquiera siendo administrador.
     */
    const ownCalendar = nutritionistId === this.auth.user()?.id;
    const timeBlocks$ =
      ownCalendar && this.permissions.has('VIEW_CALENDAR_NOTES')
        ? this.calendarNoteService.list(tenantId, from, to, 'TIME_BLOCK')
        : of<CalendarNoteDto[]>([]);

    forkJoin({
      appointments: this.appointmentService.getByNutritionist(tenantId, nutritionistId, from, to),
      // Un fallo al traer los bloqueos no puede dejar sin huecos la pantalla:
      // se degrada a la lista de antes y el backend sigue siendo la red final.
      timeBlocks: timeBlocks$.pipe(catchError(() => of<CalendarNoteDto[]>([]))),
    }).subscribe({
      next: ({ appointments, timeBlocks }) => {
        this.loadingSlots.set(false);
        // Una cita no choca consigo misma: el backend la excluye al reagendar,
        // así que su hueco actual se sigue ofreciendo.
        const rescheduleId = this.rescheduleAppointment()?.id;
        const busy = (appointments || []).filter((appointment) => appointment.id !== rescheduleId);
        const slots = this.computeSlots(
          iso,
          schedule.details,
          busy,
          this.duration(),
          timeBlocks || []
        );
        this.slots.set(slots);
        this.emptyReason.set(slots.length ? null : 'none-left');
      },
      error: () => {
        this.loadingSlots.set(false);
        this.slots.set([]);
        this.emptyReason.set('none-left');
      },
    });
  }

  /**
   * Cruza la jornada del centro con lo que ya ocupa la agenda —citas y
   * bloqueos propios— y devuelve las horas de inicio posibles (en minutos
   * desde medianoche), en pasos de 15 min.
   *
   * Descontar los bloqueos es imprescindible: el backend los comprueba al
   * crear la cita, así que ofrecer un hueco bloqueado sería ofrecer algo que
   * va a fallar con un `409` justo después.
   */
  private computeSlots(
    iso: string,
    details: { startTime: string; endTime: string }[],
    appointments: AppointmentDto[],
    duration: number,
    timeBlocks: CalendarNoteDto[] = []
  ): number[] {
    const busy: [number, number][] = appointments
      .filter((appointment) => appointment.status !== 'CANCELLED')
      .map((appointment) => [
        instantToMinutes(appointment.startTime),
        appointment.endTime
          ? instantToMinutes(appointment.endTime)
          : instantToMinutes(appointment.startTime) + 30,
      ]);

    busy.push(...blocksToDayRanges(timeBlocks, iso));

    const now = new Date();
    const isToday = iso === toIsoDate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const out: number[] = [];

    for (const detail of details) {
      const from = hhmmToMinutes(detail.startTime);
      const to = hhmmToMinutes(detail.endTime);
      if (Number.isNaN(from) || Number.isNaN(to)) continue;

      for (let start = from; start + duration <= to; start += this.STEP_MINUTES) {
        if (isToday && start < nowMinutes + this.BUFFER_MINUTES) continue;
        const end = start + duration;
        if (busy.some(([busyStart, busyEnd]) => start < busyEnd && end > busyStart)) continue;
        if (!out.includes(start)) out.push(start);
      }
    }

    return out.sort((a, b) => a - b);
  }

  pickSlot(slot: number): void {
    this.selectedSlot.set(this.selectedSlot() === slot ? null : slot);
    this.error.set('');
  }

  formatSlot(slot: number): string {
    return minutesToHHMM(slot);
  }

  // ── Creación ───────────────────────────────────────────────────────────

  submit(): void {
    if (this.isReschedule()) {
      this.submitReschedule();
      return;
    }

    const patient = this.selectedPatient();
    const type = this.selectedType();
    const slot = this.selectedSlot();
    const tenantId = this.tenantCtx.currentTenantId();
    const nutritionistId = this.effectiveNutritionistId();

    if (!patient || !type || slot === null || !tenantId || !nutritionistId) return;

    const start = this.slotStart(slot);

    const request: CreateAppointmentRequest = {
      nutritionistId,
      patientId: patient.id,
      typeId: type.id,
      startTime: start.toISOString(),
    };

    const summary: ScheduledSummary = {
      patient: patient.label,
      type: type.name,
      date: this.selectedDateLong(),
      time: minutesToHHMM(slot),
    };

    this.create(tenantId, request, false, summary);
  }

  /** Hora elegida (minutos desde medianoche) sobre el día seleccionado. */
  private slotStart(slot: number): Date {
    const start = new Date(`${this.selectedDate()}T00:00:00`);
    start.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
    return start;
  }

  // ── Reagendado ─────────────────────────────────────────────────────────

  /**
   * Mueve la cita al hueco elegido con el mismo `PATCH` que el diálogo de
   * reagendar: solo cambia el inicio, el tipo se manda tal cual para que el
   * backend recalcule el fin con su duración.
   */
  private submitReschedule(): void {
    const current = this.rescheduleAppointment();
    const slot = this.selectedSlot();
    const tenantId = this.tenantCtx.currentTenantId();

    if (!current || slot === null || !tenantId) return;

    const request: RescheduleAppointmentRequest = {
      startTime: this.slotStart(slot).toISOString(),
    };
    if (current.typeId) request.typeId = current.typeId;

    this.reschedule(tenantId, current.id, request, false);
  }

  private reschedule(
    tenantId: string,
    appointmentId: string,
    request: RescheduleAppointmentRequest,
    allowOverlap: boolean
  ): void {
    this.saving.set(true);
    this.error.set('');

    const payload: RescheduleAppointmentRequest = allowOverlap
      ? { ...request, allowOverlap: true }
      : request;

    this.appointmentService.reschedule(tenantId, appointmentId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(
          this.transloco.translate('appointments.reschedule_success'),
          this.transloco.translate('common.success')
        );
        // Sin pantalla de "agendar otra": aquí solo había una cita que mover,
        // y quien abre el widget (el diálogo) se cierra con este aviso.
        this.scheduled.emit();
      },
      error: (err) => {
        this.saving.set(false);

        // El solape solo lo puede forzar quien gestiona citas; al paciente el
        // backend le devuelve `409` aunque mande `allowOverlap`.
        if (
          allowOverlap ||
          !isOverlapConflict(err) ||
          !this.permissions.has('MANAGE_APPOINTMENTS')
        ) {
          this.error.set(this.resolveError(err, 'appointments.reschedule_error'));
          return;
        }

        this.confirm
          .confirm({
            label: this.transloco.translate('appointments.overlap_confirm_title'),
            content: this.transloco.translate('appointments.overlap_confirm'),
            yes: this.transloco.translate('appointments.overlap_confirm_yes'),
            no: this.transloco.translate('common.cancel'),
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              this.reschedule(tenantId, appointmentId, request, true);
            } else {
              this.error.set(this.resolveError(err, 'appointments.reschedule_error'));
            }
          });
      },
    });
  }

  private create(
    tenantId: string,
    request: CreateAppointmentRequest,
    allowOverlap: boolean,
    summary: ScheduledSummary
  ): void {
    this.saving.set(true);
    this.error.set('');

    const payload: CreateAppointmentRequest = allowOverlap
      ? { ...request, allowOverlap: true }
      : request;

    this.appointmentService.create(tenantId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(
          this.transloco.translate('appointments.create_success'),
          this.transloco.translate('common.success')
        );
        this.done.set(summary);
        this.clearPatient();
        this.selectedSlot.set(null);
        this.scheduled.emit();
      },
      error: (err) => {
        this.saving.set(false);

        if (allowOverlap || !isOverlapConflict(err)) {
          this.error.set(this.resolveError(err));
          return;
        }

        this.confirm
          .confirm({
            label: this.transloco.translate('appointments.overlap_confirm_title'),
            content: this.transloco.translate('appointments.overlap_confirm'),
            yes: this.transloco.translate('appointments.overlap_confirm_yes'),
            no: this.transloco.translate('common.cancel'),
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              this.create(tenantId, request, true, summary);
            } else {
              this.error.set(this.resolveError(err));
            }
          });
      },
    });
  }

  scheduleAnother(): void {
    this.done.set(null);
    this.error.set('');
    this.refreshSlots();
  }

  private resolveError(
    err: ApiErrorLike | null | undefined,
    fallbackKey = 'appointments.create_error'
  ): string {
    return resolveAppointmentError(err, fallbackKey, (key) => this.transloco.translate(key));
  }

  /**
   * Modo reagendar: el paciente es el de la cita y el día de partida es el que
   * tiene ahora, para que se vea de un vistazo qué más hay libre ese mismo día.
   */
  private applyRescheduleDefaults(): void {
    const current = this.rescheduleAppointment();
    if (!current) return;

    const label = (current.patientName || '').trim();
    const [first = '', last = ''] = label.split(/\s+/);
    if (current.patientId) {
      this.selectedPatient.set({
        id: current.patientId,
        label: label || current.patientId,
        email: '',
        initials: initialsOf(first, last),
      });
    }
  }

  /**
   * Coloca el calendario en el día que la cita tiene ahora. Va después de
   * `buildDays()` porque necesita saber si ese día ya está entre los chips.
   */
  private applyRescheduleDay(): void {
    const current = this.rescheduleAppointment();
    if (!current) return;

    const start = new Date(current.startTime);
    if (Number.isNaN(start.getTime())) return;

    const iso = toIsoDate(start);
    // Una cita ya pasada no sirve de punto de partida: se queda en hoy.
    if (iso < toIsoDate(new Date())) return;

    this.selectedDate.set(iso);
    // Fuera de la semana de chips, el día solo se ve en "otra fecha".
    if (!this.days().some((day) => day.iso === iso)) {
      this.customDay.set(TuiDay.fromLocalNativeDate(start));
    }
  }

  /** Preselecciona el paciente recibido por input (ficha del paciente). */
  private applyPrefilledPatient(): void {
    const pre = this.prefilledPatient();
    if (!pre?.id) return;
    const label = (pre.label || pre.email || '').trim();
    const [first = '', last = ''] = label.split(/\s+/);
    this.selectedPatient.set({
      id: pre.id,
      label: label || pre.id,
      email: pre.email ?? '',
      initials: initialsOf(first, last),
    });
  }
}

// ── Helpers de fecha/hora (local, sin dependencias) ─────────────────────

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function shortWeekday(date: Date): string {
  return date
    .toLocaleDateString('es-AR', { weekday: 'short' })
    .replace('.', '');
}

function hhmmToMinutes(value: string): number {
  const [hours, minutes] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function instantToMinutes(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Proyecta los bloqueos sobre el día `iso` como rangos en minutos desde la
 * medianoche local, recortados al propio día.
 *
 * Hace falta recortar porque un bloqueo puede abarcar varios días —unas
 * vacaciones, una ausencia de "todo el día"— y entonces sus minutos desde
 * medianoche no significan nada por sí solos.
 */
function blocksToDayRanges(blocks: CalendarNoteDto[], iso: string): [number, number][] {
  const dayStart = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(dayStart)) return [];
  const dayEnd = dayStart + MINUTES_PER_DAY * 60_000;

  const ranges: [number, number][] = [];
  for (const block of blocks) {
    if (block.type !== 'TIME_BLOCK') continue;
    const start = new Date(block.startTime).getTime();
    const end = new Date(block.endTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    // Intervalo semiabierto, igual que el backend: un bloqueo que acaba a las
    // 00:00 de este día no ocupa nada de este día.
    if (end <= dayStart || start >= dayEnd) continue;
    ranges.push([
      Math.max(0, Math.round((start - dayStart) / 60_000)),
      Math.min(MINUTES_PER_DAY, Math.round((end - dayStart) / 60_000)),
    ]);
  }
  return ranges;
}

function minutesToHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(
    2,
    '0'
  )}`;
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}
