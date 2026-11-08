import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FoodDto, FoodSearchResultDto, NutrientDto, NutrientMap } from '../models/food.model';
import { DEFAULT_PAGE_SIZE, Page } from '../models/page.model';
import { normalizeRecipe } from '../models/meal-normalizers';
import { map } from 'rxjs/operators';
import { ConfigService } from '../../config/config.service';

export interface CreateFoodRequest {
  name: string;
  foodGroup?: string;
  /** `ENERC_KCAL` es obligatorio; el resto de códigos son opcionales. */
  nutrients: NutrientMap;
}

@Injectable({ providedIn: 'root' })
export class FoodService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  /**
   * Búsqueda difusa sobre BEDCA + alimentos del centro + recetas. Tolera erratas
   * y acentos (`arrz` → Arroz), así que no hay que normalizar en el cliente.
   * Máximo 20 alimentos y 10 recetas, sin paginación.
   */
  search(tenantId: string, q: string): Observable<FoodSearchResultDto> {
    const params = new HttpParams().set('q', q);
    return this.http.get<FoodSearchResultDto>(
      `${this.baseUrl}/tenant/${tenantId}/food/search`,
      { params }
    ).pipe(map(result => ({
      ...result,
      recipes: (result.recipes ?? []).map(normalizeRecipe),
    })));
  }

  /**
   * Catálogo de nutrientes (código, nombre, unidad, grupo). Pedirlo una vez y
   * cachear. Está paginado (`PagedModel`, 50 por defecto): el catálogo completo
   * real es pequeño y suele caber en la primera página.
   */
  listNutrients(
    tenantId: string,
    page = 0,
    size = DEFAULT_PAGE_SIZE,
    sort: string[] = ['sortOrder,ASC']
  ): Observable<Page<NutrientDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(value => params = params.append('sort', value));

    return this.http.get<Page<NutrientDto>>(
      `${this.baseUrl}/tenant/${tenantId}/food/nutrient`,
      { params }
    );
  }

  /** Crea un alimento propio del centro. Devuelve el mismo `FoodDto` que el buscador. */
  create(tenantId: string, request: CreateFoodRequest): Observable<FoodDto> {
    return this.http.post<FoodDto>(`${this.baseUrl}/tenant/${tenantId}/food`, request);
  }
}
