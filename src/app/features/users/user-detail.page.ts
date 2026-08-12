import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ModalService, NotificationService, ConfirmService } from '../../core/ui';
import { ThemeService } from '../../core/branding/theme.service';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { CalendarOptions, EventClickArg, DatesSetArg } from '@fullcalendar/core';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { PatientEventService } from '../../core/api/services/patient-event.api';
import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { MenuService } from '../../core/api/services/menu.api';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { TenantBrandingService } from '../../core/api/services/tenant-branding.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto, UserTenantProfileDto } from '../../core/api/models/user.model';
import { PatientEventDto } from '../../core/api/models/patient-event.model';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { BodyMeasurementDto, MeasurementHistoryDto } from '../../core/api/models/body-measurement.model';
import { Menu } from '../../core/api/models/menu.model';
import { AppointmentDto } from '../../core/api/models/appointment.model';
import { Page } from '../../core/api/models/page.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { MeasurementFormDialog } from './measurement-form.dialog';
import { EditUserDialog } from './edit-user.dialog';
import { WaterIntakeWidget } from '../tenant/dashboard/components/water-intake-widget';
import { PatientProfileFormDialog } from './patient-profile-form.dialog';
import { PatientEventFormDialog } from './patient-event-form.dialog';
import { AssignMenuTemplateDialog } from './assign-menu-template.dialog';
import { MenuFormDialog } from '../menus/menu-form.dialog';
import { formatInstant, formatInstantWithTime } from '../../shared/utils/date';
import { METRIC_SERIES, buildChartConfig, hexToRgba, themePrimary } from '../../shared/utils/chart-config';
import type { ChartConfiguration } from 'chart.js/auto';

import { Chart, registerables } from 'chart.js';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge, TuiTabs } from '@taiga-ui/kit';
import { TuiTable } from '@taiga-ui/addon-table';

Chart.register(...registerables);

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IfPermissionDirective,
    TranslocoDirective,
    EmptyState,
    FullCalendarModule,
    WaterIntakeWidget,
    SkeletonComponent,
    TuiButton,
    TuiBadge,
    TuiTable,
    TuiTabs
  ],
  templateUrl: './user-detail.page.html',
  styleUrls: ['./user-detail.page.scss']
})
export default class UserDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly measurementService = inject(BodyMeasurementService);
  private readonly menuService = inject(MenuService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly patientEventService = inject(PatientEventService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly tenantBrandingService = inject(TenantBrandingService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly transloco = inject(TranslocoService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly themeService = inject(ThemeService);

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
  canViewPatientEvents = computed(() => this.permissionsService.has('VIEW_PATIENT_EVENTS'));
  canManagePatientEvents = computed(() => this.permissionsService.has('MANAGE_PATIENT_EVENTS'));

  patientProfile = signal<UserTenantProfileDto | null>(null);
  activeAnamnesisFields = signal<string[]>([]);
  isAnamnesisFieldActive(field: string): boolean {
    const active = this.activeAnamnesisFields();
    return active.length === 0 || active.includes(field);
  }
  loadingProfile = signal(false);
  editingGuidelines = signal(false);
  savingGuidelines = signal(false);
  editBreakfast = signal('');
  editSnack = signal('');

  patientEvents = signal<PatientEventDto[]>([]);
  loadingEvents = signal(false);

  private readonly baseCalendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth'
    },
    locales: [esLocale],
    locale: 'es',
    height: 'auto',
    firstDay: 1,
    editable: false,
    selectable: false,
  };

  calendarOptions = computed<CalendarOptions>(() => ({
    ...this.baseCalendarOptions,
    eventClick: (info: EventClickArg) => this.handlePatientEventClick(info),
    datesSet: (info: DatesSetArg) => this.onPatientEventDatesSet(info),
    events: this.patientEvents().map(e => ({
      id: e.id,
      title: e.title,
      start: e.startTime,
      allDay: true,
      backgroundColor: hexToRgba(themePrimary(), 0.12),
      borderColor: themePrimary(),
      textColor: '#334155',
      extendedProps: {
        description: e.description,
        startTime: e.startTime
      }
    })),
  }));

  activeTabIndex = signal(0);

  protected readonly tabs = computed(() => {
    const items: { id: string; label: string; defaultValue?: string }[] = [];
    const isStaff = this.isStaff();

    items.push({ id: 'profile', label: 'users.tab_profile' });

    if (!isStaff) {
      items.push({ id: 'measurements', label: 'users.tab_measurements' });
      items.push({ id: 'menus', label: 'users.tab_menus' });
      items.push({ id: 'water', label: 'users.tab_water', defaultValue: 'Agua' });
    }

    if (!isStaff && this.canViewPatientProfile()) {
      items.push({ id: 'patient_profile', label: 'users.tab_patient_profile' });
      items.push({ id: 'fixed_guidelines', label: 'users.tab_fixed_guidelines' });
    }

    if (!isStaff && this.canViewPatientEvents()) {
      items.push({ id: 'patient_events', label: 'users.tab_patient_events' });
    }

    if (!isStaff && this.canViewAppointments()) {
      items.push({ id: 'appointments', label: 'appointments.history_title' });
    }

    return items;
  });

  activeTabId = computed(() => this.tabs()[this.activeTabIndex()]?.id ?? 'profile');

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

  private _chartCanvasEl?: ElementRef<HTMLCanvasElement>;

  @ViewChild('chartCanvas') set chartCanvasEl(el: ElementRef<HTMLCanvasElement> | undefined) {
    this._chartCanvasEl = el;
    if (el) this.renderChartIfReady();
  }

  private chartInstance: Chart | null = null;

  // Table pagination
  page = signal(0);
  size = signal(25);

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
      this.loadTenantPreferences();
    }

    // Subscribe to theme changes and rebuild chart when theme toggles
    effect(() => {
      this.themeService.colorScheme(); // Reactive dependency
      if (this.measurementHistory() && this.chartLoaded()) {
        // Rebuild chart on next tick to allow CSS variables to update
        requestAnimationFrame(() => {
          const history = this.measurementHistory();
          if (history) {
            this.buildChart(history);
          }
        });
      }
    });


  }

  private onUserLoaded() {
    if (this.isStaff()) return;
    this.loadMeasurements(0, this.size());
    this.loadEvolution();
    this.loadMenuHistory();
    this.loadAppointments();
    if (this.canViewPatientProfile()) {
      this.loadPatientProfile();
    }
    if (this.canViewPatientEvents()) {
      this.loadPatientEvents();
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

  private loadTenantPreferences() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.tenantBrandingService.getBranding(tenantId).subscribe({
      next: (branding) => {
        this.activeAnamnesisFields.set(branding.preferences?.active_anamnesis_fields || []);
      }
    });
  }

  loadMeasurements(page: number, size: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingMeasurements.set(true);
    this.page.set(page);
    this.size.set(size);
    this.measurementService.list(tenantId, this.userId, page, size).subscribe({
      next: (res: Page<BodyMeasurementDto>) => {
        this.measurements.set(res.content || []);
        this.totalRecords.set(res.page?.totalElements || 0);
        this.loadingMeasurements.set(false);
      },
      error: () => this.loadingMeasurements.set(false)
    });
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.loadMeasurements(page, this.size());
  }

  onSizeChange(size: number) {
    this.size.set(size);
    this.page.set(0);
    this.loadMeasurements(0, size);
  }

  getPageNumbers(): number[] {
    const total = Math.ceil(this.totalRecords() / this.size());
    const pages: number[] = [];
    const start = Math.max(0, this.page() - 2);
    const end = Math.min(total, this.page() + 3);
    for (let i = start; i < end; i++) pages.push(i);
    return pages;
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
        backgroundColor: series.color, // Will be transformed to gradient in buildChartConfig
      }));

    const config = buildChartConfig(labels, datasets);
    this.chartData = config.data;
    this.chartOptions = config.options;
    this.chartLoaded.set(true);
    this.renderChartIfReady();
  }

  
  private renderChartIfReady() {
    if (!this.chartData || !this._chartCanvasEl) return;
    if (this.chartInstance) this.chartInstance.destroy();
    this.chartInstance = new Chart(this._chartCanvasEl.nativeElement, {
      type: 'line',
      data: this.chartData,
      options: this.chartOptions ?? undefined,
    });
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

  private loadPatientEvents(from?: string, to?: string) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingEvents.set(true);
    this.patientEventService.getByPatient(tenantId, this.userId, from, to).subscribe({
      next: (events) => {
        this.patientEvents.set(events || []);
        this.loadingEvents.set(false);
      },
      error: () => this.loadingEvents.set(false)
    });
  }

  private onPatientEventDatesSet(info: DatesSetArg) {
    const start = info.start.toISOString();
    const end = info.end.toISOString();
    this.loadPatientEvents(start, end);
  }

  handlePatientEventClick(info: EventClickArg) {
    const event = this.patientEvents().find(e => e.id === info.event.id);
    if (!event) return;

    if (this.canManagePatientEvents()) {
      this.confirm.confirm({
        content: this.transloco.translate('patient_events.delete_confirm'),
        label: event.title,
        yes: this.transloco.translate('common.delete'),
        no: this.transloco.translate('patient_events.edit_event'),
      }).subscribe((accepted) => {
        if (accepted) {
          this.deletePatientEvent(event);
        } else {
          this.showEventFormDialog(event);
        }
      });
    }
  }

  showEventFormDialog(event?: PatientEventDto) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.modal.open(PatientEventFormDialog, {
      label: this.transloco.translate(event ? 'patient_events.edit_event' : 'patient_events.new_event'),
      size: 's',
      data: { event, userId: this.userId }
    }).subscribe(() => {
      this.loadPatientEvents();
    });
  }

  private deletePatientEvent(event: PatientEventDto) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.patientEventService.delete(tenantId, event.id).subscribe({
      next: () => {
        this.notify.success(this.transloco.translate('patient_events.delete_success'), this.transloco.translate('common.success'));
        this.loadPatientEvents();
      },
      error: () => {
        this.notify.error(this.transloco.translate('patient_events.delete_error'), this.transloco.translate('common.error'));
      }
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
      case 'PROPOSED': return 'warn';
      default: return 'info';
    }
  }

  startEditGuidelines() {
    const profile = this.patientProfile();
    this.editBreakfast.set(profile?.breakfast ?? '');
    this.editSnack.set(profile?.snack ?? '');
    this.editingGuidelines.set(true);
  }

  cancelEditGuidelines() {
    this.editingGuidelines.set(false);
  }

  saveGuidelines() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    const profile = this.patientProfile();
    if (!profile) return;

    this.savingGuidelines.set(true);
    const request: UserTenantProfileDto = {
      ...profile,
      breakfast: this.editBreakfast() || null,
      snack: this.editSnack() || null
    };
    this.userTenantRoleService.updatePatientProfile(tenantId, this.userId, request).subscribe({
      next: () => {
        this.savingGuidelines.set(false);
        this.editingGuidelines.set(false);
        this.notify.success(this.transloco.translate('notifications.guidelines_saved'), this.transloco.translate('common.success'));
        this.loadPatientProfile();
      },
      error: () => {
        this.savingGuidelines.set(false);
        this.notify.error(this.transloco.translate('notifications.guidelines_error'), this.transloco.translate('common.error'));
      }
    });
  }

  showEditProfileDialog() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.modal.open(PatientProfileFormDialog, {
      label: this.transloco.translate('patient_profile.edit'),
      size: 'm',
      data: { profile: this.patientProfile(), userId: this.userId }
    }).subscribe(() => {
      this.loadPatientProfile();
    });
  }

  showRegisterDialog() {
    this.modal.open(MeasurementFormDialog, {
      label: this.transloco.translate('measurements.register'),
      size: 'l',
      data: { userId: this.userId }
    }).subscribe(() => {
      this.notify.success(this.transloco.translate('notifications.measurement_registered'), this.transloco.translate('common.success'));
      this.loadMeasurements(0, this.size());
      this.loadEvolution();
    });
  }

  showCreateMenuDialog() {
    this.modal.open(MenuFormDialog, {
      label: this.transloco.translate('menu_history.create_menu_dialog'),
      size: 's',
      data: { userId: this.userId }
    }).subscribe(() => {
      this.notify.success(this.transloco.translate('notifications.menu_created'));
      this.loadMenuHistory();
    });
  }

  showAssignTemplateDialog() {
    this.modal.open(AssignMenuTemplateDialog, {
      label: this.transloco.translate('menu_history.assign_template_dialog'),
      size: 's',
      data: { userId: this.userId }
    }).subscribe(() => {
      this.notify.success(this.transloco.translate('notifications.template_assigned'));
      this.loadMenuHistory();
    });
  }

  showEditDialog() {
    const current = this.user();
    if (!current) return;
    this.modal.open(EditUserDialog, {
      label: this.transloco.translate('users.edit_user_title'),
      size: 'm',
      data: { user: current }
    }).subscribe(() => {
      this.loadUser();
    });
  }

  deleteMeasurement(measurement: BodyMeasurementDto) {
    const date = formatInstant(measurement.measuredAt);
    this.confirm.confirm({
      content: this.transloco.translate('measurements.delete_confirm_msg', { date }),
      label: this.transloco.translate('common.attention'),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.cancel'),
    }).subscribe((accepted) => {
      if (accepted) {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.measurementService.delete(tenantId, this.userId, measurement.id).subscribe({
            next: () => {
              this.notify.success(this.transloco.translate('notifications.measurement_deleted'), this.transloco.translate('common.success'));
              this.loadMeasurements(this.page(), this.size());
              this.loadEvolution();
            }
           });
         }
       }
     });
   }

   ngOnDestroy() {
     if (this.chartInstance) {
       this.chartInstance.destroy();
       this.chartInstance = null;
     }
   }
 }
