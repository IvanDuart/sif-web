import { Injectable, Injector, inject } from '@angular/core';

import { BrandingStore } from '../../../core/branding/branding.store';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import type { OpenerRequirement } from '../mascot/fill/descriptor';

/**
 * Qué tiene activado el centro, en lo que afecta a qué formularios existen.
 *
 * Un formulario que el centro no tiene no se puede prometer: en cuanto el
 * navegador dice que un formulario cubre una escritura, el backend retira esa
 * escritura de servidor. Si el formulario luego no aparece, la mascota se queda
 * sin ningún camino.
 */
@Injectable({ providedIn: 'root' })
export class AssistantFeaturesService {
  // Se resuelven al preguntar, no al construir: este servicio lo inyectan el
  // catálogo y el contexto de página, y sacar el tenant en el constructor
  // arrastraría la autenticación a todo lo que los use.
  private readonly injector = inject(Injector);

  has(requirement: OpenerRequirement | undefined): boolean {
    switch (requirement) {
      case undefined:
        return true;
      case 'exchanges':
        // El editor de raciones vive dentro de la comida desplegada, y sólo se
        // despliega en modo BEDCA; además el centro tiene que usar intercambios.
        // Sin poder leerlo, no se promete: prometer de más deja a la mascota sin camino.
        try {
          const tenant = this.injector.get(TenantContextService);
          const branding = this.injector.get(BrandingStore);
          return tenant.tenantProfile?.()?.preferences?.exchangeGroupsEnabled === true && branding.isBedcaMode?.() === true;
        } catch {
          return false;
        }
    }
  }
}
