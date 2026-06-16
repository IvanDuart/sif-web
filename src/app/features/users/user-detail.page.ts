import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService, type LazyLoadMeta } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { UIChart } from 'primeng/chart';
import { SelectButton } from 'primeng/selectbutton';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { MenuService } from '../../core/api/services/menu.api';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto, UserTenantProfileDto } from '../../core/api/models/user.model';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { BodyMeasurementDto, MeasurementHistoryDto } from '../../core/api/models/body-measurement.model';
import { Menu } from '../../core/api/models/menu.model';
import { AppointmentDto } from '../../core/api/models/appointment.model';
import { Page } from '../../core/api/models/page.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { MeasurementFormDialog } from './measurement-form.dialog';
import { EditUserDialog } from './edit-user.dialog';
import { PatientProfileFormDialog } from './patient-profile-form.dialog';
import { AssignMenuTemplateDialog } from './assign-menu-template.dialog';
import { MenuFormDialog } from '../menus/menu-form.dialog';
import { formatInstant, formatInstantWithTime } from '../../shared/utils/date';
import { METRIC_SERIES, buildChartConfig } from '../../shared/utils/chart-config';
import type { ChartConfiguration } from 'chart.js/auto';

import { Chart, registerables } from 'chart.js';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

Chart.register(...registerables);

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CardModule, ButtonModule, TagModule, TableModule, TabsModule, TooltipModule, ConfirmDialogModule, UIChart, SelectButton, IfPermissionDirective, TranslocoDirective, EmptyState],
  providers: [ConfirmationService, DialogService],
  templateUrl: './user-detail.page.html'
})
export default class UserDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private userTenantRoleService = inject(UserTenantRoleService);
  private measurementService = inject(BodyMeasurementService);
  private menuService = inject(MenuService);
  private appointmentService = inject(AppointmentService);
  private tenantCtx = inject(TenantContextService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private dialogService = inject(DialogService);
  private transloco = inject(TranslocoService);
  private permissionsService = inject(PermissionsService);

  user = signal<AppUserDto | null>(null);
  measurements = signal<BodyMeasurementDto[]>([]);
  measurementHistory = signal<MeasurementHistoryDto | null>(null);
  menus = signal<Menu[]>([]);
  activeMenu = signal<Menu | null>(null);
  appointments = signal<AppointmentDto[]>([]);
  loadingUser = signal(true);
  loadingMeasurements = signal(true);
  loadingMenus = signal(true);
  loadingAppointments = signal(true);
  totalRecords = signal(0);
  userId = '';

  isStaff = computed(() => this.user()?.userType === 'STAFF');
  backRoute = computed(() => this.isStaff() ? '/staff' : '/patients');

  canViewPatientProfile = computed(() => this.permissionsService.has('VIEW_PATIENT_PROFILE'));
  canManagePatientProfile = computed(() => this.permissionsService.has('MANAGE_PATIENT_PROFILE'));
  canViewAppointments = computed(() => this.permissionsService.has('VIEW_APPOINTMENTS'));
  canManageMenu = computed(() => this.permissionsService.has('MANAGE_MENU'));

  patientProfile = signal<UserTenantProfileDto | null>(null);
  loadingProfile = signal(false);

  activeTab = signal('0');

  // Chart
  chartData: ChartConfiguration<'line'>['data'] | null = null;
  chartOptions: ChartConfiguration<'line'>['options'] | null = null;
  chartLoaded = signal(false);
  chartType = signal<'composition' | 'anthropometry'>('composition');
  readonly chartTypeOptions = [
    { label: 'Composición Corporal', value: 'composition' as const },
    { label: 'Antropometría', value: 'anthropometry' as const },
  ];
  private readonly COMPOSITION_FIELDS = new Set<string>(['weightKg', 'bmi', 'bodyFatPct', 'muscleMassKg', 'bodyWaterPct']);
  private readonly ANTHROPOMETRY_FIELDS = new Set<string>(['waistCm', 'chestCm', 'hipsCm', 'contourCm', 'armCm']);

  // Table pagination
  private page = 0;
  private size = 20;

  protected readonly formatInstant = formatInstant;
  protected readonly formatInstantWithTime = formatInstantWithTime;

  getRoleLabel(user: AppUserDto): string {
    if (user.roleName) return user.roleName;
    const tenantId = this.tenantCtx.currentTenantId();
    const membership = user.memberships?.find(m => m.tenantId === tenantId);
    return membership?.roleCode || 'DESCONOCIDO';
  }

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (this.userId) {
      this.loadUser();
    }
  }

  private onUserLoaded() {
    if (this.isStaff()) return;
    this.loadMeasurements(0, this.size);
    this.loadEvolution();
    this.loadMenuHistory();
    this.loadAppointments();
    if (this.canViewPatientProfile()) {
      this.loadPatientProfile();
    }
  }

  private loadUser() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingUser.set(true);
    this.userTenantRoleService.getUser(tenantId, this.userId).subscribe({
      next: (u) => {
        this.user.set(u);
        this.loadingUser.set(false);
        this.onUserLoaded();
      },
      error: () => this.loadingUser.set(false)
    });
  }

  loadMeasurements(page: number, size: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingMeasurements.set(true);
    this.page = page;
    this.size = size;
    this.measurementService.list(tenantId, this.userId, page, size).subscribe({
      next: (res: Page<BodyMeasurementDto>) => {
        this.measurements.set(res.content || []);
        this.totalRecords.set(res.page?.totalElements || 0);
        this.loadingMeasurements.set(false);
      },
      error: () => this.loadingMeasurements.set(false)
    });
  }

  onPage(event: LazyLoadMeta) {
    this.loadMeasurements((event.first ?? 0) / (event.rows ?? 20), event.rows ?? 20);
  }

  private loadEvolution() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.measurementService.getEvolution(tenantId, this.userId).subscribe({
      next: (history) => {
        this.measurementHistory.set(history);
        this.buildChart(history);
      }
    });
  }

  private buildChart(history: MeasurementHistoryDto) {
    const points = history.points;
    if (!points || points.length === 0) {
      this.chartLoaded.set(false);
      return;
    }

    const sorted = [...points].reverse();
    const labels = sorted.map(p => {
      const d = new Date(p.measuredAt);
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    });

    const selectedFields = this.chartType() === 'composition' ? this.COMPOSITION_FIELDS : this.ANTHROPOMETRY_FIELDS;

    const transloco = this.transloco;
    const datasets = METRIC_SERIES
      .filter(series => selectedFields.has(series.field))
      .map(series => ({
        label: transloco.translate(series.label),
        data: sorted.map(p => p[series.field]),
        borderColor: series.color,
        backgroundColor: series.color + '20',
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      }));

    const config = buildChartConfig(labels, datasets);
    this.chartData = config.data;
    this.chartOptions = config.options;
    this.chartLoaded.set(true);
  }

  setChartType(type: 'composition' | 'anthropometry') {
    this.chartType.set(type);
    const history = this.measurementHistory();
    if (history) {
      this.buildChart(history);
    }
  }

  private loadMenuHistory() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingMenus.set(true);
    this.menuService.history(tenantId, this.userId).subscribe({
      next: (menuList) => {
        this.menus.set(menuList || []);
        const active = (menuList || []).find(m => m.isActive || m.active);
        this.activeMenu.set(active || null);
        this.loadingMenus.set(false);
      },
      error: () => this.loadingMenus.set(false)
    });
  }

  private loadPatientProfile() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingProfile.set(true);
    this.userTenantRoleService.getPatientProfile(tenantId, this.userId).subscribe({
      next: (profile) => {
        this.patientProfile.set(profile);
        this.loadingProfile.set(false);
      },
      error: () => this.loadingProfile.set(false)
    });
  }

  private loadAppointments() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.canViewAppointments()) return;
    this.loadingAppointments.set(true);
    this.appointmentService.getByPatient(tenantId, this.userId).subscribe({
      next: (res) => {
        this.appointments.set(res || []);
        this.loadingAppointments.set(false);
      },
      error: () => this.loadingAppointments.set(false)
    });
  }

  getStatusLabel(status: string): string {
    const key = `appointments.status_${status.toLowerCase()}`;
    return this.transloco.translate(key);
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'secondary' {
    switch (status) {
      case 'SCHEDULED': return 'info';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'secondary';
      case 'NO_SHOW': return 'warn';
      default: return 'info';
    }
  }

  showEditProfileDialog() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    const ref = this.dialogService.open(PatientProfileFormDialog, {
      header: this.transloco.translate('patient_profile.edit'),
      width: '650px',
      modal: true,
      data: { profile: this.patientProfile(), userId: this.userId },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) this.loadPatientProfile();
      });
    }
  }

  showRegisterDialog() {
    const ref = this.dialogService.open(MeasurementFormDialog, {
      header: this.transloco.translate('measurements.register'),
      width: '50vw',
      modal: true,
      data: { userId: this.userId },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Medición registrada correctamente' });
          this.loadMeasurements(0, this.size);
          this.loadEvolution();
        }
      });
    }
  }

  showCreateMenuDialog() {
    const ref = this.dialogService.open(MenuFormDialog, {
      header: 'Crear Menú',
      width: '500px',
      modal: true,
      data: { userId: this.userId },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: 'Menú creado', detail: 'Menú asignado al paciente correctamente' });
          this.loadMenuHistory();
        }
      });
    }
  }

  showAssignTemplateDialog() {
    const ref = this.dialogService.open(AssignMenuTemplateDialog, {
      header: 'Asignar desde Plantilla',
      width: '500px',
      modal: true,
      data: { userId: this.userId },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: 'Menú asignado', detail: 'Plantilla asignada al paciente correctamente' });
          this.loadMenuHistory();
        }
      });
    }
  }

  showEditDialog() {
    const current = this.user();
    if (!current) return;
    const ref = this.dialogService.open(EditUserDialog, {
      header: this.transloco.translate('users.edit_user_title'),
      width: '500px',
      modal: true,
      data: { user: current },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((updated) => {
        if (updated) this.loadUser();
      });
    }
  }

  deleteMeasurement(measurement: BodyMeasurementDto) {
    const date = formatInstant(measurement.measuredAt);
    this.confirmationService.confirm({
      message: this.transloco.translate('measurements.delete_confirm_msg', { date }),
      header: this.transloco.translate('common.attention'),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: this.transloco.translate('common.yes'),
      rejectLabel: this.transloco.translate('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.measurementService.delete(tenantId, this.userId, measurement.id).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Medición eliminada' });
              this.loadMeasurements(this.page, this.size);
              this.loadEvolution();
            }
          });
        }
      }
    });
  }
}
