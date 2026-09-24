import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppointmentDto, CreateAppointmentRequest, UpdateAppointmentStatusRequest, RescheduleAppointmentRequest, NutritionistPatientDto, AppointmentMetricsDto, AppointmentMetricsQuery } from '../models/appointment.model';
import { ConfigService } from '../../config/config.service';
import { SILENT_ERROR } from '../../http/error.interceptor';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/appointments`;
  }

  create(tenantId: string, request: CreateAppointmentRequest): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(this.endpoint(tenantId), request, {
      // Errors are surfaced inline (and may trigger the overlap confirm dialog).
      context: new HttpContext().set(SILENT_ERROR, true)
    });
  }

  reschedule(tenantId: string, appointmentId: string, request: RescheduleAppointmentRequest): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.endpoint(tenantId)}/${appointmentId}`, request, {
      context: new HttpContext().set(SILENT_ERROR, true)
    });
  }

  getByNutritionist(
    tenantId: string,
    nutritionistId: string,
    from?: string,
    to?: string,
    status?: string
  ): Observable<AppointmentDto[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (status) params = params.set('status', status);
    return this.http.get<AppointmentDto[]>(
      `${this.endpoint(tenantId)}/nutritionist/${nutritionistId}`,
      { params }
    );
  }

  getByPatient(
    tenantId: string,
    patientId: string,
    from?: string,
    to?: string,
    status?: string
  ): Observable<AppointmentDto[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (status) params = params.set('status', status);
    return this.http.get<AppointmentDto[]>(
      `${this.endpoint(tenantId)}/patient/${patientId}`,
      { params }
    );
  }

  updateStatus(
    tenantId: string,
    appointmentId: string,
    request: UpdateAppointmentStatusRequest
  ): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(
      `${this.endpoint(tenantId)}/${appointmentId}/status`,
      request
    );
  }

  getRevenue(
    tenantId: string,
    startDate: string,
    endDate: string,
    nutritionistId?: string
  ): Observable<number> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    if (nutritionistId) params = params.set('nutritionistId', nutritionistId);
    return this.http.get<number>(`${this.endpoint(tenantId)}/revenue`, { params });
  }

  getPatientsByNutritionist(
    tenantId: string,
    nutritionistId: string
  ): Observable<NutritionistPatientDto[]> {
    return this.http.get<NutritionistPatientDto[]>(
      `${this.endpoint(tenantId)}/nutritionist/${nutritionistId}/patients`
    );
  }

  /**
   * Panel agregado de métricas del centro en una sola llamada.
   * Requiere `VIEW_REVENUE`. `nutritionistId` solo se respeta con
   * `MANAGE_TENANT`; sin él el backend devuelve solo los datos propios y
   * `byNutritionist`/`byServiceType` vacíos.
   */
  getMetrics(
    tenantId: string,
    query: AppointmentMetricsQuery
  ): Observable<AppointmentMetricsDto> {
    let params = new HttpParams()
      .set('from', query.from)
      .set('to', query.to);
    if (query.nutritionistId) params = params.set('nutritionistId', query.nutritionistId);
    if (query.granularity) params = params.set('granularity', query.granularity);
    if (query.bucketCount != null) params = params.set('bucketCount', query.bucketCount.toString());
    return this.http.get<AppointmentMetricsDto>(
      `${this.endpoint(tenantId)}/metrics`,
      { params }
    );
  }
}
