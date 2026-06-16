import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BodyMeasurementDto, CreateBodyMeasurementRequest, MeasurementHistoryDto } from '../models/body-measurement.model';
import { Page } from '../models/page.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BodyMeasurementService {
  private readonly baseUrl = environment.apiBaseUrl;
  private http = inject(HttpClient);

  private endpoint(tenantId: string, userId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/users/${userId}/measurements`;
  }

  list(
    tenantId: string,
    userId: string,
    page = 0,
    size = 20,
    sort: string[] = ['measuredAt,desc']
  ): Observable<Page<BodyMeasurementDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    sort.forEach(s => params = params.append('sort', s));
    return this.http.get<Page<BodyMeasurementDto>>(this.endpoint(tenantId, userId), { params });
  }

  getLatest(tenantId: string, userId: string): Observable<BodyMeasurementDto | null> {
    return this.http.get<BodyMeasurementDto>(
      `${this.endpoint(tenantId, userId)}/latest`,
      { observe: 'response' }
    ).pipe(
      map((response: HttpResponse<BodyMeasurementDto>) => {
        if (response.status === 204) return null;
        return response.body;
      })
    );
  }

  getEvolution(tenantId: string, userId: string): Observable<MeasurementHistoryDto> {
    return this.http.get<MeasurementHistoryDto>(`${this.endpoint(tenantId, userId)}/evolution`);
  }

  create(tenantId: string, userId: string, request: CreateBodyMeasurementRequest): Observable<BodyMeasurementDto> {
    return this.http.post<BodyMeasurementDto>(this.endpoint(tenantId, userId), request);
  }

  delete(tenantId: string, userId: string, measurementId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId, userId)}/${measurementId}`);
  }
}
