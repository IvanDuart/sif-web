import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HolidayDto, CreateHolidayRequest } from '../models/holiday.model';

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/holidays`;
  }

  getAll(tenantId: string): Observable<HolidayDto[]> {
    return this.http.get<HolidayDto[]>(this.endpoint(tenantId));
  }

  getById(tenantId: string, holidayId: string): Observable<HolidayDto> {
    return this.http.get<HolidayDto>(`${this.endpoint(tenantId)}/${holidayId}`);
  }

  create(tenantId: string, request: CreateHolidayRequest): Observable<HolidayDto> {
    return this.http.post<HolidayDto>(this.endpoint(tenantId), request);
  }

  delete(tenantId: string, holidayId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId)}/${holidayId}`);
  }

  loadFromNager(tenantId: string, year: number): Observable<void> {
    return this.http.post<void>(`${this.endpoint(tenantId)}/load-from-nager/${year}`, {});
  }
}
