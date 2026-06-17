import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly authService = inject(AuthService);

  // The tenantId derived from selectedTenant
  currentTenantId = computed(() => this.authService.selectedTenant()?.tenantId ?? null);

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
