import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppointmentTypeDto, CreateAppointmentTypeRequest, UpdateAppointmentTypeRequest } from '../models/appointment-type.model';
import {ConfigService} from '../../config/config.service';

@Injectable({ providedIn: 'root' })
export class AppointmentTypeService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/appointment-types`;
  }

  getAll(tenantId: string, onlyActive = true): Observable<AppointmentTypeDto[]> {
    const params = new HttpParams().set('onlyActive', onlyActive.toString());
    return this.http.get<AppointmentTypeDto[]>(this.endpoint(tenantId), { params });
  }

  create(tenantId: string, request: CreateAppointmentTypeRequest): Observable<AppointmentTypeDto> {
    return this.http.post<AppointmentTypeDto>(this.endpoint(tenantId), request);
  }

  update(tenantId: string, typeId: string, request: UpdateAppointmentTypeRequest): Observable<AppointmentTypeDto> {
    return this.http.put<AppointmentTypeDto>(`${this.endpoint(tenantId)}/${typeId}`, request);
  }

  delete(tenantId: string, typeId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId)}/${typeId}`);
  }
}
