import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppUserDto, UserType, UserTenantProfileDto, UpdateUserTenantProfileRequest, UserTenantProfileFixedMealsDto } from '../models/user.model';
import { Page } from '../models/page.model';
import {ConfigService} from '../../config/config.service';

export interface UserSearchParams {
  search?: string;
  /** Filtro por estado: `true` = activos, `false` = inactivos, omitido = todos. */
  enabled?: boolean;
  page?: number;
  size?: number;
  sort?: string[];
}

/** Resumen de una operación masiva de cambio de estado. */
export interface BulkOperationResult {
  requested: number;
  updated: number;
  failedIds: string[];
}

export interface UpdateUserRequest {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  heightCm?: number | null;
  gender?: string | null;
}

export interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName?: string;
  roleCode: string;
  phone?: string | null;
  birthDate?: string | null;
  heightCm?: number | null;
  gender?: string | null;
}

export interface ChangeUserRoleRequest {
  roleCode: string;
}

@Injectable({ providedIn: 'root' })
export class UserTenantRoleService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  getUsersByTenant(tenantId: string, params?: UserSearchParams): Observable<Page<AppUserDto>> {
    return this.http.get<Page<AppUserDto>>(`${this.baseUrl}/tenant/${tenantId}/users`, { params: this.buildParams(params) });
  }

  getUsersByTenantAndType(tenantId: string, userType: UserType, params?: UserSearchParams): Observable<Page<AppUserDto>> {
    return this.http.get<Page<AppUserDto>>(`${this.baseUrl}/tenant/${tenantId}/users/by-type/${userType}`, { params: this.buildParams(params) });
  }

  private buildParams(params?: UserSearchParams): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.enabled !== undefined) httpParams = httpParams.set('enabled', String(params.enabled));
    if (params.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params.size !== undefined) httpParams = httpParams.set('size', String(params.size));
    (params.sort || []).forEach(s => httpParams = httpParams.append('sort', s));
    return httpParams;
  }

  /**
   * Cambia el estado (`enabled`) de varios usuarios a la vez.
   * El backend procesa uno a uno y devuelve los que fallaron en `failedIds`.
   */
  bulkSetUserStatus(tenantId: string, userIds: string[], enabled: boolean): Observable<BulkOperationResult> {
    return this.http.patch<BulkOperationResult>(
      `${this.baseUrl}/tenant/${tenantId}/users/bulk/status`,
      { userIds, enabled }
    );
  }

  /** URL de exportación CSV del listado (mismos filtros y orden que la pantalla). */
  buildExportUrl(tenantId: string, userType: UserType, params?: UserSearchParams): string {
    const httpParams = this.buildParams(params).set('userType', userType);
    return `${this.baseUrl}/tenant/${tenantId}/users/export?${httpParams.toString()}`;
  }

  /** Descarga el CSV del listado como Blob. */
  exportUsersCsv(tenantId: string, userType: UserType, params?: UserSearchParams): Observable<Blob> {
    return this.http.get(this.buildExportUrl(tenantId, userType, params), { responseType: 'blob' });
  }

  inviteUser(tenantId: string, request: InviteUserRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tenant/${tenantId}/users/invite`, request);
  }

  getUser(tenantId: string, userId: string): Observable<AppUserDto> {
    return this.http.get<AppUserDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}`);
  }

  /**
   * Assign or change a patient's titular nutritionist (V45).
   * Pass `nutritionistId = null` to unassign.
   */
  assignNutritionist(tenantId: string, userId: string, nutritionistId: string | null): Observable<AppUserDto> {
    return this.http.put<AppUserDto>(
      `${this.baseUrl}/tenant/${tenantId}/users/${userId}/assigned-nutritionist`,
      { nutritionistId }
    );
  }

  updateUser(tenantId: string, userId: string, request: UpdateUserRequest): Observable<AppUserDto> {
    return this.http.put<AppUserDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}`, request);
  }

  revokeAccess(tenantId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}`);
  }

  setUserEnabled(tenantId: string, userId: string, enabled: boolean): Observable<AppUserDto> {
    return this.http.patch<AppUserDto>(
      `${this.baseUrl}/tenant/${tenantId}/users/${userId}/status`,
      null,
      { params: new HttpParams().set('enabled', String(enabled)) }
    );
  }

  sendResetPassword(tenantId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/reset-password`, {});
  }

  changeRole(tenantId: string, userId: string, request: ChangeUserRoleRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/role`, request);
  }

  getPatientProfile(tenantId: string, userId: string): Observable<UserTenantProfileDto> {
    return this.http.get<UserTenantProfileDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/profile`);
  }

  updatePatientProfile(tenantId: string, userId: string, request: UpdateUserTenantProfileRequest): Observable<UserTenantProfileDto> {
    return this.http.put<UserTenantProfileDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/profile`, request);
  }

  getPatientFixedMeals(tenantId: string, userId: string): Observable<UserTenantProfileFixedMealsDto> {
    return this.http.get<UserTenantProfileFixedMealsDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/profile/fixed-meals`);
  }
}
