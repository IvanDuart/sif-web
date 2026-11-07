import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { PermissionsService } from '../permissions/permissions.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuthService } from './auth.service';
import { afterTenantLoaded } from './tenant-ready';

/**
 * El chat 1:1 es una herramienta del nutricionista: sólo STAFF con
 * `MANAGE_CHAT`. Los pacientes lo usan desde la app móvil, así que un acceso
 * directo por URL vuelve al panel en vez de mostrar una pantalla vacía.
 *
 * El superadministrador entra en modo lectura (ve todos los hilos del centro
 * pero no escribe ni archiva), así que también pasa.
 */
export const chatGuard: CanActivateFn = () => {
  const permissions = inject(PermissionsService);
  const tenantCtx = inject(TenantContextService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Igual que `adminGuard`: sin esperar a que cargue el centro, un refresco en
  // frío lee una membresía vacía y rebota al panel.
  return afterTenantLoaded<boolean | UrlTree>(authService, () => {
    if (tenantCtx.isSuperAdmin()) return true;

    const isStaff = tenantCtx.currentMembership()?.userType === 'STAFF';
    if (isStaff && permissions.has('MANAGE_CHAT')) return true;

    return router.createUrlTree(['/dashboard']);
  });
};
