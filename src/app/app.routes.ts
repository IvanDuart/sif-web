import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import { brandingResolver } from './core/branding/branding.resolver';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';
import { chatGuard } from './core/auth/chat.guard';
import { sandboxRoutes } from './features/sandbox/sandbox.routes';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  ...sandboxRoutes,
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
        path: 'evolution',
        loadComponent: () => import('./features/evolution/evolution.page').then(m => m.default)
      },
      {
        path: 'my-diet',
        loadComponent: () => import('./features/my-diet/my-diet.page').then(m => m.default)
      },
      {
        path: 'patients',
        loadComponent: () => import('./features/patients/patients-list.page').then(m => m.default)
      },
      // TODO(V45): "Mis Pacientes" oculto temporalmente para todos los roles.
      // {
      //   path: 'my-patients',
      //   loadComponent: () => import('./features/patients/my-patients.page').then(m => m.default)
      // },
      {
        path: 'staff',
        loadComponent: () => import('./features/staff/staff-list.page').then(m => m.default)
      },
      {
        path: 'staff/:id',
        loadComponent: () => import('./features/staff/staff-detail.page').then(m => m.default)
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
        path: 'chat/threads',
        canActivate: [chatGuard],
        loadComponent: () => import('./features/chat/chat-threads-list.page').then(m => m.default)
      },
      {
        path: 'chat/threads/:threadId',
        canActivate: [chatGuard],
        loadComponent: () => import('./features/chat/chat-conversation.page').then(m => m.default)
      },
      {
        path: 'revenue',
        loadComponent: () => import('./features/revenue/revenue.page').then(m => m.default)
      },
      // Las rutas concretas van antes que 'billing': con `pathMatch` por
      // prefijo, 'billing' tragaría 'billing/success' y dejaría el segmento
      // sobrante sin ruta.
      {
        path: 'billing/success',
        data: { outcome: 'success' },
        loadComponent: () => import('./features/billing/billing-return.page').then(m => m.default)
      },
      {
        path: 'billing/cancel',
        data: { outcome: 'cancel' },
        loadComponent: () => import('./features/billing/billing-return.page').then(m => m.default)
      },
      // Sin `permissionGuard`: un centro suspendido manda aquí a cualquiera, y
      // quien no pueda gestionar la suscripción ve a quién avisar.
      {
        path: 'billing',
        loadComponent: () => import('./features/billing/billing.page').then(m => m.default)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/branding-settings.page').then(m => m.default)
      },
      {
        path: 'help',
        loadComponent: () => import('./features/help/help.page').then(m => m.default)
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
      },
      // La ruta con parámetro va primero: 'billing' a secas no la cubre y, al
      // revés, se tragaría el segmento del centro.
      {
        path: 'billing/:tenantId',
        loadComponent: () => import('./features/admin/billing/admin-billing-detail.page').then(m => m.default)
      },
      {
        path: 'billing',
        loadComponent: () => import('./features/admin/billing/admin-billing-list.page').then(m => m.default)
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
