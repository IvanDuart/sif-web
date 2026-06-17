import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppUserDto, UserType, UserTenantProfileDto, UpdateUserTenantProfileRequest } from '../models/user.model';
import { environment } from '../../../../environments/environment';

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
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);

  getUsersByTenant(tenantId: string): Observable<AppUserDto[]> {
    return this.http.get<AppUserDto[]>(`${this.baseUrl}/tenant/${tenantId}/users`);
  }

  getUsersByTenantAndType(tenantId: string, userType: UserType): Observable<AppUserDto[]> {
    return this.http.get<AppUserDto[]>(`${this.baseUrl}/tenant/${tenantId}/users/by-type/${userType}`);
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
