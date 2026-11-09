import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { TranslocoService } from '@jsverse/transloco';

import AdminBillingDetailPage, { reasonRequiredWhenExempt } from './admin-billing-detail.page';
import { TenantService } from '../../../core/api/services/tenant.api';
import { PlatformBillingService } from '../../../core/api/services/platform-billing.api';
import { Tenant } from '../../../core/api/models/tenant.model';
import { TenantBillingAdminDto, SubscriptionEvent, BillingInvoice } from '../../../core/api/models/billing.model';
import { Page } from '../../../core/api/models/page.model';
import { AuthService } from '../../../core/auth/auth.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { ConfirmService, NotificationService } from '../../../core/ui';

/**
 * Dejar de cobrar a un centro es una decisión que alguien tiene que poder
 * explicar meses después. El backend lo exige con un `400`; aquí se comprueba
 * antes de gastar el viaje.
 */
describe('la exención de un centro', () => {
  const fb = new FormBuilder();

  function group(billingExempt: boolean, reason: string) {
    return fb.nonNullable.group({ billingExempt: [billingExempt], reason: [reason] });
  }

  it('exige un motivo cuando se marca como exento', () => {
    expect(reasonRequiredWhenExempt(group(true, ''))).toEqual({ reasonRequired: true });
  });

  it('no se conforma con espacios en blanco', () => {
    expect(reasonRequiredWhenExempt(group(true, '   '))).toEqual({ reasonRequired: true });
  });

  it('lo da por bueno con un motivo escrito', () => {
    expect(reasonRequiredWhenExempt(group(true, 'Partner'))).toBeNull();
  });

  it('no pide nada si el centro no es exento', () => {
    expect(reasonRequiredWhenExempt(group(false, ''))).toBeNull();
  });
});

/**
 * La ficha unificada edita las propiedades del centro además de la
 * facturación. Este bloque comprueba que esos cambios viajan por el endpoint
 * correcto (`PUT /tenants/{id}`) y conservan las preferencias existentes.
 */
describe('la edición de propiedades del centro', () => {
  const tenant: Tenant = {
    id: 't1',
    name: 'Centro Palma',
    cif: 'B12345678',
    phone: '600 000 000',
    city: 'Palma',
    countryCode: 'ES',
    stateCode: 'PM',
    address: 'C/ Mayor 1',
    currency: 'EUR',
    adminTenant: false,
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-02-01T09:00:00Z',
    preferences: {
      enable_vacation_module: true,
      enable_clock_in_module: false,
      default_language: 'es',
      primary_color: '#2F5D4F',
      keycloak_sync_mode: 'OFF',
      from_email: 'hola@centro.test',
      standard_vacation_days: 30,
    },
  };

  const billing: TenantBillingAdminDto = {
    tenantId: 't1',
    tenantName: 'Centro Palma',
    billingStatus: 'ACTIVE',
    billingExempt: false,
    priceCents: 2500,
    currency: 'EUR',
    trialEndsAt: null,
    paidUntil: '2026-03-01T00:00:00Z',
    graceEndsAt: null,
    suspendedAt: null,
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    cancelAtPeriodEnd: false,
    billingEmail: 'facturas@centro.test',
  };

  function emptyPage<T>(): Page<T> {
    return { content: [], page: { size: 10, number: 0, totalElements: 0, totalPages: 0 } };
  }

  let tenantService: jasmine.SpyObj<TenantService>;
  let billingApi: jasmine.SpyObj<PlatformBillingService>;
  let component: AdminBillingDetailPage;

  beforeEach(async () => {
    tenantService = jasmine.createSpyObj<TenantService>('TenantService', ['getById', 'update']);
    billingApi = jasmine.createSpyObj<PlatformBillingService>('PlatformBillingService', [
      'get',
      'update',
      'startTrial',
      'suspend',
      'reactivate',
      'events',
      'invoices',
    ]);

    tenantService.getById.and.returnValue(of(tenant));
    tenantService.update.and.returnValue(of({ ...tenant, name: 'Centro Nuevo' }));
    billingApi.get.and.returnValue(of(billing));
    billingApi.events.and.returnValue(of(emptyPage<SubscriptionEvent>()));
    billingApi.invoices.and.returnValue(of(emptyPage<BillingInvoice>()));

    await TestBed.configureTestingModule({
      imports: [AdminBillingDetailPage],
      providers: [
        { provide: TenantService, useValue: tenantService },
        { provide: PlatformBillingService, useValue: billingApi },
        {
          provide: NotificationService,
          useValue: { success: jasmine.createSpy(), error: jasmine.createSpy(), warning: jasmine.createSpy() },
        },
        { provide: ConfirmService, useValue: { confirm: jasmine.createSpy() } },
        {
          provide: AuthService,
          useValue: {
            enterTenant: jasmine.createSpy(),
            selectedTenant: signal(null),
            switchTenant: jasmine.createSpy(),
          },
        },
        {
          provide: TenantContextService,
          useValue: { currentTenantId: () => null, tenantProfile: signal<Tenant | null>(null) },
        },
        {
          provide: TranslocoService,
          useValue: { translate: (key: string) => key, getActiveLang: () => 'es' },
        },
      ],
    })
      .overrideComponent(AdminBillingDetailPage, { set: { template: '', imports: [] } })
      .compileComponents();

    const fixture = TestBed.createComponent(AdminBillingDetailPage);
    component = fixture.componentInstance;
    // `country-state-city` no debe descargarse en un test unitario.
    const privateComponent = component as unknown as { ensureGeo: () => Promise<void> };
    spyOn(privateComponent, 'ensureGeo').and.returnValue(Promise.resolve());
    fixture.componentRef.setInput('tenantId', 't1');
    fixture.detectChanges();
  });

  it('carga el centro en el formulario', () => {
    expect(component.tenant()?.name).toBe('Centro Palma');
    expect(component.tenantForm.getRawValue()).toEqual(
      jasmine.objectContaining({
        name: 'Centro Palma',
        cif: 'B12345678',
        phone: '600 000 000',
        currency: 'EUR',
        address: 'C/ Mayor 1',
      })
    );
  });

  it('guarda las propiedades con PUT /tenants/{id} conservando las preferencias y normalizando la moneda', () => {
    component.tenantForm.patchValue({
      name: '  Centro Nuevo  ',
      cif: ' B87654321 ',
      phone: ' 611 111 111 ',
      currency: 'usd',
      address: ' C/ Nueva 2 ',
    });

    component.saveTenant();

    expect(tenantService.update).toHaveBeenCalledTimes(1);
    const [id, request] = tenantService.update.calls.mostRecent().args;
    expect(id).toBe('t1');
    expect(request).toEqual(
      jasmine.objectContaining({
        name: 'Centro Nuevo',
        cif: 'B87654321',
        phone: '611 111 111',
        currency: 'USD',
        address: 'C/ Nueva 2',
        preferences: tenant.preferences,
      })
    );
  });

  it('no llama al backend si el nombre queda vacío', () => {
    component.tenantForm.patchValue({ name: '   ' });

    component.saveTenant();

    expect(tenantService.update).not.toHaveBeenCalled();
  });
});
