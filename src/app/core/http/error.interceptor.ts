import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
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

/**
 * Opt out of the global 403 redirect. Pensado para funciones que tratan sus
 * propios 403 (p. ej. la mascota: «IA no habilitada», «falta consentimiento»)
 * y no deben expulsar al usuario de la pantalla.
 */
export const IGNORE_FORBIDDEN = new HttpContextToken<boolean>(() => false);

interface ProblemDetailBody {
  type?: unknown;
  title?: unknown;
  status?: unknown;
  detail?: unknown;
  instance?: unknown;
  code?: unknown;
  traceId?: unknown;
  fieldErrors?: unknown;
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

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        keycloak.updateToken(20).catch(() => {
          keycloak.login();
        });
      } else if (error.status === 403) {
        if (problemDetailCode(error) === 'error.clinical_status_read_only') {
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
