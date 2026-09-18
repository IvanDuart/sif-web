import { Injectable, computed, inject, signal } from '@angular/core';
import { TenantBrandingDto } from '../api/models/branding.model';
import { MenuCreationMode } from '../api/models/tenant.model';
import { NutrientDto } from '../api/models/food.model';
import { FoodService } from '../api/services/food.api';

/**
 * Caché en memoria del branding del tenant, rellenada por `brandingResolver`
 * antes de que el Shell renderice.
 *
 * Existe porque `GET /branding` se pedía desde cinco sitios distintos y la
 * respuesta del resolver se descartaba. Los consumidores leen de aquí.
 */
@Injectable({ providedIn: 'root' })
export class BrandingStore {
  private readonly foodService = inject(FoodService);

  readonly branding = signal<TenantBrandingDto | null>(null);

  readonly aiEnabled = computed(() => this.branding()?.aiEnabled === true);

  /** Ausente en la respuesta = `'MANUAL'`, que es el modo por defecto. */
  readonly menuCreationMode = computed<MenuCreationMode>(
    () => this.branding()?.menuCreationMode ?? 'MANUAL'
  );

  readonly isBedcaMode = computed(() => this.menuCreationMode() === 'BEDCA');

  /**
   * Catálogo de nutrientes, de donde salen etiquetas y unidades. Se pide una
   * sola vez por sesión: son 48 entradas que no cambian.
   */
  readonly nutrients = signal<NutrientDto[]>([]);

  private readonly nutrientsByCode = computed(
    () => new Map(this.nutrients().map(n => [n.code, n]))
  );

  private nutrientsRequested = false;

  setBranding(branding: TenantBrandingDto): void {
    this.branding.set(branding);
  }

  /** Idempotente: llamarlo desde varios componentes no multiplica la petición. */
  loadNutrients(tenantId: string): void {
    if (this.nutrientsRequested) return;
    this.nutrientsRequested = true;
    this.foodService.listNutrients(tenantId).subscribe({
      next: list => this.nutrients.set(list ?? []),
      error: () => {
        // Sin catálogo se cae a los códigos crudos; no merece molestar al usuario.
        this.nutrientsRequested = false;
      },
    });
  }

  /** Nombre del nutriente, o su código si el catálogo aún no ha llegado. */
  nutrientLabel(code: string): string {
    return this.nutrientsByCode().get(code)?.name ?? code;
  }

  nutrientUnit(code: string): string {
    return this.nutrientsByCode().get(code)?.unit ?? '';
  }
}
