import { Injectable, computed, inject } from '@angular/core';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly tenantCtx = inject(TenantContextService);

  // Expose as a signal
  permissions = computed(() => this.tenantCtx.permissions());

  /** Superadministrador de plataforma: para la UI, todos los permisos. */
  isSuperAdmin = computed(() => this.tenantCtx.isSuperAdmin());

  /**
   * Siempre a través de `TenantContextService`: el conjunto de `permissions()`
   * viene de la membresía y un superadmin no tiene ninguna, así que leerlo
   * directamente lo dejaría fuera de todos los botones.
   */
  has(permissionCode: string): boolean {
    return this.tenantCtx.hasPermission(permissionCode);
  }
}
