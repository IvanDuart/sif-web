import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import Keycloak from 'keycloak-js';
import { Router } from '@angular/router';
import { NotificationService } from '../ui';

export const IGNORE_NOT_FOUND = new HttpContextToken<boolean>(() => false);

/**
 * Opt out of the global error toast for a request so the caller can present its
 * own UI (e.g. an inline form error or a confirm-and-retry dialog). Side effects
 * like token refresh (401) and redirects (403) still apply.
 */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

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
        if (!req.context.get(IGNORE_NOT_FOUND)) {
          notify.warning('No encontrado: El recurso solicitado no existe');
        }
      } else if (!req.context.get(SILENT_ERROR)) {
        const msg = error.error?.error || 'Ocurrió un error inesperado';
        notify.error(msg);
      }
      return throwError(() => error);
    })
  );
};
