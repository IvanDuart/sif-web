import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Menu, MenuPdfDownloadDto } from '../models/menu.model';
import { Meal } from '../models/meal.model';
import { MenuNutritionDto } from '../models/food.model';
import { DEFAULT_PAGE_SIZE, Page } from '../models/page.model';
import {
  ANY_VERSION,
  Versioned,
  etagOf,
  ifMatchHeaders,
} from '../models/versioned.model';
import { idempotencyHeaders } from '../idempotency';
import { normalizeMeal, normalizeMenu } from '../models/meal-normalizers';
import { toApiDayOfWeek } from '../models/meal-enums';
import { ConfigService } from '../../config/config.service';
import { EtagStore } from './etag-store';

export interface CreateMenuRequest {
  appUserId?: string;
  name?: string;
  isActive?: boolean;
}

export interface CopyDayRequest {
  from: string;
  to: string;
  /** `true` borra lo que hubiera en el destino; ausente o `false` añade. */
  overwrite?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);
  private readonly etagStore = inject(EtagStore);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/menu`;
  }

  /** Clave de caché del `ETag` por recurso versionado. */
  private etagKey(tenantId: string, id: string): string {
    return `menu:${tenantId}:${id}`;
  }

  search(
    tenantId: string,
    page = 0,
    size = 10,
    sort: string[] = ['name,ASC'],
    userId?: string,
    name?: string,
    isActive?: boolean
  ): Observable<Page<Menu>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    sort.forEach(s => params = params.append('sort', s));
    
    if (userId) params = params.set('userId', userId);
    if (name) params = params.set('name', name);
    if (isActive !== undefined) params = params.set('isActive', String(isActive));

    return this.http.get<Page<Menu>>(this.endpoint(tenantId), { params }).pipe(
      map(result => ({ ...result, content: (result.content ?? []).map(normalizeMenu) }))
    );
  }

  /**
   * Crea un menú. Admite `Idempotency-Key` para que un reintento (o un doble
   * clic) no duplique el menú: reutilizar la misma clave en cada reintento.
   */
  create(tenantId: string, request: CreateMenuRequest, idempotencyKey?: string): Observable<Menu> {
    return this.http.post<Menu>(this.endpoint(tenantId), request, {
      headers: idempotencyHeaders(idempotencyKey),
    }).pipe(map(normalizeMenu));
  }

  /**
   * Detalle del menú. Además de devolverlo, guarda el `ETag` recibido para que
   * `update` pueda enviarlo en `If-Match` sin un `GET` extra.
   */
  getById(tenantId: string, id: string): Observable<Menu> {
    return this.getByIdVersioned(tenantId, id).pipe(map(versioned => versioned.data));
  }

  /** Detalle junto a su `ETag`, para quien quiera gestionarlos explícitamente. */
  getByIdVersioned(tenantId: string, id: string): Observable<Versioned<Menu>> {
    return this.http
      .get<Menu>(`${this.endpoint(tenantId)}/${id}`, { observe: 'response' })
      .pipe(
        tap((response: HttpResponse<Menu>) =>
          this.etagStore.set(this.etagKey(tenantId, id), etagOf(response.headers))
        ),
        map((response: HttpResponse<Menu>) => ({
          data: normalizeMenu(response.body as Menu),
          etag: etagOf(response.headers),
        }))
      );
  }

  delete(tenantId: string, id: string): Observable<void> {
    this.etagStore.clear(this.etagKey(tenantId, id));
    return this.http.delete<void>(`${this.endpoint(tenantId)}/${id}`);
  }

  /**
   * Actualización parcial del menú con control de concurrencia optimista.
   *
   * Envía `If-Match` con el último `ETag` conocido; si no hay ninguno en caché
   * hace antes un `GET` para obtenerlo. `428` (sin versión) y `409` (versión
   * desfasada) se propagan como error para que la UI recargue y avise.
   */
  update(
    tenantId: string,
    id: string,
    request: { name?: string; isActive?: boolean; description?: string }
  ): Observable<Menu> {
    return this.ensureEtag(tenantId, id).pipe(
      switchMap(etag =>
        this.http.patch<Menu>(`${this.endpoint(tenantId)}/${id}`, request, {
          headers: ifMatchHeaders(etag),
          observe: 'response',
        })
      ),
      tap((response: HttpResponse<Menu>) =>
        this.etagStore.set(this.etagKey(tenantId, id), etagOf(response.headers))
      ),
      map((response: HttpResponse<Menu>) => normalizeMenu(response.body as Menu))
    );
  }

  searchByUser(
    tenantId: string,
    userId: string,
    page = 0,
    size = 10,
    sort: string[] = ['createdAt,DESC']
  ): Observable<Page<Menu>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    sort.forEach(s => params = params.append('sort', s));

    return this.http.get<Page<Menu>>(`${this.endpoint(tenantId)}/user/${userId}`, { params }).pipe(
      map(result => ({ ...result, content: (result.content ?? []).map(normalizeMenu) }))
    );
  }

  /**
   * Histórico de asignaciones del paciente. Ahora devuelve `PagedModel`; el
   * backend ordena por `assignedAt` descendente y pagina de 50 en 50.
   */
  history(
    tenantId: string,
    userId: string,
    page = 0,
    size = DEFAULT_PAGE_SIZE,
    sort: string[] = ['assignedAt,DESC']
  ): Observable<Page<Menu>> {
    let params = new HttpParams()
      .set('userId', userId)
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(value => params = params.append('sort', value));

    return this.http.get<Page<Menu>>(`${this.endpoint(tenantId)}/history`, { params }).pipe(
      map(result => ({ ...result, content: (result.content ?? []).map(normalizeMenu) }))
    );
  }

  /**
   * URL prefirmada del PDF. La descarga ya no devuelve bytes: hay que abrir
   * `url` (o usar `getPdfRedirectUrl` para un `302` directo a MinIO).
   */
  getPdf(tenantId: string, id: string): Observable<MenuPdfDownloadDto> {
    return this.http.get<MenuPdfDownloadDto>(`${this.endpoint(tenantId)}/${id}/pdf`);
  }

  /** URL del endpoint que responde `302` hacia MinIO, para abrir en una pestaña. */
  getPdfRedirectUrl(tenantId: string, id: string): string {
    return `${this.endpoint(tenantId)}/${id}/pdf?redirect=true`;
  }

  /**
   * Totales nutricionales por comida, por día y del menú. Fuente de verdad:
   * usar al abrir el menú y tras guardar, nunca en cada tecla.
   */
  getNutrition(tenantId: string, id: string): Observable<MenuNutritionDto> {
    return this.http.get<MenuNutritionDto>(
      `${this.endpoint(tenantId)}/${id}/nutrition`
    );
  }

  /** Clona las comidas de un día en otro. Devuelve solo las comidas creadas. */
  copyDay(tenantId: string, id: string, request: CopyDayRequest): Observable<Meal[]> {
    return this.http.post<Meal[]>(
      `${this.endpoint(tenantId)}/${id}/copy-day`,
      {
        ...request,
        from: toApiDayOfWeek(request.from),
        to: toApiDayOfWeek(request.to),
      }
    ).pipe(map(meals => meals.map(normalizeMeal)));
  }

  /** `If-Match` a usar: el último `ETag` cacheado o un `GET` previo. */
  private ensureEtag(tenantId: string, id: string): Observable<string> {
    const key = this.etagKey(tenantId, id);
    const cached = this.etagStore.get(key);
    if (cached) return of(cached);

    return this.http
      .get<Menu>(`${this.endpoint(tenantId)}/${id}`, { observe: 'response' })
      .pipe(
        map((response: HttpResponse<Menu>) => {
          const etag = etagOf(response.headers);
          this.etagStore.set(key, etag);
          // Sin ETag (proxy que lo filtra) se usa `*`, que el backend acepta
          // como «cualquier versión» para no bloquear el guardado.
          return etag ?? ANY_VERSION;
        })
      );
  }
}
