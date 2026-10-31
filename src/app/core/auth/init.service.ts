import { effect, inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import Keycloak from 'keycloak-js';
import { Router } from '@angular/router';
import { KEYCLOAK_EVENT_SIGNAL, KeycloakEventType, ReadyArgs, typeEventArgs } from 'keycloak-angular';
import { AppUserDto, TenantMembershipDto } from '../api/models/user.model';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {ConfigService} from '../config/config.service';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InitService {
  readonly #router = inject(Router);
  readonly #http = inject(HttpClient);
  readonly #keycloak = inject(Keycloak);
  readonly #authService = inject(AuthService);
  readonly #configService = inject(ConfigService);
  readonly #transloco = inject(TranslocoService);

  private get baseUrl(): string {
    return this.#configService.apiUrl;
  }

  constructor() {
    const keycloakSignal = inject(KEYCLOAK_EVENT_SIGNAL);
    effect(async () => {
      const event = keycloakSignal();
      if (event.type === KeycloakEventType.Ready) {
        const isAuthenticated = typeEventArgs<ReadyArgs>(event.args);
        if (isAuthenticated) {
          await this.postLoginActions();
        } else if (!this.isSandboxPreview()) {
          this.#keycloak.login();
        }
      } else if (event.type === KeycloakEventType.AuthSuccess) {
        await this.postLoginActions();
      }
    });
  }

  /** El bypass de Keycloak de `/sandbox` sólo aplica en desarrollo. */
  private isSandboxPreview(): boolean {
    return !environment.production
      && globalThis.location.pathname.startsWith('/sandbox');
  }

  private async postLoginActions(): Promise<void> {
    try {
      const user = await this.getUserValidate();

      if (!user?.id) {
        console.error('User profile not found after login.');
        return;
      }

      this.#authService.user.set(user);
      this.setActiveTenant(user.memberships);
      await this.syncLocale();

      const currentPath = globalThis.location.pathname;
      if (currentPath === "/" || currentPath === "/login") {
        this.navigateSafe(['/dashboard'], true);
      }
    } catch (error) {
      console.error('Failed to validate user profile:', error);
    }
  }

  private async getUserValidate(): Promise<AppUserDto> {
    const url = `${this.baseUrl}/users/me`;
    return firstValueFrom(this.#http.get<AppUserDto>(url));
  }

  /**
   * Sincroniza la zona horaria y el idioma del dispositivo para que el backend
   * pueda localizar las notificaciones push. Un fallo aquí nunca debe bloquear
   * el login.
   */
  private async syncLocale(): Promise<void> {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
    const language = this.#transloco.getActiveLang() || 'es';
    try {
      await firstValueFrom(
        this.#http.patch(`${this.baseUrl}/users/me/locale`, { timezone, language })
      );
    } catch {
      // Sin locale el usuario puede seguir usando la aplicación.
    }
  }

  private setActiveTenant(memberships: TenantMembershipDto[]): void {
    if (memberships && memberships.length > 0) {
      const prevTenantId = localStorage.getItem("active-tenant");
      const activeTenant = memberships.find(({ tenantId }) => tenantId === prevTenantId) ?? memberships[0];
      this.#authService.selectedTenant.set(activeTenant);
    }
    this.#authService.isTenantLoaded$.next(true);
  }

  private navigateSafe(link?: readonly string[], replaceUrl = false): void {
    if (link?.length) {
      this.#router.navigate([...link], { replaceUrl });
    }
  }
}
