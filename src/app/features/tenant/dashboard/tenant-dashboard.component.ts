import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';

import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AppointmentService } from '../../../core/api/services/appointment.api';
import { AppointmentDto, AppointmentStatus, UpdateAppointmentStatusRequest } from '../../../core/api/models/appointment.model';
import { AppointmentFormDialog } from '../../appointments/appointment-form.dialog';
import { formatInstant } from '../../../shared/utils/date';
import { ModalService, NotificationService, ConfirmService } from '../../../core/ui';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

// Patient Dashboard Widgets
import { WaterIntakeWidget } from './components/water-intake-widget';
import { PatientNextAppointment } from './components/patient-next-appointment';
import { PatientTodayMeals } from './components/patient-today-meals';
import { PatientWeightChart } from './components/patient-weight-chart';
import { PatientShoppingList } from './components/patient-shopping-list';

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
    SkeletonComponent,
    TuiButton,
    TuiBadge
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
  isStaff = computed(() => this.tenantCtx.currentMembership()?.userType === 'STAFF');

  canViewAppointments = computed(() => this.tenantCtx.hasPermission('VIEW_APPOINTMENTS'));
  currentUserId = computed(() => this.authService.user()?.id || '');

  todayAppointments = signal<AppointmentDto[]>([]);
  loadingToday = signal(false);
  updatingStatus = signal<string | null>(null);

  todayStart = '';
  todayEnd = '';

  protected readonly formatInstant = formatInstant;

  ngOnInit() {
    this.computeDateRanges();
    if (this.canViewAppointments() && this.currentUserId()) {
      this.loadTodayAppointments();
    }
  }

  private computeDateRanges() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    this.todayStart = startOfDay.toISOString();
    this.todayEnd = endOfDay.toISOString();
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
      case 'COMPLETED': return 'positive';
      case 'CANCELLED': return 'neutral';
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
