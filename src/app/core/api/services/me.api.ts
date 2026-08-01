import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppUserDto } from '../models/user.model';
import {ConfigService} from '../../config/config.service';

@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  getLoggedUser(): Observable<AppUserDto> {
    return this.http.get<AppUserDto>(`${this.baseUrl}/users/me`);
  }
}
