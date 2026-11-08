import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  InstantiateRecipeRequest,
  RecipeDto,
  RecipeListQuery,
  RecipeRequest,
} from '../models/recipe.model';
import { DEFAULT_PAGE_SIZE, Page } from '../models/page.model';
import { ConfigService } from '../../config/config.service';

/**
 * Recetario del centro (`/tenant/{tenantId}/recipes`).
 *
 * El listado incluye las recetas públicas de plataforma además de las propias.
 * Las públicas son de solo lectura: `update`/`delete` sobre ellas devuelve
 * `403`, y para personalizarlas hay que clonarlas.
 */
@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/recipes`;
  }

  /** Listado paginado; `scope=ALL` (por defecto) mezcla públicas y propias. */
  list(tenantId: string, query: RecipeListQuery = {}): Observable<Page<RecipeDto>> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? DEFAULT_PAGE_SIZE));

    if (query.name) params = params.set('name', query.name);
    if (query.scope) params = params.set('scope', query.scope);
    (query.sort ?? ['name,DESC']).forEach((sort) => (params = params.append('sort', sort)));

    return this.http.get<Page<RecipeDto>>(this.endpoint(tenantId), { params });
  }

  getById(tenantId: string, recipeId: string): Observable<RecipeDto> {
    return this.http.get<RecipeDto>(`${this.endpoint(tenantId)}/${recipeId}`);
  }

  create(tenantId: string, request: RecipeRequest): Observable<RecipeDto> {
    return this.http.post<RecipeDto>(this.endpoint(tenantId), request);
  }

  update(tenantId: string, recipeId: string, request: RecipeRequest): Observable<RecipeDto> {
    return this.http.put<RecipeDto>(`${this.endpoint(tenantId)}/${recipeId}`, request);
  }

  delete(tenantId: string, recipeId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId)}/${recipeId}`);
  }

  /** Clona una receta (pública o propia) como receta nueva del centro. */
  clone(tenantId: string, recipeId: string): Observable<RecipeDto> {
    return this.http.post<RecipeDto>(`${this.endpoint(tenantId)}/${recipeId}/clone`, {});
  }

  /** Inyecta los ingredientes de la receta en la comida indicada. */
  instantiate(tenantId: string, recipeId: string, mealId: string): Observable<void> {
    const request: InstantiateRecipeRequest = { mealId };
    return this.http.post<void>(`${this.endpoint(tenantId)}/${recipeId}/instantiate`, request);
  }

  /**
   * Sube la imagen de la receta a MinIO y devuelve la receta con las URLs
   * prefirmadas actualizadas.
   *
   * El nombre del campo multipart es `file` (el contrato del backend lo declara
   * así con `@RequestPart("file")`, aunque `API_CONTRACT.md` diga `image`).
   */
  uploadImage(
    tenantId: string,
    recipeId: string,
    file: Blob,
    cover = false
  ): Observable<RecipeDto> {
    const form = new FormData();
    form.append('file', file, file instanceof File ? file.name : 'recipe-image');
    const params = new HttpParams().set('cover', String(cover));
    return this.http.post<RecipeDto>(
      `${this.endpoint(tenantId)}/${recipeId}/images`,
      form,
      { params }
    );
  }

  /** Importa recetas desde un CSV o un array JSON. */
  importRecipes(tenantId: string, file: Blob): Observable<RecipeDto[]> {
    const form = new FormData();
    form.append('file', file, file instanceof File ? file.name : 'recipes.csv');
    return this.http.post<RecipeDto[]>(`${this.endpoint(tenantId)}/import`, form);
  }

  /** Solo las recetas propias del centro (sin las públicas). */
  listTenant(tenantId: string, page = 0, size = DEFAULT_PAGE_SIZE): Observable<Page<RecipeDto>> {
    return this.list(tenantId, { scope: 'TENANT', page, size });
  }

  /** Solo la biblioteca pública de plataforma. */
  listPublic(tenantId: string, page = 0, size = DEFAULT_PAGE_SIZE): Observable<Page<RecipeDto>> {
    return this.list(tenantId, { scope: 'PUBLIC', page, size });
  }
}
