import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import Keycloak from 'keycloak-js';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloak = inject(Keycloak);
  const messageService = inject(MessageService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        keycloak.updateToken(20).catch(() => {
          keycloak.login();
        });
      } else if (error.status === 403) {
        messageService.add({ severity: 'error', summary: 'Acceso Denegado', detail: 'No tienes permisos para esta acción' });
        router.navigate(['/not-authorized']);
      } else if (error.status === 404) {
        messageService.add({ severity: 'warn', summary: 'No encontrado', detail: 'El recurso solicitado no existe' });
      } else {
        const msg = error.error?.error || 'Ocurrió un error inesperado';
        messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
      return throwError(() => error);
    })
  );
};
