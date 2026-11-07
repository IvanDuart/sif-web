import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import Keycloak from 'keycloak-js';

import { errorInterceptor } from './error.interceptor';
import { BillingStatusService } from '../billing/billing-status.service';
import { NotificationService } from '../ui';

/**
 * Un centro suspendido por impago responde `403` en todos sus endpoints de
 * negocio, igual que una falta de permisos. Son cosas distintas y el usuario
 * tiene que acabar en sitios distintos: la suspensión se arregla pagando, no
 * pidiendo permiso, y el único sitio que sigue respondiendo es `/billing`.
 */
describe('el 403 de un centro suspendido', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let notify: jasmine.SpyObj<NotificationService>;
  let billing: jasmine.SpyObj<BillingStatusService>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'error',
      'warning',
      'success',
      'info',
    ]);
    billing = jasmine.createSpyObj<BillingStatusService>('BillingStatusService', [
      'markSuspended',
      'readHeaders',
    ]);
    const transloco = jasmine.createSpyObj<TranslocoService>('TranslocoService', ['translate']);
    transloco.translate.and.callFake(((key: string) => key) as never);
    const keycloak = jasmine.createSpyObj<Keycloak>('Keycloak', ['updateToken', 'login']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notify },
        { provide: TranslocoService, useValue: transloco },
        { provide: Keycloak, useValue: keycloak },
        { provide: BillingStatusService, useValue: billing },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function fail403(body: Record<string, string>): void {
    http.get('/api/tenant/t1/patients').subscribe({ next: () => undefined, error: () => undefined });
    backend
      .expectOne('/api/tenant/t1/patients')
      .flush(body, { status: 403, statusText: 'Forbidden' });
  }

  it('lleva a la pantalla de pago en vez de a «no autorizado»', () => {
    fail403({
      code: 'TENANT_SUSPENDED',
      detail: 'La suscripción ha caducado.',
      renewalUrl: 'https://app.tusdietas.com/billing',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/billing']);
    expect(router.navigate).not.toHaveBeenCalledWith(['/not-authorized']);
  });

  it('no enseña el toast genérico de «acceso denegado»', () => {
    fail403({ code: 'TENANT_SUSPENDED', detail: 'La suscripción ha caducado.' });

    expect(notify.error).not.toHaveBeenCalled();
  });

  it('marca el centro como suspendido con la URL de renovación', () => {
    fail403({ code: 'TENANT_SUSPENDED', renewalUrl: 'https://app.tusdietas.com/billing' });

    expect(billing.markSuspended).toHaveBeenCalledWith('https://app.tusdietas.com/billing');
  });

  it('sigue tratando como antes un 403 de permisos', () => {
    fail403({ code: 'error.permission_denied', detail: 'Sin permiso' });

    expect(billing.markSuspended).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('errors.forbidden');
    expect(router.navigate).toHaveBeenCalledWith(['/not-authorized']);
  });
});
