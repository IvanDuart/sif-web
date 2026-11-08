import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Meal, MealItem } from '../models/meal.model';
import { DEFAULT_PAGE_SIZE, Page } from '../models/page.model';
import {
  ANY_VERSION,
  Versioned,
  etagOf,
  ifMatchHeaders,
} from '../models/versioned.model';
import { idempotencyHeaders } from '../idempotency';
import { normalizeMeal } from '../models/meal-normalizers';
import { toApiDayOfWeek, toApiMealType } from '../models/meal-enums';
import { ConfigService } from '../../config/config.service';
import { EtagStore } from './etag-store';

export interface MealItemRequest {
  foodId: string;
  /** Gramos de porción comestible, > 0. */
  quantityG: number;
  notes?: string | null;
  /** Si va null, el servidor usa la posición en el array. */
  sortOrder?: number | null;
}

export interface CreateMealRequest {
  menuId?: string;
  dayOfWeek?: string;
  mealType?: string;
  /** Obligatoria si no se mandan `items`. Sin ninguna de las dos → 400. */
  description?: string;
  items?: MealItemRequest[];
  /** Receta a asignar; convive con el texto libre y con BEDCA. */
  recipeId?: string | null;
  /** Personas/raciones. Si falta, se usa el de la receta. */
  servings?: number | null;
}

/**
 * Todos los campos son opcionales: lo que no se manda no se toca. Dos avisos:
 * - `items` **reemplaza la lista completa**, así que siempre va entera.
 * - si se mandan `items`, no mandar `description`: el servidor la regenera y
 *   sobrescribiría el texto enviado.
 */
export interface UpdateMealRequest {
  description?: string;
  items?: MealItemRequest[];
  dayOfWeek?: string;
  mealType?: string;
  /** Receta a asignar a la comida. */
  recipeId?: string | null;
  /** `true` para desvincular la receta. */
  clearRecipe?: boolean;
  /** Personas/raciones. */
  servings?: number | null;
}

/**
 * Convierte los ítems que devuelve el servidor en ítems de petición. El
 * `sortOrder` se recalcula desde la posición: es lo que hace falta tanto al
 * reordenar como al copiar una comida a otro sitio.
 */
export function toMealItemRequests(items: readonly MealItem[]): MealItemRequest[] {
  return items.map((item, index) => ({
    foodId: item.food.id,
    quantityG: item.quantityG,
    notes: item.notes ?? null,
    sortOrder: index,
  }));
}

@Injectable({ providedIn: 'root' })
export class MealService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);
  private readonly etagStore = inject(EtagStore);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/meal`;
  }

  /** Clave de caché del `ETag` por recurso versionado. */
  private etagKey(tenantId: string, id: string): string {
    return `meal:${tenantId}:${id}`;
  }

  search(
    tenantId: string,
    page = 0,
    size = 10,
    sort: string[] = ['dayOfWeek,ASC'],
    menuId?: string,
    dayOfWeek?: string,
    mealType?: string
  ): Observable<Page<Meal>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    sort.forEach(s => params = params.append('sort', s));
    
    if (menuId) params = params.set('menuId', menuId);
    if (dayOfWeek) params = params.set('dayOfWeek', dayOfWeek);
    if (mealType) params = params.set('mealType', mealType);

    return this.http.get<Page<Meal>>(this.endpoint(tenantId), { params }).pipe(
      map(result => ({ ...result, content: (result.content ?? []).map(normalizeMeal) }))
    );
  }

  /** Crea una comida; acepta `Idempotency-Key` para reintentos seguros. */
  create(tenantId: string, request: CreateMealRequest, idempotencyKey?: string): Observable<Meal> {
    return this.http.post<Meal>(this.endpoint(tenantId), this.toApiRequest(request), {
      headers: idempotencyHeaders(idempotencyKey),
    }).pipe(map(normalizeMeal));
  }

  /**
   * Detalle de la comida. Guarda el `ETag` recibido para reutilizarlo en
   * `update` como `If-Match` sin un `GET` adicional.
   */
  getById(tenantId: string, id: string): Observable<Meal> {
    return this.getByIdVersioned(tenantId, id).pipe(map(versioned => versioned.data));
  }

  /** Detalle junto a su `ETag`, para gestión explícita de la versión. */
  getByIdVersioned(tenantId: string, id: string): Observable<Versioned<Meal>> {
    return this.http
      .get<Meal>(`${this.endpoint(tenantId)}/${id}`, { observe: 'response' })
      .pipe(
        tap((response: HttpResponse<Meal>) =>
          this.etagStore.set(this.etagKey(tenantId, id), etagOf(response.headers))
        ),
        map((response: HttpResponse<Meal>) => ({
          data: normalizeMeal(response.body as Meal),
          etag: etagOf(response.headers),
        }))
      );
  }

  delete(tenantId: string, id: string): Observable<void> {
    this.etagStore.clear(this.etagKey(tenantId, id));
    return this.http.delete<void>(`${this.endpoint(tenantId)}/${id}`);
  }

  /**
   * Reemplaza la comida con control de concurrencia optimista.
   *
   * Envía `If-Match` con el `ETag` conocido (o lo obtiene con un `GET` previo).
   * Un `409`/`428` se propaga como error: significa que otro profesional guardó
   * antes y hay que recargar antes de reintentar.
   */
  update(tenantId: string, id: string, request: UpdateMealRequest): Observable<Meal> {
    return this.ensureEtag(tenantId, id).pipe(
      switchMap(etag =>
        this.http.put<Meal>(`${this.endpoint(tenantId)}/${id}`, this.toApiRequest(request), {
          headers: ifMatchHeaders(etag),
          observe: 'response',
        })
      ),
      tap((response: HttpResponse<Meal>) =>
        this.etagStore.set(this.etagKey(tenantId, id), etagOf(response.headers))
      ),
      map((response: HttpResponse<Meal>) => normalizeMeal(response.body as Meal))
    );
  }

  /**
   * Comidas del menú. Ahora devuelve `PagedModel`; el backend pagina de 50 en
   * 50 y ordena por `dayOfWeek`. Para menús grandes hay que pedir más páginas.
   */
  getByMenuId(
    tenantId: string,
    menuId: string,
    page = 0,
    size = DEFAULT_PAGE_SIZE,
    sort: string[] = ['dayOfWeek,ASC']
  ): Observable<Page<Meal>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(value => params = params.append('sort', value));

    return this.http.get<Page<Meal>>(
      `${this.endpoint(tenantId)}/menu/${menuId}`,
      { params }
    ).pipe(
      map(result => ({ ...result, content: (result.content ?? []).map(normalizeMeal) }))
    );
  }

  /** Convierte los enums legacy de la UI a los nombres ingleses de la API (T6). */
  private toApiRequest<T extends CreateMealRequest | UpdateMealRequest>(request: T): T {
    return {
      ...request,
      dayOfWeek: toApiDayOfWeek(request.dayOfWeek),
      mealType: toApiMealType(request.mealType),
    };
  }

  /** `If-Match` a usar: el último `ETag` cacheado o un `GET` previo. */
  private ensureEtag(tenantId: string, id: string): Observable<string> {
    const key = this.etagKey(tenantId, id);
    const cached = this.etagStore.get(key);
    if (cached) return of(cached);

    return this.http
      .get<Meal>(`${this.endpoint(tenantId)}/${id}`, { observe: 'response' })
      .pipe(
        map((response: HttpResponse<Meal>) => {
          const etag = etagOf(response.headers);
          this.etagStore.set(key, etag);
          // Sin ETag (proxy que lo filtra) se usa `*`, aceptado por el backend.
          return etag ?? ANY_VERSION;
        })
      );
  }
}
