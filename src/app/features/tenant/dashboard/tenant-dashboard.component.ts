import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { CalendarOptions, EventSourceInput, EventClickArg, DatesSetArg } from '@fullcalendar/core';
import { SkeletonComponent } from 'boneyard-js/angular';

import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AppointmentService } from '../../../core/api/services/appointment.api';
import { AppointmentDto, AppointmentStatus, UpdateAppointmentStatusRequest } from '../../../core/api/models/appointment.model';
import { AppointmentFormDialog } from '../../appointments/appointment-form.dialog';
import { AppointmentActionDialog } from '../../appointments/appointment-action.dialog';
import { formatInstant } from '../../../shared/utils/date';
import { ModalService, NotificationService, ConfirmService } from '../../../core/ui';

// Patient Dashboard Widgets
import { WaterIntakeWidget } from './components/water-intake-widget';
import { PatientNextAppointment } from './components/patient-next-appointment';
import { PatientTodayMeals } from './components/patient-today-meals';
import { PatientWeightChart } from './components/patient-weight-chart';

@Component({
  selector: 'app-tenant-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterModule,
    FullCalendarModule,
    TranslocoDirective,
    WaterIntakeWidget,
    PatientNextAppointment,
    PatientTodayMeals,
    PatientWeightChart,
    SkeletonComponent
  ],
  templateUrl: './tenant-dashboard.component.html',
  styleUrls: ['./tenant-dashboard.component.scss']
})
export class TenantDashboardComponent implements OnInit {
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  tenantName = computed(() => this.tenantCtx.currentMembership()?.tenantName || 'la clínica');

  canViewAppointments = computed(() => this.tenantCtx.hasPermission('VIEW_APPOINTMENTS'));
  currentUserId = computed(() => this.authService.user()?.id || '');

  todayAppointments = signal<AppointmentDto[]>([]);
  weekAppointments = signal<AppointmentDto[]>([]);
  loadingToday = signal(false);
  loadingWeek = signal(false);
  updatingStatus = signal<string | null>(null);

  todayStart = '';
  todayEnd = '';
  weekStart = '';
  weekEnd = '';

  protected readonly formatInstant = formatInstant;

  calendarOptions: CalendarOptions = {};
  calendarEvents = signal<EventSourceInput>([]);

  ngOnInit() {
    this.computeDateRanges();
    if (this.canViewAppointments() && this.currentUserId()) {
      this.loadTodayAppointments();
    }

    this.calendarOptions = {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'timeGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridWeek,timeGridDay'
      },
      locales: [esLocale],
      locale: 'es',
      allDaySlot: false,
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      height: 'auto',
      firstDay: 1,
      editable: false,
      selectable: false,
      dateClick: (info: DateClickArg) => {
        this.handleDateClick(info);
      },
      eventClick: (info: EventClickArg) => {
        this.handleEventClick(info);
      },
      datesSet: (info: DatesSetArg) => {
        this.onDatesSet(info);
      }
    };
  }

  private computeDateRanges() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    this.todayStart = startOfDay.toISOString();
    this.todayEnd = endOfDay.toISOString();

    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59);
    this.weekStart = startOfWeek.toISOString();
    this.weekEnd = endOfWeek.toISOString();
  }

  private loadTodayAppointments() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingToday.set(true);
    this.appointmentService.getByNutritionist(tenantId, this.currentUserId(), this.todayStart, this.todayEnd).subscribe({
      next: (res) => {
        this.todayAppointments.set(res || []);
        this.loadingToday.set(false);
      },
      error: () => this.loadingToday.set(false)
    });
  }

  private loadWeekAppointments() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.currentUserId();
    if (!tenantId || !userId || !this.weekStart || !this.weekEnd) return;
    this.loadingWeek.set(true);
    this.appointmentService.getByNutritionist(tenantId, userId, this.weekStart, this.weekEnd).subscribe({
      next: (res) => {
        this.weekAppointments.set(res || []);
        this.buildCalendarEvents(res || []);
        this.loadingWeek.set(false);
      },
      error: () => this.loadingWeek.set(false)
    });
  }

  private buildCalendarEvents(appointments: AppointmentDto[]) {
    const colors: Record<string, string> = {
      SCHEDULED: '#3b82f6',
      COMPLETED: '#10b981',
      CANCELLED: '#6b7280',
      NO_SHOW: '#f59e0b',
      PROPOSED: '#f97316'
    };

    this.calendarEvents.set(
      (appointments || []).map(a => ({
        id: a.id,
        title: `${a.patientName}`,
        start: a.startTime,
        end: a.endTime,
        backgroundColor: (colors[a.status] || '#3b82f6') + '20',
        borderColor: colors[a.status] || '#3b82f6',
        extendedProps: {
          status: a.status,
          patientName: a.patientName,
          patientId: a.patientId,
          typeName: a.typeName,
          notes: a.notes
        }
      }))
    );
  }

  private onDatesSet(info: DatesSetArg) {
    const start = info.start;
    const end = info.end;
    this.weekStart = start.toISOString();
    this.weekEnd = end.toISOString();
    this.loadWeekAppointments();
  }

  handleDateClick(info: DateClickArg) {
    if (info.date > new Date()) {
      this.showNewAppointmentDialog(info.date);
    }
  }

  handleEventClick(info: EventClickArg) {
    const props = info.event.extendedProps;
    const eventStart = info.event.start;
    const isFuture = eventStart ? eventStart > new Date() : false;

    if ((props['status'] === 'SCHEDULED' || props['status'] === 'PROPOSED') && isFuture) {
      const appointment = this.findAppointment(info.event.id);
      if (appointment) {
        this.modal.open<boolean, { appointment: AppointmentDto }>(
          AppointmentActionDialog,
          { label: `${appointment.patientName} — ${this.getStatusLabel(appointment.status)}`, size: 'm', data: { appointment } }
        ).subscribe((result) => {
          if (result) {
            this.loadTodayAppointments();
            this.loadWeekAppointments();
          }
        });
      }
    } else {
      this.notify.info(
        `${props['patientName'] as string}: ${(props['typeName'] as string) || 'Cita'} — ${this.getStatusLabel(props['status'] as string)}`
      );
    }
  }

  handleTodayAppointmentClick(appt: AppointmentDto) {
    const isFuture = new Date(appt.startTime) > new Date();

    if ((appt.status === 'SCHEDULED' || appt.status === 'PROPOSED') && isFuture) {
      this.modal.open<boolean, { appointment: AppointmentDto }>(
        AppointmentActionDialog,
        { label: `${appt.patientName} — ${this.getStatusLabel(appt.status)}`, size: 'm', data: { appointment: appt } }
      ).subscribe((result) => {
        if (result) {
          this.loadTodayAppointments();
          this.loadWeekAppointments();
        }
      });
     } else {
      this.notify.info(`${appt.patientName}: ${appt.typeName || 'Cita'} — ${this.getStatusLabel(appt.status)}`);
    }
  }

  private findAppointment(id: string): AppointmentDto | undefined {
    return this.weekAppointments().find(a => a.id === id)
      || this.todayAppointments().find(a => a.id === id);
  }

  attendanceRate = computed(() => {
    const today = this.todayAppointments();
    const total = today.filter(a => a.status !== 'CANCELLED').length;
    if (total === 0) return 0;
    const completed = today.filter(a => a.status === 'COMPLETED').length;
    return Math.round((completed / total) * 100);
  });

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
    this.appointmentService.updateStatus(tenantId, appointmentId, { status: status as UpdateAppointmentStatusRequest['status'] }).subscribe({
      next: () => {
        this.notify.success(this.transloco.translate('appointments.update_success'), this.transloco.translate('common.success'));
        this.loadTodayAppointments();
        this.loadWeekAppointments();
        this.updatingStatus.set(null);
      },
      error: () => {
        this.notify.error(this.transloco.translate('appointments.update_error'), this.transloco.translate('common.error'));
        this.updatingStatus.set(null);
      }
    });
  }

  showNewAppointmentDialog(prefilledDate?: Date) {
    this.modal.open<boolean, { nutritionistId: string; startTime?: Date }>(
      AppointmentFormDialog,
      { label: this.transloco.translate('appointments.schedule_new'), size: 'm', data: { nutritionistId: this.currentUserId(), startTime: prefilledDate } }
    ).subscribe((result) => {
      if (result) {
        this.loadTodayAppointments();
        this.loadWeekAppointments();
      }
    });
  }

  getStatusLabel(status: string): string {
    const key = `appointments.status_${status.toLowerCase()}`;
    return this.transloco.translate(key);
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'info';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'secondary';
      case 'NO_SHOW': return 'warning';
      case 'PROPOSED': return 'warning';
      default: return 'info';
    }
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
