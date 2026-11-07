import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ConfigService } from '../../config/config.service';
import { IGNORE_FORBIDDEN, SILENT_ERROR } from '../../http/error.interceptor';
import { Page } from '../models/page.model';
import { BillingInvoice, BillingRedirect, BillingStatusResponse } from '../models/billing.model';

/**
 * Suscripción del centro (Fase 0B). Todas las rutas bajo `/tenant/{id}/billing`
 * están **exentas** del bloqueo por impago: son las únicas que siguen
 * respondiendo cuando el centro está suspendido.
 *
 * Las llamadas van en modo silencioso (`SILENT_ERROR` + `IGNORE_FORBIDDEN`)
 * porque la pantalla de facturación traduce los códigos de error de billing
 * (`BILLING_CHECKOUT_NOT_ALLOWED`, `BILLING_CUSTOMER_REQUIRED`…) a mensajes y
 * caminos alternativos; un toast genérico o una expulsión a `/not-authorized`
 * se comerían esa lógica.
 *
 * Contrato: `doc/contrato-api/billing/billing-frontend.md`.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private baseUrl(tenantId: string): string {
    return `${this.configService.apiUrl}/tenant/${tenantId}/billing`;
  }

  private get quietContext(): HttpContext {
    return new HttpContext().set(SILENT_ERROR, true).set(IGNORE_FORBIDDEN, true);
  }

  /** Único endpoint de facturación que responde con el tenant suspendido. */
  status(tenantId: string): Observable<BillingStatusResponse> {
    return this.http.get<BillingStatusResponse>(`${this.baseUrl(tenantId)}/status`, {
      context: this.quietContext,
    });
  }

  /** Abre una sesión de pago alojada por Stripe. Permitido en `TRIAL`, `PAST_DUE` y `SUSPENDED`. */
  checkout(tenantId: string): Observable<BillingRedirect> {
    return this.http.post<BillingRedirect>(
      `${this.baseUrl(tenantId)}/checkout-session`,
      {},
      { context: this.quietContext }
    );
  }

  /** Portal de cliente de Stripe: cambiar tarjeta, ver facturas, cancelar. */
  portal(tenantId: string): Observable<BillingRedirect> {
    return this.http.post<BillingRedirect>(
      `${this.baseUrl(tenantId)}/portal-session`,
      {},
      { context: this.quietContext }
    );
  }

  /** Programa la cancelación al final del periodo pagado. */
  cancel(tenantId: string): Observable<BillingStatusResponse> {
    return this.http.post<BillingStatusResponse>(
      `${this.baseUrl(tenantId)}/cancel`,
      { confirm: true },
      { context: this.quietContext }
    );
  }

  /**
   * Deshace una cancelación programada. **No** levanta un tenant suspendido:
   * para eso hay que pagar (checkout) y el backend responde `409`.
   */
  reactivate(tenantId: string): Observable<BillingStatusResponse> {
    return this.http.post<BillingStatusResponse>(
      `${this.baseUrl(tenantId)}/reactivate`,
      {},
      { context: this.quietContext }
    );
  }

  invoices(tenantId: string, page = 0, size = 20): Observable<Page<BillingInvoice>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'periodStart,desc');

    return this.http.get<Page<BillingInvoice>>(`${this.baseUrl(tenantId)}/invoices`, {
      params,
      context: this.quietContext,
    });
  }

  /**
   * Descarga el PDF con la sesión del usuario: el backend comprueba el permiso
   * en cada descarga. `BillingInvoice.pdfUrl` no lo hace.
   */
  downloadInvoice(tenantId: string, invoiceId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl(tenantId)}/invoices/${invoiceId}/pdf`, {
      responseType: 'blob',
      context: this.quietContext,
    });
  }
}
