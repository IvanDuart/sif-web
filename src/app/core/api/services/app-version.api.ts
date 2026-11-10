import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigService } from '../../config/config.service';
import { SILENT_ERROR } from '../../http/http-context.tokens';
import { AppVersionDto, UpdateAppVersionRequest } from '../models/app-version.model';

/**
 * Control de versión de la app móvil (Flutter).
 *
 * El `GET` es público —lo consume la propia app al arrancar— y el `PUT` exige
 * `MANAGE_APP_VERSION` (o ser superadmin). Va en modo silencioso porque cada
 * pantalla decide cómo contar el fallo: el diálogo bloquea el formulario y el
 * dashboard puede cargar sin la versión.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.configService.apiUrl}/v1/app/version`;
  }

  private get quietContext(): HttpContext {
    return new HttpContext().set(SILENT_ERROR, true);
  }

  getVersion(): Observable<AppVersionDto> {
    return this.http.get<AppVersionDto>(this.baseUrl, { context: this.quietContext });
  }

  updateVersion(request: UpdateAppVersionRequest): Observable<AppVersionDto> {
    return this.http.put<AppVersionDto>(this.baseUrl, request, { context: this.quietContext });
  }
}
