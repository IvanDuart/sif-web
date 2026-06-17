import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { PopoverModule } from 'primeng/popover';
import { ProgressBarModule } from 'primeng/progressbar';
import { MenuItem } from 'primeng/api';

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/branding/theme.service';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { TenantMembershipDto } from '../../core/api/models/user.model';
import { globalLoadingSignal } from '../../core/http/loading.interceptor';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    TranslocoModule,
    MenubarModule,
    ButtonModule,
    AvatarModule,
    PopoverModule,
    ProgressBarModule
  ],
  templateUrl: './shell.html',
  styleUrls: ['./shell.scss']
})
export class Shell {
  loading = globalLoadingSignal;

  private readonly transloco = inject(TranslocoService);
  private readonly authService = inject(AuthService);
  private readonly permissionsService = inject(PermissionsService);
  readonly themeService = inject(ThemeService);

  user = this.authService.user;
  activeTenant = this.authService.selectedTenant;
  tenants = computed(() => this.user()?.memberships ?? []);

  // Select translations reactively
  readonly navTranslations = toSignal(
    this.transloco.selectTranslateObject('menu'),
    { initialValue: <Record<string, string>>{} }
  );

  readonly authTranslations = toSignal(
    this.transloco.selectTranslateObject('auth'),
    { initialValue: <Record<string, string>>{} }
  );

  menuItems = computed<MenuItem[]>(() => {
    const nav = this.navTranslations();
    if (!nav || Object.keys(nav).length === 0) return []; // Wait for translations

    const tenantId = this.activeTenant()?.tenantId;
    if (!tenantId) return [];

    const items: MenuItem[] = [
      {
        label: 'MOBILE_SELECTOR'
      },
      {
        label: nav['dashboard'] || 'Dashboard',
        icon: 'fa-solid fa-house',
        routerLink: ['/dashboard']
      }
    ];

    if (this.permissionsService.has('VIEW_USER') || this.permissionsService.has('MANAGE_USER')) {
      items.push(
        {
          label: nav['patients'] || 'Pacientes',
          icon: 'fa-solid fa-user-injured',
          routerLink: ['/patients']
        },
        {
          label: nav['staff'] || 'Equipo',
          icon: 'fa-solid fa-user-doctor',
          routerLink: ['/staff']
        }
      );
    }

    if (this.permissionsService.has('VIEW_APPOINTMENTS') || this.permissionsService.has('MANAGE_APPOINTMENTS')) {
      items.push({
        label: nav['appointments'] || 'Citas',
        icon: 'fa-solid fa-calendar-days',
        routerLink: ['/appointments']
      });
    }

    if (this.permissionsService.has('VIEW_MENU') || this.permissionsService.has('MANAGE_MENU')) {
      items.push({
        label: nav['diets'] || 'Diets',
        icon: 'fa-solid fa-utensils',
        routerLink: ['/menus']
      });
    }

    if (this.permissionsService.has('MANAGE_TEMPLATE')) {
      items.push({
        label: nav['templates'] || 'Templates',
        icon: 'fa-solid fa-clipboard-list',
        routerLink: ['/templates']
      });
    }

    if (this.permissionsService.has('MANAGE_TENANT_BRANDING')) {
      items.push({
        label: nav['settings'] || 'Settings',
        icon: 'fa-solid fa-gear',
        routerLink: ['/settings']
      });
    }

    items.push({
      label: 'MOBILE_LOGOUT'
    });

    return items;
  });

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

  selectTenant(tenant: TenantMembershipDto) {
    this.authService.selectTenant(tenant);
  }

  logout() {
    this.authService.logout();
  }

  toggleTheme() {
    this.themeService.toggleColorScheme();
  }
}