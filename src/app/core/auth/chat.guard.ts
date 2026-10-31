import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { PermissionsService } from '../permissions/permissions.service';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * El chat 1:1 es una herramienta del nutricionista: sólo STAFF con
 * `MANAGE_CHAT`. Los pacientes lo usan desde la app móvil, así que un acceso
 * directo por URL vuelve al panel en vez de mostrar una pantalla vacía.
 */
export const chatGuard: CanActivateFn = () => {
  const permissions = inject(PermissionsService);
  const tenantCtx = inject(TenantContextService);
  const router = inject(Router);

  const isStaff = tenantCtx.currentMembership()?.userType === 'STAFF';
  if (isStaff && permissions.has('MANAGE_CHAT')) return true;

  return router.createUrlTree(['/dashboard']);
};
