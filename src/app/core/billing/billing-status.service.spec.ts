import { HttpHeaders } from '@angular/common/http';
import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BillingStatusService } from './billing-status.service';
import { BillingService } from '../api/services/billing.api';
import { BillingStatus, BillingStatusResponse } from '../api/models/billing.model';
import { PermissionsService } from '../permissions/permissions.service';
import { TenantContextService } from '../tenant/tenant-context.service';

function detailOf(
  status: BillingStatus,
  daysLeft: number | null = 5,
  tenantId = 't1'
): BillingStatusResponse {
  return {
    tenantId,
    tenantName: 'Centro',
    status,
    statusLabel: status,
    billingExempt: status === 'EXEMPT',
    priceCents: 2500,
    currency: 'EUR',
    trialEndsAt: null,
    paidUntil: null,
    graceEndsAt: null,
    suspendedAt: null,
    daysLeft,
    countdownKind: status === 'TRIAL' ? 'TRIAL' : null,
    cancelAtPeriodEnd: false,
    billingEmail: null,
    paymentMethod: null,
    invoices: [],
  };
}

function headers(status: string): HttpHeaders {
  return new HttpHeaders({ 'X-Billing-Status': status });
}

/**
 * El estado de facturación se arma con dos fuentes: las cabeceras que vienen
 * gratis en cada respuesta y el detalle, que cuesta una petición. La gracia
 * está en pedir el detalle lo menos posible sin llegar a enseñar una cuenta
 * atrás que ya no corresponde al estado real.
 */
describe('el estado de la suscripción del centro', () => {
  let api: jasmine.SpyObj<BillingService>;
  let tenantId: ReturnType<typeof signal<string | null>>;
  let permissions: ReturnType<typeof signal<Set<string>>>;
  let superAdmin: ReturnType<typeof signal<boolean>>;

  function build(): BillingStatusService {
    return TestBed.inject(BillingStatusService);
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<BillingService>('BillingService', ['status']);
    api.status.and.returnValue(of(detailOf('TRIAL')));
    tenantId = signal<string | null>('t1');
    permissions = signal<Set<string>>(new Set(['VIEW_BILLING']));
    superAdmin = signal(false);

    TestBed.configureTestingModule({
      providers: [
        { provide: BillingService, useValue: api },
        {
          provide: TenantContextService,
          useValue: { currentTenantId: tenantId as unknown as Signal<string | null> },
        },
        {
          // `has()` y no el conjunto: es por donde pasa el superadministrador,
          // que no tiene membresía de la que derivar permisos.
          provide: PermissionsService,
          useValue: {
            permissions: permissions as unknown as Signal<Set<string>>,
            has: (code: string) => superAdmin() || permissions().has(code),
          },
        },
      ],
    });
  });

  it('pide el detalle una vez y no en cada respuesta', () => {
    const service = build();
    TestBed.tick();
    expect(api.status).toHaveBeenCalledTimes(1);

    // Tres navegaciones más con el mismo estado en las cabeceras.
    service.readHeaders(headers('TRIAL'));
    service.readHeaders(headers('TRIAL'));
    service.readHeaders(headers('TRIAL'));
    TestBed.tick();

    expect(api.status).toHaveBeenCalledTimes(1);
  });

  it('lo vuelve a pedir en cuanto las cabeceras delatan un cambio de estado', () => {
    const service = build();
    TestBed.tick();

    api.status.and.returnValue(of(detailOf('PAST_DUE', 3)));
    service.readHeaders(headers('PAST_DUE'));
    TestBed.tick();

    expect(api.status).toHaveBeenCalledTimes(2);
    expect(service.status()).toBe('PAST_DUE');
    expect(service.daysLeft()).toBe(3);
  });

  it('no enseña la cuenta atrás vieja cuando el estado ya ha cambiado', () => {
    // El detalle dice TRIAL con 5 días; la cabecera dice que ya está suspendido.
    api.status.and.returnValue(of(detailOf('TRIAL', 5)));
    const service = build();
    TestBed.tick();
    expect(service.daysLeft()).toBe(5);

    api.status.and.returnValue(of(detailOf('SUSPENDED', null)));
    service.markSuspended('https://app.tusdietas.com/billing');

    expect(service.status()).toBe('SUSPENDED');
    expect(service.daysLeft()).toBeNull();
    expect(service.renewalUrl()).toBe('https://app.tusdietas.com/billing');
  });

  it('pinta el banner en prueba, impago y cancelación, y en nada más', () => {
    const service = build();
    TestBed.tick();
    expect(service.showBanner()).toBeTrue();

    for (const status of ['PAST_DUE', 'CANCELLED'] as BillingStatus[]) {
      api.status.and.returnValue(of(detailOf(status)));
      service.readHeaders(headers(status));
      TestBed.tick();
      expect(service.showBanner()).withContext(status).toBeTrue();
    }

    for (const status of ['ACTIVE', 'EXEMPT', 'SUSPENDED'] as BillingStatus[]) {
      api.status.and.returnValue(of(detailOf(status)));
      service.readHeaders(headers(status));
      TestBed.tick();
      expect(service.showBanner()).withContext(status).toBeFalse();
    }
  });

  it('ni pide el detalle ni avisa a quien no gestiona la facturación', () => {
    permissions.set(new Set(['VIEW_USER']));
    const service = build();
    TestBed.tick();

    service.readHeaders(headers('TRIAL'));
    TestBed.tick();

    expect(api.status).not.toHaveBeenCalled();
    expect(service.showBanner()).toBeFalse();
    // El estado sí se conoce: la pantalla de suspensión lo necesita.
    expect(service.status()).toBe('TRIAL');
  });

  it('cuenta al superadministrador como gestor aunque su membresía no traiga permisos', () => {
    // No es miembro de ningún centro: su membresía sintética llega vacía y el
    // conjunto de permisos no dice nada de él.
    permissions.set(new Set());
    superAdmin.set(true);

    const service = build();
    TestBed.tick();

    expect(api.status).toHaveBeenCalledTimes(1);
    expect(service.showBanner()).toBeTrue();
  });

  it('tira el detalle del centro anterior al cambiar de centro', () => {
    const service = build();
    TestBed.tick();
    expect(service.statusDetail()).not.toBeNull();

    api.status.and.returnValue(of(detailOf('ACTIVE', null, 't2')));
    tenantId.set('t2');
    TestBed.tick();

    expect(service.statusDetail()?.tenantId).toBe('t2');
  });

  it('ignora una cabecera con un estado que no conoce', () => {
    const service = build();
    TestBed.tick();

    service.readHeaders(headers('WHATEVER'));
    TestBed.tick();

    expect(service.status()).toBe('TRIAL');
    expect(api.status).toHaveBeenCalledTimes(1);
  });
});
