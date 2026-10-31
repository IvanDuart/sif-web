import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ClinicalStatusChangeDto,
  ClinicalStatusChangeRequest,
  ClinicalStatusHistoryEntryDto,
} from '../models/user.model';
import { ConfigService } from '../../config/config.service';

/**
 * Estado clínico del paciente en un centro (P1). Es independiente del acceso
 * (`enabled`/Keycloak): los estados de solo lectura permiten login y lectura,
 * pero el backend rechaza cualquier escritura.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalStatusService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private endpoint(tenantId: string, userId: string): string {
    return `${this.configService.apiUrl}/tenant/${tenantId}/users/${userId}/clinical-status`;
  }

  update(
    tenantId: string,
    userId: string,
    request: ClinicalStatusChangeRequest
  ): Observable<ClinicalStatusChangeDto> {
    return this.http.patch<ClinicalStatusChangeDto>(this.endpoint(tenantId, userId), request);
  }

  history(tenantId: string, userId: string): Observable<ClinicalStatusHistoryEntryDto[]> {
    return this.http.get<ClinicalStatusHistoryEntryDto[]>(`${this.endpoint(tenantId, userId)}/history`);
  }
}
