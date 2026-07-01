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
        notify.error('No tienes permisos para esta acción', 'Acceso Denegado');
        router.navigate(['/not-authorized']);
      } else if (error.status === 404) {
        notify.show('El recurso solicitado no existe', { status: 'warning', label: 'No encontrado' });
      } else {
        const msg = error.error?.error || 'Ocurrió un error inesperado';
        notify.error(msg, 'Error');
      }
      return throwError(() => error);
    })
  );
};
