import { Injectable, computed, inject, signal } from '@angular/core';
import { TenantBrandingDto } from '../api/models/branding.model';
import { MenuCreationMode, NutrientDisplayMode } from '../api/models/tenant.model';
import { NutrientDto } from '../api/models/food.model';
import { FoodService } from '../api/services/food.api';
import { TenantContextService } from '../tenant/tenant-context.service';

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
  private readonly tenantCtx = inject(TenantContextService);

  readonly branding = signal<TenantBrandingDto | null>(null);

  readonly aiEnabled = computed(() => this.branding()?.aiEnabled === true);

  /** Ausente en la respuesta = `'MANUAL'`, que es el modo por defecto. */
  readonly menuCreationMode = computed<MenuCreationMode>(
    () => this.branding()?.menuCreationMode ?? 'MANUAL'
  );

  readonly isBedcaMode = computed(() => this.menuCreationMode() === 'BEDCA');

  /**
   * Nivel de detalle nutricional que el centro permite mostrar (P2). Vive en
   * `TenantPreferences`, así que se lee del perfil del tenant y no del endpoint
   * público de branding (que no incluye `preferences`).
   */
  readonly nutrientDisplayMode = computed<NutrientDisplayMode>(
    () => this.tenantCtx.tenantProfile()?.preferences?.nutrient_display_mode ?? 'HIDDEN'
  );

  readonly showNutrition = computed(() => this.nutrientDisplayMode() !== 'HIDDEN');

  /** Códigos visibles: `[]` en `HIDDEN`, lista en `MACROS`, `null` = todos en `FULL`. */
  readonly visibleNutrientCodes = computed<readonly string[] | null>(() => {
    switch (this.nutrientDisplayMode()) {
      case 'HIDDEN':
        return [];
      case 'MACROS':
        return ['ENERC_KCAL', 'PROT', 'FAT', 'CHO', 'CHOCDF', 'FIBTG', 'SUGAR'];
      default:
        return null;
    }
  });

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
