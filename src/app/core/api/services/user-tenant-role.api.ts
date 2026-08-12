import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppUserDto, UserType, UserTenantProfileDto, UpdateUserTenantProfileRequest } from '../models/user.model';
import { Page } from '../models/page.model';
import {ConfigService} from '../../config/config.service';

export interface UserSearchParams {
  search?: string;
  page?: number;
  size?: number;
  sort?: string[];
}

export interface UpdateUserRequest {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  birthDate?: string | null;
  heightCm?: number | null;
  gender?: string | null;
}

export interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName?: string;
  roleCode: string;
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
    if (params.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params.size !== undefined) httpParams = httpParams.set('size', String(params.size));
    (params.sort || []).forEach(s => httpParams = httpParams.append('sort', s));
    return httpParams;
  }

  inviteUser(tenantId: string, request: InviteUserRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tenant/${tenantId}/users/invite`, request);
  }

  getUser(tenantId: string, userId: string): Observable<AppUserDto> {
    return this.http.get<AppUserDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}`);
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

  changeRole(tenantId: string, userId: string, request: ChangeUserRoleRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/role`, request);
  }

  getPatientProfile(tenantId: string, userId: string): Observable<UserTenantProfileDto> {
    return this.http.get<UserTenantProfileDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/profile`);
  }

  updatePatientProfile(tenantId: string, userId: string, request: UpdateUserTenantProfileRequest): Observable<UserTenantProfileDto> {
    return this.http.put<UserTenantProfileDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/profile`, request);
  }
}
