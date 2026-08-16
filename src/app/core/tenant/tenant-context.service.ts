import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { TenantService } from '../api/services/tenant.api';
import { Tenant } from '../api/models/tenant.model';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);

  // The tenantId derived from selectedTenant
  currentTenantId = computed(() => this.authService.selectedTenant()?.tenantId ?? null);

  // Full tenant profile (fetched from API) for the active tenant
  tenantProfile = signal<Tenant | null>(null);

  constructor() {
    effect(() => {
      const id = this.currentTenantId();
      if (id) {
        this.tenantService.getProfile(id).subscribe((profile) => {
          this.tenantProfile.set(profile);
        });
      } else {
        this.tenantProfile.set(null);
      }
    });
  }

  isAdminTenant = computed(() => this.tenantProfile()?.adminTenant ?? false);

  currentMembership = computed(() => {
    const user = this.authService.user();
    const id = this.currentTenantId();
    if (!user || !id) return null;
    return user.memberships.find(m => m.tenantId === id) || null;
  });

  permissions = computed(() => {
    const membership = this.currentMembership();
    return new Set(membership?.permissions || []);
  });

  hasPermission(permissionCode: string): boolean {
    return this.permissions().has(permissionCode);
  }
}
