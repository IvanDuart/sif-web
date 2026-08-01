import { Injectable, computed, effect, inject, signal, WritableSignal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Keycloak from 'keycloak-js';
import { AppUserDto, TenantMembershipDto } from '../api/models/user.model';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ConfigService } from '../config/config.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly keycloak = inject(Keycloak);
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  // Signals
  readonly user: WritableSignal<AppUserDto | null> = signal<AppUserDto | null>(null);
  readonly selectedTenant: WritableSignal<TenantMembershipDto | null> = signal<TenantMembershipDto | null>(null);
  readonly isTenantLoaded$ = new BehaviorSubject<boolean>(false);

  readonly isLoggedIn: Signal<boolean> = computed(() => {
    return !!this.user();
  });

  constructor() {
    effect(() => {
      const tenant = this.selectedTenant();
      if (tenant) {
        localStorage.setItem('active-tenant', tenant.tenantId);
      }
      const currentUser = this.user();
      if (currentUser) {
        localStorage.setItem('active-user', currentUser.id);
      }
    });
  }

  logout() {
    this.keycloak.logout();
  }

  selectTenant(tenant: TenantMembershipDto) {
    this.selectedTenant.set(tenant);
    localStorage.setItem('active-tenant', tenant.tenantId);
    globalThis.location.reload();
  }

  switchTenant(tenant: TenantMembershipDto): void {
    this.selectedTenant.set(tenant);
    localStorage.setItem('active-tenant', tenant.tenantId);
  }

  async refreshUser(): Promise<AppUserDto | null> {
    try {
      const user = await firstValueFrom(this.http.get<AppUserDto>(`${this.configService.apiUrl}/users/me`));
      this.user.set(user);
      return user;
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
      return null;
    }
  }
}
