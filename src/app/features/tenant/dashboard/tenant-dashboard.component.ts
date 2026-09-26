import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';

import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AppointmentService } from '../../../core/api/services/appointment.api';
import {
  AppointmentDto,
  AppointmentStatus,
  UpdateAppointmentStatusRequest,
} from '../../../core/api/models/appointment.model';
import { AppointmentFormDialog } from '../../appointments/appointment-form.dialog';
import { isPastInstant } from '../../../shared/utils/date';
import { ModalService, NotificationService } from '../../../core/ui';
import { PermissionsService } from '../../../core/permissions/permissions.service';
import { TuiButton } from '@taiga-ui/core';
import { EmptyState } from '../../../shared/ui/empty-state';

// Patient Dashboard Widgets
import { WaterIntakeWidget } from './components/water-intake-widget';
import { PatientNextAppointment } from './components/patient-next-appointment';
import { PatientTodayMeals } from './components/patient-today-meals';
import { PatientWeightChart } from './components/patient-weight-chart';
import { PatientShoppingList } from './components/patient-shopping-list';

// Staff Dashboard Widgets
import { QuickScheduleWidget } from './components/quick-schedule-widget';
import { PatientQuickSearch } from './components/patient-quick-search';

/**
 * Fila de "Tu día" ya resuelta para la plantilla. La marca de la hora actual
 * viaja como una fila más (`isNow`), así el `@for` no necesita discriminar
 * uniones de tipos.
 */
interface TimelineRow {
  key: string;
  isNow: boolean;
  appointment: AppointmentDto | null;
  time: string;
  duration: string;
  initials: string;
  typeName: string;
  statusLabelKey: string;
  dotClass: string;
  past: boolean;
  /** Agendada y ya pasada: admite marcar asistencia. */
  resolvable: boolean;
}

@Component({
  selector: 'app-tenant-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterModule,
    TranslocoDirective,
    WaterIntakeWidget,
    PatientNextAppointment,
    PatientTodayMeals,
    PatientWeightChart,
    PatientShoppingList,
    QuickScheduleWidget,
    PatientQuickSearch,
    SkeletonComponent,
    TuiButton,
    EmptyState,
  ],
  templateUrl: './tenant-dashboard.component.html',
})
export class TenantDashboardComponent implements OnInit, OnDestroy {
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  tenantName = computed(() => this.tenantCtx.currentMembership()?.tenantName || 'la clínica');
  isStaff = computed(() => this.tenantCtx.currentMembership()?.userType === 'STAFF');

  canViewAppointments = computed(() => this.tenantCtx.hasPermission('VIEW_APPOINTMENTS'));
  canViewPatients = computed(() => this.permissionsService.has('VIEW_USER'));
  currentUserId = computed(() => this.authService.user()?.id || '');

  todayAppointments = signal<AppointmentDto[]>([]);
  loadingToday = signal(false);
  updatingStatus = signal<string | null>(null);

  /** Reloj interno (1 min) para la línea de "ahora" y el saludo. */
  private readonly now = signal(Date.now());
  private timer?: ReturnType<typeof setInterval>;

  todayStart = '';
  todayEnd = '';

  // ── Cabecera ─────────────────────────────────────────────────────────

  readonly firstName = computed(() => this.authService.user()?.firstName ?? '');

  readonly greetingKey = computed(() => {
    const hour = new Date(this.now()).getHours();
    if (hour < 12) return 'tenant_dashboard.greeting_morning';
    if (hour < 20) return 'tenant_dashboard.greeting_afternoon';
    return 'tenant_dashboard.greeting_evening';
  });

  readonly todayLongLabel = computed(() =>
    capitalize(
      new Date(this.now()).toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    )
  );

  // ── Franja de estado ─────────────────────────────────────────────────

  readonly todayCount = computed(() => this.todayAppointments().length);

  readonly attendedCount = computed(
    () => this.todayAppointments().filter((a) => a.status === 'COMPLETED').length
  );

  readonly noShowCount = computed(
    () => this.todayAppointments().filter((a) => a.status === 'NO_SHOW').length
  );

  /** Citas del día ya resueltas (asistió o no asistió). */
  readonly resolvedCount = computed(() => this.attendedCount() + this.noShowCount());

  /** Tasa de asistencia sobre las citas ya resueltas; `null` si aún no hay. */
  readonly attendanceRate = computed(() => {
    const resolved = this.resolvedCount();
    return resolved === 0 ? null : Math.round((this.attendedCount() / resolved) * 100);
  });

  readonly dayRange = computed(() => {
    const list = this.todayAppointments().filter((a) => a.status !== 'CANCELLED');
    const starts = list
      .map((a) => new Date(a.startTime).getTime())
      .filter((time) => !Number.isNaN(time));
    const ends = list
      .map((a) => new Date(a.endTime).getTime())
      .filter((time) => !Number.isNaN(time));

    if (!starts.length) return null;
    return {
      from: formatTime(new Date(Math.min(...starts)).toISOString()),
      to: ends.length ? formatTime(new Date(Math.max(...ends)).toISOString()) : '',
    };
  });

  // ── "Tu día" ─────────────────────────────────────────────────────────

  readonly timeline = computed<TimelineRow[]>(() => {
    const now = this.now();
    const list = [...this.todayAppointments()].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    const hasStarted = list.some((a) => new Date(a.startTime).getTime() <= now);
    const rows: TimelineRow[] = [];
    let inserted = false;

    const appointmentRow = (appointment: AppointmentDto): TimelineRow => ({
      key: appointment.id,
      isNow: false,
      appointment,
      time: formatTime(appointment.startTime),
      duration: durationLabel(appointment),
      initials: getInitials(appointment.patientName ?? ''),
      typeName: appointment.typeName ?? '',
      statusLabelKey: `tenant_dashboard.flag_${appointment.status.toLowerCase()}`,
      dotClass: statusDotClass(appointment.status),
      past: isPastInstant(appointment.startTime),
      resolvable:
        appointment.status === 'SCHEDULED' && isPastInstant(appointment.startTime),
    });

    for (const appointment of list) {
      if (!inserted && hasStarted && new Date(appointment.startTime).getTime() > now) {
        rows.push({
          key: 'now-line',
          isNow: true,
          appointment: null,
          time: '',
          duration: '',
          initials: '',
          typeName: '',
          statusLabelKey: '',
          dotClass: '',
          past: false,
          resolvable: false,
        });
        inserted = true;
      }
      rows.push(appointmentRow(appointment));
    }

    return rows;
  });

  readonly nowLabel = computed(() =>
    new Date(this.now()).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  );

  ngOnInit() {
    this.computeDateRanges();
    if (this.canViewAppointments() && this.currentUserId()) {
      this.loadTodayAppointments();
    }
    this.timer = setInterval(() => this.now.set(Date.now()), 60_000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private computeDateRanges() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    this.todayStart = startOfDay.toISOString();
    this.todayEnd = endOfDay.toISOString();
  }

  loadTodayAppointments() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingToday.set(true);
    this.appointmentService
      .getByNutritionist(tenantId, this.currentUserId(), this.todayStart, this.todayEnd)
      .subscribe({
        next: (res) => {
          this.todayAppointments.set(res || []);
          this.loadingToday.set(false);
        },
        error: () => this.loadingToday.set(false),
      });
  }

  markAttended(appointment: AppointmentDto) {
    this.updateStatus(appointment.id, 'COMPLETED');
  }

  markNoShow(appointment: AppointmentDto) {
    this.updateStatus(appointment.id, 'NO_SHOW');
  }

  private updateStatus(appointmentId: string, status: AppointmentStatus) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.updatingStatus.set(appointmentId);
    this.appointmentService
      .updateStatus(tenantId, appointmentId, {
        status: status as UpdateAppointmentStatusRequest['status'],
      })
      .subscribe({
        next: () => {
          this.notify.success(
            this.transloco.translate('appointments.update_success'),
            this.transloco.translate('common.success')
          );
          this.loadTodayAppointments();
          this.updatingStatus.set(null);
        },
        error: () => {
          this.notify.error(
            this.transloco.translate('appointments.update_error'),
            this.transloco.translate('common.error')
          );
          this.updatingStatus.set(null);
        },
      });
  }

  showNewAppointmentDialog(prefilledDate?: Date) {
    this.modal
      .open<boolean, { nutritionistId: string; startTime?: Date }>(AppointmentFormDialog, {
        label: this.transloco.translate('appointments.schedule_new'),
        size: 'm',
        data: { nutritionistId: this.currentUserId(), startTime: prefilledDate },
      })
      .subscribe((result) => {
        if (result) {
          this.loadTodayAppointments();
        }
      });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function durationLabel(appointment: AppointmentDto): string {
  const start = new Date(appointment.startTime).getTime();
  const end = new Date(appointment.endTime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '';
  return `${Math.round((end - start) / 60000)} min`;
}

function statusDotClass(status: AppointmentStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-ok';
    case 'NO_SHOW':
      return 'bg-err';
    case 'PROPOSED':
      return 'bg-warn';
    case 'CANCELLED':
      return 'bg-surface-300 dark:bg-surface-600';
    default:
      return 'bg-info';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
