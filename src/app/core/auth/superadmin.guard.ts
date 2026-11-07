import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import type { AuthGuardData } from 'keycloak-angular';
import Keycloak from 'keycloak-js';
import { createAuthGuard } from 'keycloak-angular';
import { filter, take } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Protege la pantalla de selección de centro del superadministrador.
 *
 * No puede usar `authGuard`: ése redirige a `/select-tenant` justo cuando no
 * hay centro activo, que es el caso en el que esta pantalla tiene que verse.
 * El bucle se rompe comprobando aquí el flag en vez del tenant.
 */
export const superAdminGuard = createAuthGuard(
  async (
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _authData: AuthGuardData
  ): Promise<boolean | UrlTree> => {
    const keycloak = inject(Keycloak);
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!keycloak.authenticated) {
      await keycloak.login({
        redirectUri: globalThis.location.origin + state.url,
      });
      return false;
    }

    await firstValueFrom(authService.isTenantLoaded$.pipe(
      filter(loaded => loaded),
      take(1)
    ));

    return authService.isSuperAdmin() ? true : router.parseUrl('/dashboard');
  }
);
