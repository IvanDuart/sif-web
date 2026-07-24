import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { CalendarOptions, EventSourceInput, EventClickArg, DatesSetArg } from '@fullcalendar/core';
import { SkeletonComponent } from 'boneyard-js/angular';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentDto, AppointmentStatus, UpdateAppointmentStatusRequest } from '../../core/api/models/appointment.model';
import { AppointmentFormDialog } from './appointment-form.dialog';
import { AppointmentActionDialog } from './appointment-action.dialog';
import { formatInstant } from '../../shared/utils/date';
import { ModalService, NotificationService } from '../../core/ui';

@Component({
  selector: 'app-appointments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterModule, FullCalendarModule, TranslocoDirective, SkeletonComponent],
  templateUrl: './appointments.page.html',
  styleUrls: ['./appointments.page.scss'],
})
export default class AppointmentsPage implements OnInit {
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

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

    this.route.queryParams.subscribe(params => {
      const dateParam = params['date'];
      if (dateParam) {
        setTimeout(() => {
          if (this.calendarComponent) {
            const api = this.calendarComponent.getApi();
            api.gotoDate(dateParam);
            api.changeView('timeGridDay');
          }
        }, 300);
      }
    });

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

  handleEventClick(info: EventClickArg | { event: { extendedProps: Record<string, unknown>; id?: string; start?: Date } }) {
    const props = info.event.extendedProps;
    const eventStart = info.event.start;
    const isFuture = eventStart ? eventStart > new Date() : false;

    if ((props['status'] === 'SCHEDULED' || props['status'] === 'PROPOSED') && isFuture) {
      const appointment = this.findAppointment(info.event.id as string);
      if (appointment) {
        this.modal.open<boolean, { appointment: AppointmentDto }>(
          AppointmentActionDialog,
          {
            label: `${appointment.patientName} — ${this.getStatusLabel(appointment.status)}`,
            size: 'm',
            data: { appointment }
          }
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

  private findAppointment(id: string): AppointmentDto | undefined {
    return this.weekAppointments().find(a => a.id === id)
      || this.todayAppointments().find(a => a.id === id);
  }

  handleDateClick(info: DateClickArg) {
    if (info.date > new Date()) {
      this.showNewAppointmentDialog(info.date);
    }
  }

  markAttended(appointment: AppointmentDto) {
    this.updateStatus(appointment.id, 'COMPLETED');
  }

  markNoShow(appointment: AppointmentDto) {
    this.updateStatus(appointment.id, 'NO_SHOW');
  }

  cancelAppointment(appointment: AppointmentDto) {
    this.updateStatus(appointment.id, 'CANCELLED');
  }

  private updateStatus(appointmentId: string, status: AppointmentStatus) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.updatingStatus.set(appointmentId);
    this.appointmentService.updateStatus(tenantId, appointmentId, { status: status as UpdateAppointmentStatusRequest['status'] }).subscribe({
      next: () => {
        this.notify.success(
          this.transloco.translate('appointments.update_success'),
          this.transloco.translate('common.success')
        );
        this.loadTodayAppointments();
        this.loadWeekAppointments();
        this.updatingStatus.set(null);
      },
      error: () => {
        this.notify.error(
          this.transloco.translate('appointments.update_error'),
          this.transloco.translate('common.error')
        );
        this.updatingStatus.set(null);
      }
    });
  }

  showNewAppointmentDialog(prefilledDate?: Date) {
    this.modal.open<boolean, { nutritionistId?: string; startTime?: Date }>(
      AppointmentFormDialog,
      {
        label: this.transloco.translate('appointments.schedule_new'),
        size: 'm',
        data: { nutritionistId: this.currentUserId(), startTime: prefilledDate }
      }
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
