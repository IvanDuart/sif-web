import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';

import { problemDetailCode, problemDetailMessage } from '../http/error.interceptor';

/**
 * Mensaje para un error de facturación.
 *
 * Prefiere la traducción del `code` estable (`BILLING_CHECKOUT_NOT_ALLOWED`…)
 * y, si no hay clave para él, cae al `detail` del backend y por último al
 * genérico. Lo comparten la pantalla del centro y la del superadmin.
 */
export function billingErrorMessage(
  transloco: TranslocoService,
  error: HttpErrorResponse
): string {
  const code = problemDetailCode(error);
  if (code) {
    const key = `billing.errors.${code}`;
    const translated = transloco.translate<string>(key);
    // `translate` devuelve la propia clave cuando no existe.
    if (translated && translated !== key) return translated;
  }
  return problemDetailMessage(error) ?? transloco.translate<string>('errors.unexpected');
}
