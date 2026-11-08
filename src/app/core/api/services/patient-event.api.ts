import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PatientEventDto, CreatePatientEventRequest, UpdatePatientEventRequest } from '../models/patient-event.model';
import { DEFAULT_PAGE_SIZE, Page } from '../models/page.model';
import { ConfigService } from '../../config/config.service';

@Injectable({ providedIn: 'root' })
export class PatientEventService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  /**
   * Eventos del paciente en el rango. El listado es paginado (`PagedModel`,
   * 50 por defecto) desde la Fase 1.
   */
  getByPatient(
    tenantId: string,
    patientId: string,
    from?: string,
    to?: string,
    page = 0,
    size = DEFAULT_PAGE_SIZE,
    sort: string[] = ['startTime,ASC']
  ): Observable<Page<PatientEventDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(value => params = params.append('sort', value));
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);

    return this.http.get<Page<PatientEventDto>>(
      `${this.baseUrl}/tenant/${tenantId}/patients/${patientId}/events`,
      { params }
    );
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
