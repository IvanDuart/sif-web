import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import type { AuthGuardData } from 'keycloak-angular';
import Keycloak from 'keycloak-js';
import { createAuthGuard } from 'keycloak-angular';
import { AuthService } from './auth.service';
import { filter, take } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

export const authGuard = createAuthGuard(
  async (
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _authData: AuthGuardData
  ): Promise<boolean | UrlTree> => {
    const keycloak = inject(Keycloak);
    const authService = inject(AuthService);
    // `inject()` debe resolverse antes del primer `await`: después ya no hay
    // contexto de inyección.
    const router = inject(Router);

    // 1. Force the user to log in if currently unauthenticated.
    if (!keycloak.authenticated) {
      await keycloak.login({
        redirectUri: globalThis.location.origin + state.url,
      });
      return false;
    }

    // 2. Wait for the tenant ensuring profile and tenant context are ready.
    await firstValueFrom(authService.isTenantLoaded$.pipe(
      filter(loaded => loaded),
      take(1)
    ));

    // 3. Un superadministrador no tiene centro por defecto: no es miembro de
    //    ninguno, así que hasta que elija uno no hay contexto de tenant con el
    //    que pintar nada.
    if (authService.isSuperAdmin() && !authService.selectedTenant()) {
      return router.parseUrl('/select-tenant');
    }

    return true;
  }
);
