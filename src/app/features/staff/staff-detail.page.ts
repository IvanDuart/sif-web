import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';

import { TuiButton } from '@taiga-ui/core';
import { TuiBadge, TuiTabs } from '@taiga-ui/kit';
import { TuiTable } from '@taiga-ui/addon-table';

import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { AppUserDto } from '../../core/api/models/user.model';
import { AppointmentDto, NutritionistPatientDto } from '../../core/api/models/appointment.model';
import { ModalService, NotificationService, ConfirmService } from '../../core/ui';
import { EmptyState } from '../../shared/ui/empty-state';
import { EditUserDialog, EditUserDialogInput } from '../users/edit-user.dialog';
import { formatInstant, formatInstantWithTime } from '../../shared/utils/date';

const DAY_MS = 86_400_000;
/** Window used to compute the attendance rate. */
const ATTENDANCE_WINDOW_DAYS = 90;
/** How far ahead the agenda is loaded. */
const AGENDA_WINDOW_DAYS = 60;

/**
 * Staff file (nutritionists and admins). Split from `UserDetailPage` because the
 * clinical patient record and the team member record have almost nothing in common.
 *
 * Admins get an extra "Actividad y Cartera" tab with the member's assigned
 * patients (V45 titular cartera), their schedule and their attendance rate.
 */
@Component({
  selector: 'app-staff-detail',
  standalone: true,
  imports: [
    RouterModule,
    TranslocoDirective,
    IfPermissionDirective,
    EmptyState,
    SkeletonComponent,
    TuiButton,
    TuiBadge,
    TuiTabs,
    TuiTable,
  ],
  templateUrl: './staff-detail.page.html'
})
export default class StaffDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  staffId = '';

  loading = signal(true);
  loadingActivity = signal(false);
  isSendingResetPassword = signal(false);

  /** Basic identity record (`/users/{id}`): createdAt, gender, etc. */
  staff = signal<AppUserDto | null>(null);
  /** Tenant record (TenantUserDto) with role, permissions and enabled flag. */
  membershipRecord = signal<AppUserDto | null>(null);

  assignedPatients = signal<NutritionistPatientDto[]>([]);
  appointments = signal<AppointmentDto[]>([]);

  activeTabIndex = signal(0);

  protected readonly formatInstant = formatInstant;
  protected readonly formatInstantWithTime = formatInstantWithTime;

  /**
   * Merged view: the tenant record (role, enabled, phone, height) wins over the
   * global record, but only with defined values so nothing gets blanked out.
   */
  profile = computed<AppUserDto | null>(() => {
    const user = this.staff();
    if (!user) return null;
    const record = this.membershipRecord();
    if (!record) return user;

    const merged: Record<string, unknown> = { ...user };
    for (const [key, value] of Object.entries(record)) {
      if (value !== null && value !== undefined) merged[key] = value;
    }
    // This page only ever renders team members, and `EditUserDialog` relies on
    // `userType` to offer the role selector.
    merged['userType'] = 'STAFF';
    return merged as unknown as AppUserDto;
  });

  /** Only the tenant ADMIN may inspect another member's portfolio and agenda. */
  isTenantAdmin = computed(() => {
    const roleCode = this.tenantCtx.currentMembership()?.roleCode;
    return roleCode === 'ADMIN' &&
      (this.permissionsService.has('MANAGE_TENANT') || this.permissionsService.has('MANAGE_USER'));
  });

  isOwnProfile = computed(() => !!this.staffId && this.staffId === this.authService.user()?.id);

  private readonly canViewAppointments = computed(() =>
    this.permissionsService.has('VIEW_APPOINTMENTS') || this.permissionsService.has('MANAGE_APPOINTMENTS')
  );

  canViewActivity = computed(() => this.canViewAppointments() && (this.isTenantAdmin() || this.isOwnProfile()));

  protected readonly tabs = computed(() => {
    const items: { id: string; label: string; icon: string }[] = [
      { id: 'profile', label: 'users.tab_profile', icon: 'fa-solid fa-address-card' }
    ];

    if (this.canViewActivity()) {
      items.push({ id: 'activity', label: 'staff.tab_activity', icon: 'fa-solid fa-chart-line' });
    }

    return items;
  });

  activeTabId = computed(() => this.tabs()[this.activeTabIndex()]?.id ?? 'profile');

  staffRoleLabel = computed(() => {
    const user = this.profile();
    if (user?.roleName) return user.roleName;
    if (user?.roleCode) return user.roleCode;
    const tenantId = this.tenantCtx.currentTenantId();
    return user?.memberships?.find(m => m.tenantId === tenantId)?.roleCode || '—';
  });

  isEnabled = computed(() => this.profile()?.enabled !== false);

  // ---------------------------------------------------------------- Activity

  private readonly pastAppointments = computed(() =>
    this.appointments().filter(a => Date.parse(a.startTime) < Date.now())
  );

  upcomingAppointments = computed(() =>
    this.appointments()
      .filter(a => Date.parse(a.startTime) >= Date.now())
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
  );

  private readonly evaluatedAppointments = computed(() =>
    this.pastAppointments().filter(a => a.status !== 'CANCELLED')
  );

  attendanceSampleSize = computed(() => this.evaluatedAppointments().length);

  attendanceRate = computed(() => {
    const evaluated = this.evaluatedAppointments();
    if (evaluated.length === 0) return 0;
    const completed = evaluated.filter(a => a.status === 'COMPLETED').length;
    return Math.round((completed / evaluated.length) * 100);
  });

  portfolioCount = computed(() => this.assignedPatients().length);

  // ------------------------------------------------------------------ Loading

  ngOnInit() {
    this.staffId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.staffId) return;
    this.loadStaff();
  }

  private loadStaff() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    forkJoin({
      user: this.userTenantRoleService.getUser(tenantId, this.staffId),
      members: this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'STAFF', { size: 1000 })
    }).subscribe({
      next: ({ user, members }) => {
        this.staff.set(user);
        // TenantUserDto carries role/roleCode/enabled/userType, which AppUser_Full
        // does not expose consistently.
        this.membershipRecord.set((members.content || []).find(m => m.id === this.staffId) || null);
        this.loading.set(false);
        if (this.canViewActivity()) {
          this.loadActivity();
        }
      },
      error: () => this.loading.set(false)
    });
  }

  private loadActivity() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const now = Date.now();
    const from = new Date(now - ATTENDANCE_WINDOW_DAYS * DAY_MS).toISOString();
    const to = new Date(now + AGENDA_WINDOW_DAYS * DAY_MS).toISOString();

    this.loadingActivity.set(true);
    forkJoin({
      patients: this.appointmentService.getPatientsByNutritionist(tenantId, this.staffId),
      appointments: this.appointmentService.getByNutritionist(tenantId, this.staffId, from, to)
    }).subscribe({
      next: ({ patients, appointments }) => {
        this.assignedPatients.set(patients || []);
        this.appointments.set(appointments || []);
        this.loadingActivity.set(false);
      },
      error: () => this.loadingActivity.set(false)
    });
  }

  // ------------------------------------------------------------------ Helpers

  getInitials(user: AppUserDto): string {
    const first = (user.firstName ?? '').trim();
    const last = (user.lastName ?? '').trim();
    return (`${first.charAt(0)}${last.charAt(0)}` || '?').toUpperCase();
  }

  getPatientInitials(patient: NutritionistPatientDto): string {
    const first = (patient.firstName ?? '').trim();
    const last = (patient.lastName ?? '').trim();
    return (`${first.charAt(0)}${last.charAt(0)}` || '?').toUpperCase();
  }

  getStatusLabel(status: string): string {
    return this.transloco.translate(`appointments.status_${status.toLowerCase()}`);
  }

  getStatusSeverity(status: string): 'positive' | 'info' | 'warning' | 'neutral' {
    switch (status) {
      case 'COMPLETED': return 'positive';
      case 'CANCELLED': return 'neutral';
      case 'NO_SHOW': return 'warning';
      case 'PROPOSED': return 'warning';
      default: return 'info';
    }
  }

  // ------------------------------------------------------------------ Actions

  showEditDialog() {
    const user = this.profile();
    if (!user) return;

    this.modal.open<boolean, EditUserDialogInput>(EditUserDialog, {
      label: this.transloco.translate('users.edit_user_title'),
      size: 'm',
      data: { user }
    }).subscribe(() => this.loadStaff());
  }

  resetPassword() {
    const current = this.profile();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!current || !tenantId) return;

    const name = `${current.firstName || ''} ${current.lastName || ''}`.trim() || current.email || '';
    const email = current.email || '';

    forkJoin({
      title: this.transloco.selectTranslate('users.reset_password_confirm_title').pipe(take(1)),
      msg: this.transloco.selectTranslate('users.reset_password_confirm_msg', { name, email }).pipe(take(1)),
      yes: this.transloco.selectTranslate('users.reset_password_confirm_btn').pipe(take(1)),
      no: this.transloco.selectTranslate('common.cancel').pipe(take(1))
    }).subscribe((texts) => {
      this.confirm.confirm({
        label: texts.title,
        content: texts.msg,
        yes: texts.yes,
        no: texts.no,
        size: 'm'
      }).subscribe((accepted) => {
        if (!accepted) return;
        this.isSendingResetPassword.set(true);
        this.userTenantRoleService.sendResetPassword(tenantId, current.id).subscribe({
          next: () => {
            this.isSendingResetPassword.set(false);
            this.notify.success(
              this.transloco.translate('users.reset_password_success'),
              this.transloco.translate('common.success')
            );
          },
          error: () => {
            this.isSendingResetPassword.set(false);
            this.notify.error(
              this.transloco.translate('users.reset_password_error'),
              this.transloco.translate('common.error')
            );
          }
        });
      });
    });
  }

  revokeAccess() {
    const current = this.profile();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!current || !tenantId) return;

    this.confirm.confirm({
      label: this.transloco.translate('users.revoke_confirm_title'),
      content: this.transloco.translate('users.revoke_confirm_msg', {
        name: `${current.firstName} ${current.lastName}`
      }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.userTenantRoleService.revokeAccess(tenantId, current.id).subscribe(() => {
        this.notify.success(this.transloco.translate('staff.revoke_success'));
        // No point staying on a file whose membership no longer exists.
        this.router.navigate(['/staff']);
      });
    });
  }
}
