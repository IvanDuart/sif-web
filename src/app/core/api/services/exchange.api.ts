import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateExchangeEquivalentRequest,
  CreateExchangeGroupRequest,
  ExchangeEquivalentDto,
  ExchangeGroupDto,
  MealExchangeDto,
  SetMealExchangesRequest,
} from '../models/exchange.model';
import { ConfigService } from '../../config/config.service';

/**
 * Grupos de intercambio y raciones por comida.
 *
 * Todos los endpoints exigen `exchangeGroupsEnabled = true` en las preferencias
 * del centro; si está desactivado el backend responde `403`.
 */
@Injectable({ providedIn: 'root' })
export class ExchangeService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}`;
  }

  listGroups(tenantId: string): Observable<ExchangeGroupDto[]> {
    return this.http.get<ExchangeGroupDto[]>(`${this.endpoint(tenantId)}/exchange-groups`);
  }

  createGroup(tenantId: string, request: CreateExchangeGroupRequest): Observable<ExchangeGroupDto> {
    return this.http.post<ExchangeGroupDto>(`${this.endpoint(tenantId)}/exchange-groups`, request);
  }

  listEquivalents(tenantId: string, groupId: string): Observable<ExchangeEquivalentDto[]> {
    return this.http.get<ExchangeEquivalentDto[]>(
      `${this.endpoint(tenantId)}/exchange-groups/${groupId}/equivalents`
    );
  }

  createEquivalent(
    tenantId: string,
    groupId: string,
    request: CreateExchangeEquivalentRequest
  ): Observable<ExchangeEquivalentDto> {
    return this.http.post<ExchangeEquivalentDto>(
      `${this.endpoint(tenantId)}/exchange-groups/${groupId}/equivalents`,
      request
    );
  }

  getMealExchanges(tenantId: string, mealId: string): Observable<MealExchangeDto[]> {
    return this.http.get<MealExchangeDto[]>(
      `${this.endpoint(tenantId)}/meal/${mealId}/exchanges`
    );
  }

  /**
   * Reemplaza las raciones objetivo de la comida.
   * Con `syncItems` el backend reescribe también los gramos de los ingredientes.
   */
  setMealExchanges(
    tenantId: string,
    mealId: string,
    request: SetMealExchangesRequest,
    syncItems = true
  ): Observable<MealExchangeDto[]> {
    const params = new HttpParams().set('syncItems', String(syncItems));
    return this.http.put<MealExchangeDto[]>(
      `${this.endpoint(tenantId)}/meal/${mealId}/exchanges`,
      request,
      { params }
    );
  }
}
