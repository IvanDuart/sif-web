import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppUserDto } from '../models/user.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly baseUrl = environment.apiBaseUrl;
  private http = inject(HttpClient);

  getLoggedUser(): Observable<AppUserDto> {
    return this.http.get<AppUserDto>(`${this.baseUrl}/users/me`);
  }
}
