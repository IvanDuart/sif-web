import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import { brandingResolver } from './core/branding/branding.resolver';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'sandbox',
    loadComponent: () => import('./features/sandbox/sandbox.component').then(m => m.SandboxComponent)
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    resolve: { branding: brandingResolver },
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/tenant/dashboard/tenant-dashboard.component').then(m => m.TenantDashboardComponent)
      },
      {
        path: 'patients',
        loadComponent: () => import('./features/patients/patients-list.page').then(m => m.default)
      },
      {
        path: 'staff',
        loadComponent: () => import('./features/staff/staff-list.page').then(m => m.default)
      },
      {
        path: 'users/:id',
        loadComponent: () => import('./features/users/user-detail.page').then(m => m.default)
      },
      {
        path: 'menus',
        loadComponent: () => import('./features/menus/menus-list.page').then(m => m.default)
      },
      {
        path: 'shopping-lists',
        loadComponent: () => import('./features/shopping-lists/shopping-lists.page').then(m => m.default)
      },
      {
        path: 'menus/:id',
        loadComponent: () => import('./features/menus/menu-detail.page').then(m => m.default)
      },
      {
        path: 'templates',
        loadComponent: () => import('./features/templates/templates-list.page').then(m => m.default)
      },
      {
        path: 'templates/:id',
        loadComponent: () => import('./features/templates/template-detail.page').then(m => m.default)
      },
      {
        path: 'appointments',
        loadComponent: () => import('./features/appointments/appointments.page').then(m => m.default)
      },
      {
        path: 'revenue',
        loadComponent: () => import('./features/revenue/revenue.page').then(m => m.default)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/branding-settings.page').then(m => m.default)
      }
    ]
  },
  {
    path: 'admin',
    component: Shell,
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      }
    ]
  },
  {
    path: 'not-authorized',
    loadComponent: () => import('./features/error/not-authorized/not-authorized.component').then(m => m.NotAuthorizedComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
