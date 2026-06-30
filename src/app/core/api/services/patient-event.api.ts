import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PatientEventDto, CreatePatientEventRequest, UpdatePatientEventRequest } from '../models/patient-event.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PatientEventService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);

  getByPatient(tenantId: string, patientId: string, from?: string, to?: string): Observable<PatientEventDto[]> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<PatientEventDto[]>(`${this.baseUrl}/tenant/${tenantId}/patients/${patientId}/events`, { params });
  }

  create(tenantId: string, patientId: string, request: CreatePatientEventRequest): Observable<PatientEventDto> {
    return this.http.post<PatientEventDto>(`${this.baseUrl}/tenant/${tenantId}/patients/${patientId}/events`, request);
  }

  update(tenantId: string, eventId: string, request: UpdatePatientEventRequest): Observable<PatientEventDto> {
    return this.http.put<PatientEventDto>(`${this.baseUrl}/tenant/${tenantId}/patient-events/${eventId}`, request);
  }

  delete(tenantId: string, eventId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenant/${tenantId}/patient-events/${eventId}`);
  }
}
