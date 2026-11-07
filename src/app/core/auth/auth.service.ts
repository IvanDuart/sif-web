import { Injectable, computed, effect, inject, signal, WritableSignal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Keycloak from 'keycloak-js';
import { AppUserDto, TenantMembershipDto, superAdminMembership } from '../api/models/user.model';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ConfigService } from '../config/config.service';

/**
 * Centro elegido por un superadministrador. Va aparte de `active-tenant`
 * porque, al no haber `memberships`, hay que poder rehacer la membresía
 * sintética entera (id y nombre) sin una llamada extra en el arranque.
 */
const SUPERADMIN_TENANT_KEY = 'superadmin-tenant';

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

  /**
   * Superadministrador de plataforma: pasa todos los chequeos de permiso del
   * backend en cualquier centro, pero no es miembro de ninguno. Por eso
   * `memberships` le llega vacío y nada de la UI puede derivarse de ahí.
   */
  readonly isSuperAdmin: Signal<boolean> = computed(() => this.user()?.superAdmin === true);

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
    this.persistTenant(tenant);
    globalThis.location.reload();
  }

  switchTenant(tenant: TenantMembershipDto): void {
    this.selectedTenant.set(tenant);
    this.persistTenant(tenant);
  }

  /**
   * Entra en un centro recargando la aplicación en `target`. Lo usa el
   * superadministrador desde la pantalla de selección: un `reload()` lo
   * devolvería a esa misma pantalla, y el estado por centro (marca, permisos,
   * SSE) sólo se rehace en el arranque.
   */
  enterTenant(tenant: TenantMembershipDto, target = '/dashboard'): void {
    this.selectedTenant.set(tenant);
    this.persistTenant(tenant);
    globalThis.location.assign(target);
  }

  private persistTenant(tenant: TenantMembershipDto): void {
    localStorage.setItem('active-tenant', tenant.tenantId);
    if (this.isSuperAdmin()) {
      localStorage.setItem(
        SUPERADMIN_TENANT_KEY,
        JSON.stringify({ tenantId: tenant.tenantId, tenantName: tenant.tenantName })
      );
    }
  }

  /** Rehace la membresía sintética del centro que el superadmin tenía abierto. */
  restoreSuperAdminTenant(): TenantMembershipDto | null {
    const raw = localStorage.getItem(SUPERADMIN_TENANT_KEY);
    if (!raw) return null;
    try {
      const stored = JSON.parse(raw) as { tenantId?: string; tenantName?: string };
      return stored.tenantId ? superAdminMembership(stored.tenantId, stored.tenantName ?? '') : null;
    } catch {
      localStorage.removeItem(SUPERADMIN_TENANT_KEY);
      return null;
    }
  }

  /** Suelta el centro abierto para volver a la pantalla de selección. */
  clearSuperAdminTenant(): void {
    localStorage.removeItem(SUPERADMIN_TENANT_KEY);
    localStorage.removeItem('active-tenant');
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
