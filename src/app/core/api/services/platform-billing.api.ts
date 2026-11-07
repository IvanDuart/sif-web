import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ConfigService } from '../../config/config.service';
import { SILENT_ERROR } from '../../http/http-context.tokens';
import { Page } from '../models/page.model';
import {
  BillingInvoice,
  BillingOverrideRequest,
  BillingStatus,
  SubscriptionEvent,
  TenantBillingAdminDto,
  UpdateTenantBillingRequest,
} from '../models/billing.model';

/**
 * Facturación vista desde la plataforma: base `/api/tenants` y permiso
 * `MANAGE_TENANT`. Es el único sitio donde salen los ids de Stripe.
 *
 * Va en modo silencioso porque el panel traduce los códigos de error de
 * billing a su propio mensaje, en vez del toast genérico.
 *
 * Contrato: `doc/roadmap/plan-mejoras/fase-0b-suscripciones.md` §8.1.
 */
@Injectable({ providedIn: 'root' })
export class PlatformBillingService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return `${this.configService.apiUrl}/tenants`;
  }

  private get quietContext(): HttpContext {
    return new HttpContext().set(SILENT_ERROR, true);
  }

  list(
    options: { status?: BillingStatus | null; q?: string | null; page?: number; size?: number } = {}
  ): Observable<Page<TenantBillingAdminDto>> {
    let params = new HttpParams()
      .set('page', (options.page ?? 0).toString())
      .set('size', (options.size ?? 20).toString());
    if (options.status) params = params.set('status', options.status);
    if (options.q) params = params.set('q', options.q);

    return this.http.get<Page<TenantBillingAdminDto>>(`${this.baseUrl}/billing`, {
      params,
      context: this.quietContext,
    });
  }

  get(tenantId: string): Observable<TenantBillingAdminDto> {
    return this.http.get<TenantBillingAdminDto>(`${this.baseUrl}/${tenantId}/billing`, {
      context: this.quietContext,
    });
  }

  /** `billingExempt: true` exige `reason`; el backend responde `400` sin él. */
  update(
    tenantId: string,
    request: UpdateTenantBillingRequest
  ): Observable<TenantBillingAdminDto> {
    return this.http.put<TenantBillingAdminDto>(`${this.baseUrl}/${tenantId}/billing`, request, {
      context: this.quietContext,
    });
  }

  /** Concede (o renueva) un periodo de prueba. */
  startTrial(
    tenantId: string,
    request: BillingOverrideRequest = {}
  ): Observable<TenantBillingAdminDto> {
    return this.http.post<TenantBillingAdminDto>(
      `${this.baseUrl}/${tenantId}/billing/trial`,
      request,
      { context: this.quietContext }
    );
  }

  /** Override manual: corta el acceso del centro y registra quién y por qué. */
  suspend(
    tenantId: string,
    request: BillingOverrideRequest
  ): Observable<TenantBillingAdminDto> {
    return this.http.post<TenantBillingAdminDto>(
      `${this.baseUrl}/${tenantId}/billing/suspend`,
      request,
      { context: this.quietContext }
    );
  }

  /** Solo si el centro está `SUSPENDED`. */
  reactivate(
    tenantId: string,
    request: BillingOverrideRequest = {}
  ): Observable<TenantBillingAdminDto> {
    return this.http.post<TenantBillingAdminDto>(
      `${this.baseUrl}/${tenantId}/billing/reactivate`,
      request,
      { context: this.quietContext }
    );
  }

  events(tenantId: string, page = 0, size = 20): Observable<Page<SubscriptionEvent>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<SubscriptionEvent>>(`${this.baseUrl}/${tenantId}/billing/events`, {
      params,
      context: this.quietContext,
    });
  }

  invoices(tenantId: string, page = 0, size = 20): Observable<Page<BillingInvoice>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    return this.http.get<Page<BillingInvoice>>(`${this.baseUrl}/${tenantId}/billing/invoices`, {
      params,
      context: this.quietContext,
    });
  }
}
