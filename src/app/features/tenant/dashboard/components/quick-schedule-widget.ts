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
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { AppointmentService } from '../../../../core/api/services/appointment.api';
import { AppointmentTypeService } from '../../../../core/api/services/appointment-type.api';
import { ScheduleAvailabilityService } from '../../../../core/api/services/schedule-availability.service';
import { UserTenantRoleService } from '../../../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppointmentTypeDto } from '../../../../core/api/models/appointment-type.model';
import {
  AppointmentDto,
  CreateAppointmentRequest,
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

  private readonly tenantCtx = inject(TenantContextService);
  private readonly auth = inject(AuthService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly typeService = inject(AppointmentTypeService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly availability = inject(ScheduleAvailabilityService);
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

  readonly duration = computed(() => this.selectedType()?.durationMinutes ?? 30);

  readonly canSubmit = computed(
    () => !!this.selectedPatient() && !!this.selectedType() && this.selectedSlot() !== null
  );

  /** Fecha seleccionada en formato largo para el resumen y la confirmación. */
  readonly selectedDateLong = computed(() =>
    new Date(`${this.selectedDate()}T00:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  );

  readonly formattedSlot = computed(() => {
    const slot = this.selectedSlot();
    return slot === null ? '' : minutesToHHMM(slot);
  });

  /**
   * Profesional para el que se agendan los huecos: el indicado por la ficha, o
   * el usuario conectado (comportamiento del panel principal).
   */
  private readonly effectiveNutritionistId = computed(
    () => this.nutritionistId() || this.auth.user()?.id || ''
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

    this.availability.load().subscribe(() => {
      this.buildDays();
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
        const preferred = active.find((type) => type.isDefault) ?? active[0];
        if (preferred) this.selectedTypeId.set(preferred.id);
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

    this.appointmentService.getByNutritionist(tenantId, nutritionistId, from, to).subscribe({
      next: (appointments) => {
        this.loadingSlots.set(false);
        const slots = this.computeSlots(
          iso,
          schedule.details,
          appointments || [],
          this.duration()
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
   * Cruza la jornada del centro con las citas ya ocupadas y devuelve las horas
   * de inicio posibles (en minutos desde medianoche), en pasos de 15 min.
   */
  private computeSlots(
    iso: string,
    details: { startTime: string; endTime: string }[],
    appointments: AppointmentDto[],
    duration: number
  ): number[] {
    const busy: [number, number][] = appointments
      .filter((appointment) => appointment.status !== 'CANCELLED')
      .map((appointment) => [
        instantToMinutes(appointment.startTime),
        appointment.endTime
          ? instantToMinutes(appointment.endTime)
          : instantToMinutes(appointment.startTime) + 30,
      ]);

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
    const patient = this.selectedPatient();
    const type = this.selectedType();
    const slot = this.selectedSlot();
    const tenantId = this.tenantCtx.currentTenantId();
    const nutritionistId = this.effectiveNutritionistId();

    if (!patient || !type || slot === null || !tenantId || !nutritionistId) return;

    const [hours, minutes] = [Math.floor(slot / 60), slot % 60];
    const start = new Date(`${this.selectedDate()}T00:00:00`);
    start.setHours(hours, minutes, 0, 0);

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

  private resolveError(err: ApiErrorLike | null | undefined): string {
    return resolveAppointmentError(err, 'appointments.create_error', (key) =>
      this.transloco.translate(key)
    );
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

function minutesToHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(
    2,
    '0'
  )}`;
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}
