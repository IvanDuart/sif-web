import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import Keycloak from 'keycloak-js';
import { Router } from '@angular/router';
import { NotificationService } from '../ui';
import { TENANT_SUSPENDED_CODE } from '../api/models/billing.model';
import { BillingStatusService } from '../billing/billing-status.service';
import { IGNORE_FORBIDDEN, IGNORE_NOT_FOUND, SILENT_ERROR } from './http-context.tokens';

// Re-exportados desde `http-context.tokens.ts`: la definición vive allí para
// romper el ciclo de imports con los servicios de API, pero el resto de la app
// los sigue importando desde aquí.
export { IGNORE_NOT_FOUND, SILENT_ERROR, IGNORE_FORBIDDEN } from './http-context.tokens';

interface ProblemDetailBody {
  type?: unknown;
  title?: unknown;
  status?: unknown;
  detail?: unknown;
  instance?: unknown;
  code?: unknown;
  traceId?: unknown;
  fieldErrors?: unknown;
  renewalUrl?: unknown;
  error?: unknown;
}

function bodyOf(error: HttpErrorResponse): ProblemDetailBody | null {
  const body = error.error;
  if (!body || typeof body !== 'object') return null;
  return body as ProblemDetailBody;
}

/** Texto legible de un error: `ProblemDetail.detail` y, si falta, `title`/`error`. */
export function problemDetailMessage(error: HttpErrorResponse | null | undefined): string | null {
  if (!error) return null;

  const body = bodyOf(error);
  if (!body) {
    return typeof error.error === 'string' && error.error.length > 0 ? error.error : null;
  }

  for (const field of ['detail', 'title', 'error'] as const) {
    const value = body[field];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** Código estable del backend (`error.user_not_found`, `error.appointment_overlap`…). */
export function problemDetailCode(error: HttpErrorResponse | null | undefined): string | null {
  if (!error) return null;
  const body = bodyOf(error);
  if (!body) return null;
  const code = body.code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

/** URL de renovación que acompaña al `403 TENANT_SUSPENDED`. */
export function problemDetailRenewalUrl(error: HttpErrorResponse | null | undefined): string | null {
  if (!error) return null;
  const body = bodyOf(error);
  if (!body) return null;
  const url = body.renewalUrl;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

/** `traceId` del `ProblemDetail`, para mostrarlo en soporte o logs. */
export function problemDetailTraceId(error: HttpErrorResponse | null | undefined): string | null {
  if (!error) return null;
  const body = bodyOf(error);
  if (!body) return null;
  const traceId = body.traceId;
  return typeof traceId === 'string' && traceId.length > 0 ? traceId : null;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloak = inject(Keycloak);
  const notify = inject(NotificationService);
  const router = inject(Router);
  const transloco = inject(TranslocoService);
  const billing = inject(BillingStatusService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        keycloak.updateToken(20).catch(() => {
          keycloak.login();
        });
      } else if (error.status === 403) {
        if (problemDetailCode(error) === TENANT_SUSPENDED_CODE) {
          // La suspensión por impago no es un problema de permisos: ni toast
          // genérico, ni /not-authorized, ni cerrar sesión. El centro va a su
          // pantalla de pago, que es la única que sigue respondiendo.
          billing.markSuspended(problemDetailRenewalUrl(error));
          router.navigate(['/billing']);
        } else if (problemDetailCode(error) === 'error.clinical_status_read_only') {
          notify.error(transloco.translate('errors.clinical_status_read_only'));
        } else if (!req.context.get(IGNORE_FORBIDDEN)) {
          notify.error(transloco.translate('errors.forbidden'));
          router.navigate(['/not-authorized']);
        }
      } else if (error.status === 404) {
        if (!req.context.get(IGNORE_NOT_FOUND)) {
          notify.warning(transloco.translate('errors.not_found'));
        }
      } else if (!req.context.get(SILENT_ERROR)) {
        notify.error(problemDetailMessage(error) ?? transloco.translate('errors.unexpected'));
      }
      return throwError(() => error);
    })
  );
};
