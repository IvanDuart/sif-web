import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import Keycloak from 'keycloak-js';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloak = inject(Keycloak);

  if (keycloak.authenticated && req.url.includes(environment.apiBaseUrl)) {
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
