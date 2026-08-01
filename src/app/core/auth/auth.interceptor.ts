import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import Keycloak from 'keycloak-js';
import { from, switchMap, catchError, throwError } from 'rxjs';
import {ConfigService} from '../config/config.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloak = inject(Keycloak);
  const configService = inject(ConfigService);

  if (keycloak.authenticated && req.url.includes(configService.apiUrl)) {
    return from(keycloak.updateToken(30)).pipe(
      catchError((error) => {
        keycloak.login();
        return throwError(() => error);
      }),
      switchMap(() => {
        const reqWithToken = req.clone({
          setHeaders: {
            Authorization: `Bearer ${keycloak.token}`
          }
        });
        return next(reqWithToken);
      })
    );
  }

  return next(req);
};
