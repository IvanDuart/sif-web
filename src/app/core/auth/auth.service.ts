import { Injectable, computed, effect, inject, signal, WritableSignal, Signal } from '@angular/core';
import Keycloak from 'keycloak-js';
import { AppUserDto, TenantMembershipDto } from '../api/models/user.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private keycloak = inject(Keycloak);

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
}
