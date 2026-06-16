import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentDto, AppointmentStatus } from '../../core/api/models/appointment.model';
import { AppointmentFormDialog } from './appointment-form.dialog';
import { AppointmentActionDialog } from './appointment-action.dialog';
import { formatInstant } from '../../shared/utils/date';

@Component({
  selector: 'app-appointments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, ButtonModule, TagModule, TooltipModule, FullCalendarModule, TranslocoDirective],
  providers: [DialogService, MessageService],
  templateUrl: './appointments.page.html',
  styleUrls: ['./appointments.page.scss'],
})
export default class AppointmentsPage implements OnInit {
  private tenantCtx = inject(TenantContextService);
  private authService = inject(AuthService);
  private appointmentService = inject(AppointmentService);
  private dialogService = inject(DialogService);
  private messageService = inject(MessageService);
  private transloco = inject(TranslocoService);

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

  calendarOptions: any = {};
  calendarEvents = signal<any[]>([]);

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
      dateClick: (info: any) => {
        this.handleDateClick(info);
      },
      eventClick: (info: any) => {
        this.handleEventClick(info);
      },
      datesSet: (info: any) => {
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
      NO_SHOW: '#f59e0b'
    };

    this.calendarEvents.set(
      (appointments || []).map(a => ({
        id: a.id,
        title: `${a.patientName}`,
        start: a.startTime,
        end: a.endTime,
        backgroundColor: colors[a.status] || '#3b82f6',
        borderColor: colors[a.status] || '#3b82f6',
        textColor: '#ffffff',
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

  private onDatesSet(info: any) {
    const start = info.start as Date;
    const end = info.end as Date;
    this.weekStart = start.toISOString();
    this.weekEnd = end.toISOString();
    this.loadWeekAppointments();
  }

  handleEventClick(info: any) {
    const props = info.event.extendedProps;
    const eventStart = info.event.start as Date;
    const isFuture = eventStart > new Date();

    if (props.status === 'SCHEDULED' && isFuture) {
      const appointment = this.findAppointment(info.event.id);
      if (appointment) {
        const ref = this.dialogService.open(AppointmentActionDialog, {
          header: `${appointment.patientName} — ${this.getStatusLabel(appointment.status)}`,
          width: '500px',
          modal: true,
          data: { appointment },
          breakpoints: { '960px': '75vw', '640px': '90vw' }
        });
        if (ref) {
          ref.onClose.subscribe((result) => {
            if (result) {
              this.loadTodayAppointments();
              this.loadWeekAppointments();
            }
          });
        }
      }
    } else {
      this.messageService.add({
        severity: 'info',
        summary: props.patientName,
        detail: `${props.typeName || 'Cita'} — ${this.getStatusLabel(props.status)}`,
        life: 4000
      });
    }
  }

  private findAppointment(id: string): AppointmentDto | undefined {
    return this.weekAppointments().find(a => a.id === id)
      || this.todayAppointments().find(a => a.id === id);
  }

  handleDateClick(info: any) {
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
    this.appointmentService.updateStatus(tenantId, appointmentId, { status: status as any }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.transloco.translate('common.success'),
          detail: this.transloco.translate('appointments.update_success')
        });
        this.loadTodayAppointments();
        this.loadWeekAppointments();
        this.updatingStatus.set(null);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: this.transloco.translate('appointments.update_error')
        });
        this.updatingStatus.set(null);
      }
    });
  }

  showNewAppointmentDialog(prefilledDate?: Date) {
    const ref = this.dialogService.open(AppointmentFormDialog, {
      header: this.transloco.translate('appointments.schedule_new'),
      width: '500px',
      modal: true,
      data: { nutritionistId: this.currentUserId(), startTime: prefilledDate },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.loadTodayAppointments();
          this.loadWeekAppointments();
        }
      });
    }
  }

  getStatusLabel(status: string): string {
    const key = `appointments.status_${status.toLowerCase()}`;
    return this.transloco.translate(key);
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'secondary' | 'contrast' {
    switch (status) {
      case 'SCHEDULED': return 'info';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'secondary';
      case 'NO_SHOW': return 'warn';
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
