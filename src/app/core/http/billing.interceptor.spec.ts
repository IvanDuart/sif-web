import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { billingInterceptor } from './billing.interceptor';
import { BillingStatusService } from '../billing/billing-status.service';

/**
 * El banner de suscripción se pinta con lo que viaja en las cabeceras de
 * cualquier respuesta, sin una petición propia. Lo que importa aquí es que las
 * lea **también** cuando la respuesta es un error: el `403` de un centro
 * suspendido es justo el momento en que el estado acaba de cambiar.
 */
describe('la lectura de las cabeceras de facturación', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let billing: jasmine.SpyObj<BillingStatusService>;

  beforeEach(() => {
    billing = jasmine.createSpyObj<BillingStatusService>('BillingStatusService', ['readHeaders']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([billingInterceptor])),
        provideHttpClientTesting(),
        { provide: BillingStatusService, useValue: billing },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('vuelca las cabeceras de una respuesta correcta', () => {
    http.get('/api/tenant/t1/patients').subscribe();

    backend.expectOne('/api/tenant/t1/patients').flush(
      {},
      { headers: { 'X-Billing-Status': 'TRIAL', 'X-Billing-Trial-Ends-At': '2026-12-01T00:00:00Z' } }
    );

    expect(billing.readHeaders).toHaveBeenCalledTimes(1);
    const headers = billing.readHeaders.calls.mostRecent().args[0];
    expect(headers.get('X-Billing-Status')).toBe('TRIAL');
  });

  it('vuelca las cabeceras aunque la respuesta sea un error', () => {
    http.get('/api/tenant/t1/patients').subscribe({ next: () => undefined, error: () => undefined });

    backend.expectOne('/api/tenant/t1/patients').flush(
      { code: 'TENANT_SUSPENDED' },
      { status: 403, statusText: 'Forbidden', headers: { 'X-Billing-Status': 'SUSPENDED' } }
    );

    expect(billing.readHeaders).toHaveBeenCalledTimes(1);
    const headers = billing.readHeaders.calls.mostRecent().args[0];
    expect(headers.get('X-Billing-Status')).toBe('SUSPENDED');
  });

  it('deja pasar las respuestas que no traen cabeceras de facturación', () => {
    http.get('/assets/i18n/es.json').subscribe();
    backend.expectOne('/assets/i18n/es.json').flush({});

    // Se llama igual: es el servicio quien decide ignorarlas.
    expect(billing.readHeaders).toHaveBeenCalledTimes(1);
    expect(billing.readHeaders.calls.mostRecent().args[0].get('X-Billing-Status')).toBeNull();
  });
});
