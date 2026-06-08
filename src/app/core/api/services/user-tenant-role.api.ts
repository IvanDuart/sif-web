import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppUserDto } from '../models/user.model';
import { environment } from '../../../../environments/environment';

export interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName?: string;
  roleCode: string;
}

export interface ChangeUserRoleRequest {
  roleCode: string;
}

@Injectable({ providedIn: 'root' })
export class UserTenantRoleService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getUsersByTenant(tenantId: string): Observable<AppUserDto[]> {
    return this.http.get<AppUserDto[]>(`${this.baseUrl}/tenant/${tenantId}/users`);
  }

  inviteUser(tenantId: string, request: InviteUserRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tenant/${tenantId}/users/invite`, request);
  }

  getUser(tenantId: string, userId: string): Observable<AppUserDto> {
    return this.http.get<AppUserDto>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}`);
  }

  revokeAccess(tenantId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}`);
  }

  changeRole(tenantId: string, userId: string, request: ChangeUserRoleRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/tenant/${tenantId}/users/${userId}/role`, request);
  }
}
