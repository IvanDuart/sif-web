import { effect, inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import Keycloak from 'keycloak-js';
import { Router } from '@angular/router';
import { KEYCLOAK_EVENT_SIGNAL, KeycloakEventType, ReadyArgs, typeEventArgs } from 'keycloak-angular';
import { AppUserDto, TenantMembershipDto } from '../api/models/user.model';
import { firstValueFrom } from 'rxjs';
import {ConfigService} from '../config/config.service';

@Injectable({
  providedIn: 'root'
})
export class InitService {
  readonly #router = inject(Router);
  readonly #http = inject(HttpClient);
  readonly #keycloak = inject(Keycloak);
  readonly #authService = inject(AuthService);
  readonly #configService = inject(ConfigService);

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
        } else if (!globalThis.location.pathname.startsWith('/sandbox')) {
          this.#keycloak.login();
        }
      } else if (event.type === KeycloakEventType.AuthSuccess) {
        await this.postLoginActions();
      }
    });
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
