import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { TenantService } from '../api/services/tenant.api';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tenantCtx = inject(TenantContextService);
  const tenantService = inject(TenantService);
  const router = inject(Router);

  const user = authService.user();
  if (!user) {
    return of(router.parseUrl('/not-authorized'));
  }

  const isAdmin = user.memberships.some(m => m.permissions.includes('MANAGE_TENANT'));
  if (!isAdmin) {
    return of(router.parseUrl('/not-authorized'));
  }

  const tenantId = tenantCtx.currentTenantId();
  if (!tenantId) {
    return of(router.parseUrl('/not-authorized'));
  }

  // Ensure tenant profile is loaded before evaluating isAdminTenant (async fetch on first load)
  const profile$ = tenantCtx.tenantProfile()
    ? of(tenantCtx.tenantProfile())
    : tenantService.getProfile(tenantId);

  return profile$.pipe(
    map(profile => {
      const isAdminTenant = !!profile?.adminTenant;
      return isAdminTenant ? true : router.parseUrl('/not-authorized');
    })
  );
};
