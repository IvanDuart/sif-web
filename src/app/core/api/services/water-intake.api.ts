import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WaterIntakeDto, UpdateWaterIntakeRequest } from '../models/water-intake.model';
import {ConfigService} from '../../config/config.service';

@Injectable({ providedIn: 'root' })
export class WaterIntakeService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  update(tenantId: string, userId: string, date: string, request: UpdateWaterIntakeRequest): Observable<WaterIntakeDto> {
    return this.http.put<WaterIntakeDto>(
      `${this.baseUrl}/tenant/${tenantId}/user/${userId}/water-intake/${date}`,
      request
    );
  }

  getHistory(tenantId: string, userId: string, startDate?: string, endDate?: string): Observable<WaterIntakeDto[]> {
    let params: Record<string, string> = {};
    if (startDate) params['startDate'] = startDate;
    if (endDate) params['endDate'] = endDate;

    return this.http.get<WaterIntakeDto[]>(
      `${this.baseUrl}/tenant/${tenantId}/user/${userId}/water-intake`,
      { params }
    );
  }

  delete(tenantId: string, userId: string, intakeId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/tenant/${tenantId}/user/${userId}/water-intake/${intakeId}`
    );
  }
}
