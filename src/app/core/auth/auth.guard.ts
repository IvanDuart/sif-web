import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
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

    return true;
  }
);
