import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PlatformBillingService } from './platform-billing.api';
import { ConfigService } from '../../config/config.service';

/**
 * El panel de superadmin filtra por estado y por texto. Mandar `status=` o `q=`
 * vacíos no es lo mismo que no mandarlos: el backend filtraría por cadena
 * vacía y devolvería una lista vacía.
 */
describe('la API de facturación de la plataforma', () => {
  let api: PlatformBillingService;
  let backend: HttpTestingController;
  const base = 'http://localhost:8080/api/tenants';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { apiUrl: 'http://localhost:8080/api' } },
      ],
    });
    api = TestBed.inject(PlatformBillingService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('no manda los filtros que están vacíos', () => {
    api.list({ page: 0, size: 20 }).subscribe();

    const request = backend.expectOne((req) => req.url === `${base}/billing`);
    expect(request.request.params.has('status')).toBeFalse();
    expect(request.request.params.has('q')).toBeFalse();
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('20');
    request.flush({ content: [], page: { size: 20, number: 0, totalElements: 0, totalPages: 0 } });
  });

  it('manda los filtros cuando los hay', () => {
    api.list({ status: 'PAST_DUE', q: 'clínica', page: 2 }).subscribe();

    const request = backend.expectOne((req) => req.url === `${base}/billing`);
    expect(request.request.params.get('status')).toBe('PAST_DUE');
    expect(request.request.params.get('q')).toBe('clínica');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ content: [], page: { size: 20, number: 2, totalElements: 0, totalPages: 0 } });
  });

  it('guarda la configuración con el precio en céntimos', () => {
    api.update('t1', { priceCents: 2500, billingExempt: false, reason: 'Alta comercial' }).subscribe();

    const request = backend.expectOne(`${base}/t1/billing`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      priceCents: 2500,
      billingExempt: false,
      reason: 'Alta comercial',
    });
    request.flush({});
  });

  it('manda el motivo al suspender a mano', () => {
    api.suspend('t1', { reason: 'Impago reiterado' }).subscribe();

    const request = backend.expectOne(`${base}/t1/billing/suspend`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Impago reiterado' });
    request.flush({});
  });

  it('pide el histórico y las facturas del centro paginados', () => {
    api.events('t1', 1, 10).subscribe();
    const events = backend.expectOne((req) => req.url === `${base}/t1/billing/events`);
    expect(events.request.params.get('page')).toBe('1');
    events.flush({ content: [], page: { size: 10, number: 1, totalElements: 0, totalPages: 0 } });

    api.invoices('t1', 0, 10).subscribe();
    const invoices = backend.expectOne((req) => req.url === `${base}/t1/billing/invoices`);
    expect(invoices.request.params.get('size')).toBe('10');
    invoices.flush({ content: [], page: { size: 10, number: 0, totalElements: 0, totalPages: 0 } });
  });
});
