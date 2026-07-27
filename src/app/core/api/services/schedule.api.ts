import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ScheduleDto,
  CreateScheduleRequest,
  TenantScheduleAssignmentDto,
  CreateScheduleAssignmentRequest,
} from '../models/schedule.model';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/schedules`;
  }

  getAll(tenantId: string): Observable<ScheduleDto[]> {
    return this.http.get<ScheduleDto[]>(this.endpoint(tenantId));
  }

  getById(tenantId: string, scheduleId: string): Observable<ScheduleDto> {
    return this.http.get<ScheduleDto>(`${this.endpoint(tenantId)}/${scheduleId}`);
  }

  create(tenantId: string, request: CreateScheduleRequest): Observable<ScheduleDto> {
    return this.http.post<ScheduleDto>(this.endpoint(tenantId), request);
  }

  delete(tenantId: string, scheduleId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId)}/${scheduleId}`);
  }

  getAssignments(tenantId: string): Observable<TenantScheduleAssignmentDto[]> {
    return this.http.get<TenantScheduleAssignmentDto[]>(`${this.endpoint(tenantId)}/assignments`);
  }

  createAssignment(tenantId: string, request: CreateScheduleAssignmentRequest): Observable<TenantScheduleAssignmentDto> {
    return this.http.post<TenantScheduleAssignmentDto>(`${this.endpoint(tenantId)}/assignments`, request);
  }

  deleteAssignment(tenantId: string, assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId)}/assignments/${assignmentId}`);
  }
}
