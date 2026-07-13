import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import Keycloak from 'keycloak-js';
import { Router } from '@angular/router';
import { NotificationService } from '../ui';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloak = inject(Keycloak);
  const notify = inject(NotificationService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        keycloak.updateToken(20).catch(() => {
          keycloak.login();
        });
      } else if (error.status === 403) {
        notify.error('Acceso Denegado: No tienes permisos para esta acción');
        router.navigate(['/not-authorized']);
      } else if (error.status === 404) {
        notify.warning('No encontrado: El recurso solicitado no existe');
      } else {
        const msg = error.error?.error || 'Ocurrió un error inesperado';
        notify.error(msg);
      }
      return throwError(() => error);
    })
  );
};
