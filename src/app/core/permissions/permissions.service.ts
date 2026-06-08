import { Injectable, computed, inject } from '@angular/core';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private tenantCtx = inject(TenantContextService);

  // Expose as a signal
  permissions = computed(() => this.tenantCtx.permissions());

  has(permissionCode: string): boolean {
    return this.permissions().has(permissionCode);
  }
}
