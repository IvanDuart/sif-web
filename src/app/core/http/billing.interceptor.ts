import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { BillingStatusService } from '../billing/billing-status.service';

/**
 * Vuelca las cabeceras `X-Billing-*` que acompañan a toda respuesta bajo
 * `/api/tenant/{tenantId}/**` en `BillingStatusService`, para que el banner de
 * suscripción se pinte sin una petición extra por navegación.
 *
 * Lee también las respuestas de error: el `403` de un centro suspendido trae
 * las mismas cabeceras y es justo el caso en el que el estado acaba de cambiar.
 *
 * Contrato: `doc/contrato-api/billing/billing-frontend.md` §2.
 */
export const billingInterceptor: HttpInterceptorFn = (req, next) => {
  const billing = inject(BillingStatusService);

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) billing.readHeaders(event.headers);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) billing.readHeaders(error.headers);
      },
    })
  );
};
