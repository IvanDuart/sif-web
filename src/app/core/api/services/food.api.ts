import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FoodDto, FoodSearchResultDto, NutrientDto, NutrientMap } from '../models/food.model';
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
    );
  }

  /** Catálogo de nutrientes (código, nombre, unidad, grupo). Pedirlo una vez y cachear. */
  listNutrients(tenantId: string): Observable<NutrientDto[]> {
    return this.http.get<NutrientDto[]>(`${this.baseUrl}/tenant/${tenantId}/food/nutrient`);
  }

  /** Crea un alimento propio del centro. Devuelve el mismo `FoodDto` que el buscador. */
  create(tenantId: string, request: CreateFoodRequest): Observable<FoodDto> {
    return this.http.post<FoodDto>(`${this.baseUrl}/tenant/${tenantId}/food`, request);
  }
}
