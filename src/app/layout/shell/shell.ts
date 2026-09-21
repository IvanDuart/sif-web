import { Component, computed, inject, signal, viewChild, ElementRef, OnInit } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { animate } from 'motion';

import { TuiAvatar, TuiProgressBar } from '@taiga-ui/kit';
import { TuiDropdown, TuiHint } from '@taiga-ui/core';

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/branding/theme.service';
import { ConfigService } from '../../core/config/config.service';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { TenantMembershipDto } from '../../core/api/models/user.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppointmentService } from '../../core/api/services/appointment.api';
import { AppointmentDto } from '../../core/api/models/appointment.model';
import { globalLoadingSignal } from '../../core/http/loading.interceptor';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'dashboard', icon: 'fa-solid fa-house', route: '/dashboard' },
  // TODO(V45): "Mis Pacientes" oculto temporalmente para todos los roles (reactivar cuando se implemente del todo).
  // { labelKey: 'my_patients', icon: 'fa-solid fa-user-group', route: '/my-patients', permission: 'MY_PATIENTS' },
  { labelKey: 'patients', icon: 'fa-solid fa-user-injured', route: '/patients', permission: 'VIEW_USER' },
  { labelKey: 'staff', icon: 'fa-solid fa-user-doctor', route: '/staff', permission: 'VIEW_USER' },
  { labelKey: 'appointments', icon: 'fa-solid fa-calendar-days', route: '/appointments', permission: 'VIEW_APPOINTMENTS' },
  { labelKey: 'revenue', icon: 'fa-solid fa-chart-line', route: '/revenue', permission: 'VIEW_REVENUE' },
  { labelKey: 'diets', icon: 'fa-solid fa-utensils', route: '/menus', permission: 'VIEW_MENU' },
  { labelKey: 'shopping_list', icon: 'fa-solid fa-cart-shopping', route: '/shopping-lists', permission: 'VIEW_MENU' },
  { labelKey: 'templates', icon: 'fa-solid fa-clipboard-list', route: '/templates', permission: 'MANAGE_TEMPLATE' },
  { labelKey: 'settings', icon: 'fa-solid fa-gear', route: '/settings', permission: 'MANAGE_TENANT_BRANDING' },
  { labelKey: 'admin', icon: 'fa-solid fa-shield-halved', route: '/admin', permission: 'MANAGE_TENANT' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterModule,
    TranslocoModule,
    TuiProgressBar,
    TuiAvatar,
    ...TuiDropdown,
    TuiHint,
  ],
  templateUrl: './shell.html',
  styleUrls: ['./shell.scss']
})
export class Shell implements OnInit {
  loading = globalLoadingSignal;

  private readonly transloco = inject(TranslocoService);
  private readonly authService = inject(AuthService);
  readonly permissionsService = inject(PermissionsService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);
  private readonly configService = inject(ConfigService);

  proposedAppointments = signal<AppointmentDto[]>([]);
  bellMenuOpen = signal(false);

  user = this.authService.user;
  activeTenant = this.authService.selectedTenant;
  tenants = computed(() => this.user()?.memberships ?? []);

  tenantLogoUrl = computed(() => {
    const tenantId = this.activeTenant()?.tenantId;
    return tenantId ? `${this.configService.apiUrl}/tenant/${tenantId}/branding/logo` : null;
  });
  logoError = signal(false);

  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);
  tenantMenuOpen = signal(false);

  navPillTransform = signal('translateX(0px)');
  navPillWidth = signal(0);

  private readonly mobileMenuPanel = viewChild<ElementRef<HTMLElement>>('mobileMenuPanel');
  private dragging = false;
  private dragStartY = 0;
  private dragCurrentY = 0;
  private dragVelocity = 0;
  private dragLastMoveTime = 0;

  ngOnInit() {
    this.loadProposals();
  }

  loadProposals() {
    const tenantId = this.activeTenant()?.tenantId;
    const userId = this.user()?.id;
    const hasPermission = this.permissionsService.has('VIEW_APPOINTMENTS') || this.permissionsService.has('MANAGE_APPOINTMENTS');
    if (!tenantId || !userId || !hasPermission) return;

    this.appointmentService.getByNutritionist(tenantId, userId, undefined, undefined, 'PROPOSED').subscribe({
      next: (res) => {
        this.proposedAppointments.set(res || []);
      }
    });
  }

  goToProposedDate(appt: AppointmentDto) {
    this.bellMenuOpen.set(false);
    const dateOnly = appt.startTime.split('T')[0];
    this.router.navigate(['/appointments'], { queryParams: { date: dateOnly } }).then(() => {
      // If we are already on appointments, reload page to force date navigation
      if (globalThis.location.pathname.includes('/appointments')) {
        globalThis.location.search = `?date=${dateOnly}`;
      }
    });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' hs';
  }

  readonly navTranslations = toSignal(
    this.transloco.selectTranslateObject('menu'),
    { initialValue: {} as Record<string, string> }
  );

  readonly authTranslations = toSignal(
    this.transloco.selectTranslateObject('auth'),
    { initialValue: {} as Record<string, string> }
  );

  visibleNavItems = computed<NavItem[]>(() => {
    const nav = this.navTranslations();
    if (!nav || Object.keys(nav).length === 0) return [];

    const tenantId = this.activeTenant()?.tenantId;
    if (!tenantId) return [];

    return NAV_ITEMS.filter(item => {
      if (!item.permission) return true;
      // VIEW_USER covers both patients and staff
      if (item.permission === 'VIEW_USER') {
        return this.permissionsService.has('VIEW_USER') || this.permissionsService.has('MANAGE_USER');
      }
      if (item.permission === 'VIEW_APPOINTMENTS') {
        return this.activeTenant()?.userType === 'STAFF' &&
          (this.permissionsService.has('VIEW_APPOINTMENTS') || this.permissionsService.has('MANAGE_APPOINTMENTS'));
      }
      // TODO(V45): "Mis Pacientes" oculto temporalmente para todos los roles.
      // if (item.permission === 'MY_PATIENTS') {
      //   const roleCode = this.tenantCtx.currentMembership()?.roleCode;
      //   return this.activeTenant()?.userType === 'STAFF' &&
      //     (roleCode === 'NUTRITIONIST' || roleCode === 'ADMIN') &&
      //     (this.permissionsService.has('VIEW_APPOINTMENTS') || this.permissionsService.has('MANAGE_APPOINTMENTS'));
      // }
      if (item.permission === 'VIEW_MENU') {
        return this.activeTenant()?.userType === 'PATIENT';
      }
      if (item.permission === 'MANAGE_TENANT') {
        return this.permissionsService.has('MANAGE_TENANT') && this.tenantCtx.isAdminTenant();
      }
      return this.permissionsService.has(item.permission);
    });
  });

  navLabel(item: NavItem): string {
    const nav = this.navTranslations();
    return nav[item.labelKey] || item.labelKey;
  }

  userInitials = computed(() => {
    const u = this.user();
    if (u?.firstName && u?.lastName) {
      return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
    }
    return (u?.email || '??').substring(0, 2).toUpperCase();
  });

  userFullName = computed(() => {
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName}` : '...';
  });

  userEmail = computed(() => this.user()?.email || '');

  selectTenant(tenant: TenantMembershipDto): void {
    this.authService.selectTenant(tenant);
    this.logoError.set(false);
    this.tenantMenuOpen.set(false);
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.authService.logout();
  }

  toggleTheme(): void {
    this.themeService.toggleColorScheme();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  onNavLinkActive(isActive: boolean, el: HTMLAnchorElement): void {
    if (!isActive) return;
    this.navPillTransform.set(`translateX(${el.offsetLeft}px)`);
    this.navPillWidth.set(el.offsetWidth);
  }

  private prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  onMobileMenuDragStart(event: PointerEvent): void {
    if (this.prefersReducedMotion()) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.dragging = true;
    this.dragStartY = event.clientY;
    this.dragCurrentY = 0;
    this.dragVelocity = 0;
    this.dragLastMoveTime = performance.now();
  }

  onMobileMenuDragMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const panel = this.mobileMenuPanel()?.nativeElement;
    if (!panel) return;

    const rawDelta = event.clientY - this.dragStartY;
    // Only the downward (dismiss) direction tracks 1:1; upward rubber-bands.
    const delta = rawDelta > 0 ? rawDelta : rawDelta * 0.25;
    const now = performance.now();
    const dt = now - this.dragLastMoveTime;
    // Ignore sub-4ms gaps between events (coalescing/timing jitter can
    // otherwise produce spurious huge velocities from a tiny, slow drag)
    // and clamp to a plausible human-flick range.
    if (dt > 4) {
      const instant = ((delta - this.dragCurrentY) / dt) * 1000;
      this.dragVelocity = Math.max(-3000, Math.min(3000, instant));
    }
    this.dragCurrentY = delta;
    this.dragLastMoveTime = now;
    panel.style.transform = `translateY(${delta}px)`;
  }

  onMobileMenuDragEnd(): void {
    if (!this.dragging) return;
    this.dragging = false;
    const panel = this.mobileMenuPanel()?.nativeElement;
    if (!panel) return;

    const dismiss = this.dragCurrentY > panel.offsetHeight * 0.3 || this.dragVelocity > 800;
    const target = dismiss ? panel.offsetHeight : 0;

    // Scoped DESIGN.md §6 exception: velocity-projected spring, not the
    // standard fixed-duration curve, because this is gesture feedback.
    animate(panel, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4, velocity: this.dragVelocity })
      .then(() => {
        panel.style.transform = '';
        if (dismiss) this.closeMobileMenu();
      });
  }
}
