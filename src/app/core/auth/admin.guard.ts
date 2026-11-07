import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { TenantService } from '../api/services/tenant.api';
import { afterTenantLoaded } from './tenant-ready';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tenantCtx = inject(TenantContextService);
  const tenantService = inject(TenantService);
  const router = inject(Router);

  const decide = (): Observable<boolean | UrlTree> | boolean | UrlTree => {
    const user = authService.user();
    if (!user) {
      return router.parseUrl('/not-authorized');
    }

    // El superadmin llega al panel de plataforma desde cualquier centro: no es
    // miembro de ninguno, así que no hay `MANAGE_TENANT` ni `adminTenant` de
    // los que tirar.
    if (user.superAdmin) {
      return tenantCtx.currentTenantId() ? true : router.parseUrl('/select-tenant');
    }

    const isAdmin = user.memberships.some(m => m.permissions.includes('MANAGE_TENANT'));
    if (!isAdmin) {
      return router.parseUrl('/not-authorized');
    }

    const tenantId = tenantCtx.currentTenantId();
    if (!tenantId) {
      return router.parseUrl('/not-authorized');
    }

    // El perfil puede no estar cargado todavía en el primer acceso.
    const profile$ = tenantCtx.tenantProfile()
      ? of(tenantCtx.tenantProfile())
      : tenantService.getProfile(tenantId);

    return profile$.pipe(map(profile => (profile?.adminTenant ? true : router.parseUrl('/not-authorized'))));
  };

  // La espera no es opcional: Angular lanza todos los `canActivate` a la vez,
  // así que en un refresco en frío esto decidiría con `user()` todavía a null
  // y expulsaría a `/not-authorized` aunque `authGuard` acabe diciendo que sí.
  return afterTenantLoaded<boolean | UrlTree>(authService, decide);
};
