import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs/operators';

import { TuiTable } from '@taiga-ui/addon-table';
import {
  TuiButton,
  TuiDropdown,
  TuiFilterByInputPipe,
  TuiInput,
  TuiLabel,
  TuiLoader,
  TuiTextfield,
} from '@taiga-ui/core';
import {
  TuiBadge,
  TuiChevron,
  TuiComboBox,
  TuiDataListWrapper,
  TuiSwitch,
} from '@taiga-ui/kit';

import { PlatformBillingService } from '../../../core/api/services/platform-billing.api';
import { TenantService, UpdateTenantRequest } from '../../../core/api/services/tenant.api';
import { Tenant } from '../../../core/api/models/tenant.model';
import {
  BillingInvoice,
  BillingStatus,
  SubscriptionEvent,
  TenantBillingAdminDto,
} from '../../../core/api/models/billing.model';
import { AuthService } from '../../../core/auth/auth.service';
import { superAdminMembership } from '../../../core/api/models/user.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { billingErrorMessage } from '../../../core/billing/billing-error';
import { ConfirmService, NotificationService } from '../../../core/ui';
import { EmptyState } from '../../../shared/ui/empty-state';
import { PaginationFooter } from '../../../shared/ui/pagination-footer';

const HISTORY_PAGE_SIZE = 10;

/**
 * Permite tanto borrar campos opcionales (enviando `""`) como normalizar la
 * moneda a mayúsculas antes de validar o enviar al backend.
 */
function normalizeCurrency(raw: string): string {
  return raw.trim().toUpperCase();
}

interface GeoOption {
  label: string;
  value: string;
}

/**
 * `country-state-city` pesa 8.4 MB (7.7 MB son las ciudades). Se carga por
 * módulos y bajo demanda, igual que en `CreateTenantDialog` y
 * `TenantAddressSettings`: nada de esto entra en el chunk de administración.
 */
interface CountryEntry {
  name: string;
  isoCode: string;
}
interface StateEntry {
  name: string;
  isoCode: string;
}
interface CityEntry {
  name: string;
}
interface CountryApi {
  getAllCountries(): CountryEntry[];
}
interface StateApi {
  getStatesOfCountry(countryCode: string): StateEntry[];
}
interface CityApi {
  getCitiesOfState(countryCode: string, stateCode: string): CityEntry[];
}

/**
 * Un centro exento no paga: marcarlo como tal exige dejar dicho por qué, y el
 * backend responde `400` sin ello. Se valida también aquí para no gastar un
 * viaje y para que el aviso salga junto al campo.
 */
export function reasonRequiredWhenExempt(group: AbstractControl): ValidationErrors | null {
  const exempt = group.get('billingExempt')?.value === true;
  const reason = (group.get('reason')?.value ?? '').trim();
  return exempt && !reason ? { reasonRequired: true } : null;
}

/**
 * Ficha unificada de un centro para el superadmin: propiedades del tenant
 * (`GET/PUT /tenants/{id}`) y toda su facturación (configuración, overrides,
 * histórico y facturas).
 *
 * Cuelga de `/admin`, que ya exige `MANAGE_TENANT` y centro administrador.
 */
@Component({
  selector: 'app-admin-billing-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    TuiTable,
    TuiButton,
    TuiDropdown,
    TuiFilterByInputPipe,
    TuiInput,
    TuiLabel,
    TuiLoader,
    TuiTextfield,
    TuiBadge,
    TuiChevron,
    TuiComboBox,
    TuiDataListWrapper,
    TuiSwitch,
    EmptyState,
    PaginationFooter,
  ],
  templateUrl: './admin-billing-detail.page.html',
})
export default class AdminBillingDetailPage implements OnInit {
  /** Llega de la ruta `/admin/:tenantId` (`withComponentInputBinding`). */
  readonly tenantId = input.required<string>();

  private readonly api = inject(PlatformBillingService);
  private readonly tenantService = inject(TenantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  readonly tenant = signal<Tenant | null>(null);
  readonly billing = signal<TenantBillingAdminDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savingTenant = signal(false);

  readonly events = signal<SubscriptionEvent[]>([]);
  readonly eventsPage = signal(0);
  readonly eventsTotal = signal(0);

  readonly invoices = signal<BillingInvoice[]>([]);
  readonly invoicesPage = signal(0);
  readonly invoicesTotal = signal(0);

  readonly pageSize = HISTORY_PAGE_SIZE;

  // ── Propiedades del centro (`PUT /tenants/{id}`) ────────────────────────

  readonly tenantForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    cif: [''],
    phone: [''],
    currency: ['EUR', [Validators.pattern(/^[A-Za-z]{3}$/)]],
    address: [''],
  });

  readonly geoError = signal(false);
  readonly geoLoading = signal(true);
  readonly countries = signal<GeoOption[]>([]);
  readonly states = signal<GeoOption[]>([]);
  readonly cities = signal<GeoOption[]>([]);
  readonly countryLabels = computed(() => this.countries().map((c) => c.label));
  readonly stateLabels = computed(() => this.states().map((s) => s.label));
  readonly cityLabels = computed(() => this.cities().map((c) => c.label));

  countryDisplay = '';
  stateDisplay = '';
  cityDisplay = '';

  private countryCode = '';
  private stateCode = '';
  private countryApi?: CountryApi;
  private stateApi?: StateApi;
  private cityApi?: CityApi;
  private geoPromise?: Promise<void>;
  private cityPromise?: Promise<void>;

  // ── Facturación (`PUT /tenants/{id}/billing`) ───────────────────────────

  /** Configuración. El precio se edita en euros y viaja en céntimos. */
  readonly form = this.fb.nonNullable.group(
    {
      billingExempt: [false],
      price: [25, [Validators.required, Validators.min(0)]],
      trialDays: [14, [Validators.min(0)]],
      billingEmail: [''],
      reason: [''],
    },
    { validators: reasonRequiredWhenExempt }
  );

  /** Motivo y días de los overrides manuales, separados del formulario de config. */
  readonly overrideForm = this.fb.nonNullable.group({
    days: [14, [Validators.min(1)]],
    reason: [''],
  });

  readonly isSuspended = computed(() => this.billing()?.billingStatus === 'SUSPENDED');
  readonly busy = computed(() => this.saving() || this.savingTenant() || this.loading());

  ngOnInit(): void {
    this.loadTenant();
    this.load();
    this.loadEvents(0);
    this.loadInvoices(0);
    this.loadGeo();
  }

  // ── Propiedades del centro ──────────────────────────────────────────────

  private loadTenant(): void {
    this.tenantService.getById(this.tenantId()).subscribe({
      next: (tenant) => {
        this.tenant.set(tenant);
        this.applyTenant(tenant);
        void this.fillGeo(tenant);
      },
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  private applyTenant(tenant: Tenant): void {
    this.tenantForm.patchValue({
      name: tenant.name ?? '',
      cif: tenant.cif ?? '',
      phone: tenant.phone ?? '',
      currency: tenant.currency ?? 'EUR',
      address: tenant.address ?? '',
    });
    this.tenantForm.markAsPristine();
  }

  saveTenant(): void {
    this.tenantForm.markAllAsTouched();
    const value = this.tenantForm.getRawValue();
    if (!value.name.trim() || this.tenantForm.invalid || this.savingTenant()) return;

    const currency = normalizeCurrency(value.currency);
    const request: UpdateTenantRequest = {
      name: value.name.trim(),
      cif: value.cif.trim(),
      phone: value.phone.trim(),
      currency: currency || undefined,
      address: value.address.trim(),
      countryCode: this.countryCode,
      stateCode: this.stateCode,
      city: this.cityDisplay.trim(),
      // El `PUT` reemplaza la entidad entera en el backend: reenviar las
      // preferencias evita que se pierdan al guardar los datos generales.
      preferences: this.tenant()?.preferences,
    };

    this.savingTenant.set(true);
    this.tenantService
      .update(this.tenantId(), request)
      .pipe(finalize(() => this.savingTenant.set(false)))
      .subscribe({
        next: (updated) => {
          this.tenant.set(updated);
          this.applyTenant(updated);
          this.billing.update((billing) =>
            billing ? { ...billing, tenantName: updated.name } : billing
          );
          if (this.tenantCtx.currentTenantId() === this.tenantId()) {
            this.tenantCtx.tenantProfile.set(updated);
            const currentMembership = this.authService.selectedTenant();
            if (currentMembership && currentMembership.tenantName !== updated.name) {
              this.authService.switchTenant({
                ...currentMembership,
                tenantName: updated.name,
              });
            }
          }
          this.notify.success(this.transloco.translate('admin.tenant_saved'));
        },
        error: () => {
          // Un error del `PUT` de propiedades no pasa por el traductor de
          // facturación: se avisa con el mensaje propio de esta sección.
          this.notify.error(this.transloco.translate('admin.tenant_save_error'));
        },
      });
  }

  private loadGeo(): void {
    this.geoError.set(false);
    void this.ensureGeo()
      .then(() => this.geoLoading.set(false))
      .catch(() => {
        this.geoError.set(true);
        this.geoLoading.set(false);
      });
  }

  retryGeo(): void {
    this.geoPromise = undefined;
    this.geoLoading.set(true);
    this.loadGeo();
    const tenant = this.tenant();
    if (tenant) void this.fillGeo(tenant);
  }

  private ensureGeo(): Promise<void> {
    this.geoPromise ??= Promise.all([
      import('country-state-city/lib/country'),
      import('country-state-city/lib/state'),
    ]).then(([country, state]) => {
      this.countryApi = country.default;
      this.stateApi = state.default;
      this.countries.set(
        this.countryApi.getAllCountries().map((c) => ({ label: c.name, value: c.isoCode }))
      );
    });
    return this.geoPromise;
  }

  private ensureCities(): Promise<void> {
    this.cityPromise ??= import('country-state-city/lib/city').then((city) => {
      this.cityApi = city.default;
    });
    return this.cityPromise;
  }

  /** Rellena los selectores geográficos con lo que el centro ya tenía guardado. */
  private async fillGeo(tenant: Tenant): Promise<void> {
    this.countryCode = tenant.countryCode ?? '';
    this.stateCode = tenant.stateCode ?? '';
    try {
      await this.ensureGeo();
    } catch {
      this.geoError.set(true);
      return;
    }

    const country = this.countries().find((c) => c.value === this.countryCode);
    this.countryDisplay = country?.label ?? this.countryCode;

    if (this.countryCode) {
      await this.loadStates(this.countryCode);
    }
    const state = this.states().find((s) => s.value === this.stateCode);
    this.stateDisplay = state?.label ?? this.stateCode;

    // La ciudad guardada se muestra tal cual: resolverla contra el dataset
    // descargaría 7.7 MB al abrir la ficha. La lista llega al enfocar.
    this.cityDisplay = tenant.city ?? '';
  }

  onCountryChange(): void {
    const country = this.countries().find((c) => c.label === this.countryDisplay);
    this.countryCode = country?.value ?? this.countryDisplay;
    this.stateCode = '';
    this.stateDisplay = '';
    this.cityDisplay = '';
    this.states.set([]);
    this.cities.set([]);
    if (this.countryCode) {
      void this.loadStates(this.countryCode);
    }
  }

  onStateChange(): void {
    const state = this.states().find((s) => s.label === this.stateDisplay);
    this.stateCode = state?.value ?? this.stateDisplay;
    this.cityDisplay = '';
    this.cities.set([]);
    void this.loadCitiesIfNeeded();
  }

  /** Carga el dataset de ciudades solo cuando la persona va a elegir una. */
  async loadCitiesIfNeeded(): Promise<void> {
    if (!this.countryCode || !this.stateCode) return;
    try {
      await this.ensureCities();
    } catch {
      return;
    }
    this.cities.set(
      this.cityApi
        ?.getCitiesOfState(this.countryCode, this.stateCode)
        .map((c) => ({ label: c.name, value: c.name })) ?? []
    );
  }

  private async loadStates(countryCode: string): Promise<void> {
    if (!this.stateApi) {
      try {
        await this.ensureGeo();
      } catch {
        return;
      }
    }
    this.states.set(
      this.stateApi
        ?.getStatesOfCountry(countryCode)
        .map((s) => ({ label: s.name, value: s.isoCode })) ?? []
    );
  }

  enterTenant(): void {
    this.authService.enterTenant(
      superAdminMembership(
        this.tenantId(),
        this.tenant()?.name || this.billing()?.tenantName || ''
      )
    );
  }

  // ── Facturación: carga inicial ──────────────────────────────────────────

  private load(): void {
    this.loading.set(true);
    this.api
      .get(this.tenantId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (billing) => this.apply(billing),
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  private apply(billing: TenantBillingAdminDto): void {
    this.billing.set(billing);
    this.form.patchValue({
      billingExempt: billing.billingExempt,
      price: billing.priceCents / 100,
      billingEmail: billing.billingEmail ?? '',
      reason: '',
    });
    this.form.markAsPristine();
  }

  // ── Configuración ───────────────────────────────────────────────────────

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .update(this.tenantId(), {
        billingExempt: value.billingExempt,
        // El contrato habla en céntimos; el formulario, en euros.
        priceCents: Math.round(value.price * 100),
        trialDays: value.trialDays,
        billingEmail: value.billingEmail || undefined,
        reason: value.reason || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (billing) => {
          this.apply(billing);
          this.notify.success(this.transloco.translate('admin.billing.toast.saved'));
          this.loadEvents(0);
        },
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  // ── Overrides manuales ──────────────────────────────────────────────────

  startTrial(): void {
    const { days, reason } = this.overrideForm.getRawValue();
    this.runOverride(
      this.transloco.translate('admin.billing.confirm.trial', { days }),
      () => this.api.startTrial(this.tenantId(), { days, reason: reason || undefined }),
      'admin.billing.toast.trial_started'
    );
  }

  suspend(): void {
    const reason = this.overrideForm.getRawValue().reason.trim();
    if (!reason) {
      // Cortarle el acceso a un centro sin dejar dicho por qué no es aceptable.
      this.notify.warning(this.transloco.translate('admin.billing.reason_required'));
      return;
    }

    this.runOverride(
      this.transloco.translate('admin.billing.confirm.suspend', {
        tenant: this.tenant()?.name || this.billing()?.tenantName || '',
      }),
      () => this.api.suspend(this.tenantId(), { reason }),
      'admin.billing.toast.suspended'
    );
  }

  reactivate(): void {
    const reason = this.overrideForm.getRawValue().reason;
    this.runOverride(
      this.transloco.translate('admin.billing.confirm.reactivate'),
      () => this.api.reactivate(this.tenantId(), { reason: reason || undefined }),
      'admin.billing.toast.reactivated'
    );
  }

  private runOverride(
    question: string,
    call: () => ReturnType<PlatformBillingService['suspend']>,
    successKey: string
  ): void {
    if (this.saving()) return;

    this.confirm
      .confirm({
        label: this.transloco.translate('admin.billing.override_title'),
        content: question,
        yes: this.transloco.translate('common.accept'),
        no: this.transloco.translate('common.cancel'),
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.saving.set(true);
        call()
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: (billing) => {
              this.apply(billing);
              this.overrideForm.patchValue({ reason: '' });
              this.notify.success(this.transloco.translate(successKey));
              this.loadEvents(0);
            },
            error: (error: HttpErrorResponse) => this.showError(error),
          });
      });
  }

  // ── Histórico ───────────────────────────────────────────────────────────

  loadEvents(page: number): void {
    this.api.events(this.tenantId(), page, HISTORY_PAGE_SIZE).subscribe({
      next: (result) => {
        this.events.set(result.content);
        this.eventsPage.set(result.page.number);
        this.eventsTotal.set(result.page.totalElements);
      },
      error: () => {
        this.events.set([]);
        this.eventsTotal.set(0);
      },
    });
  }

  loadInvoices(page: number): void {
    this.api.invoices(this.tenantId(), page, HISTORY_PAGE_SIZE).subscribe({
      next: (result) => {
        this.invoices.set(result.content);
        this.invoicesPage.set(result.page.number);
        this.invoicesTotal.set(result.page.totalElements);
      },
      error: () => {
        this.invoices.set([]);
        this.invoicesTotal.set(0);
      },
    });
  }

  // ── Presentación ────────────────────────────────────────────────────────

  statusAppearance(
    status: BillingStatus | undefined
  ): 'positive' | 'negative' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'ACTIVE':
        return 'positive';
      case 'EXEMPT':
        return 'info';
      case 'TRIAL':
        return 'warning';
      case 'PAST_DUE':
      case 'SUSPENDED':
        return 'negative';
      default:
        return 'neutral';
    }
  }

  /**
   * Etiqueta del evento. El backend puede añadir tipos nuevos, así que un tipo
   * sin traducción se enseña en crudo en vez de dejar la clave a la vista.
   */
  eventLabel(type: string): string {
    const key = `admin.billing.events.${type}`;
    const translated = this.transloco.translate<string>(key);
    return translated && translated !== key ? translated : type;
  }

  eventIcon(type: string): string {
    if (type.startsWith('PAYMENT_FAILED') || type === 'SUSPENDED') return 'fa-solid fa-circle-xmark text-err-text';
    if (type === 'PAYMENT_SUCCEEDED' || type === 'REACTIVATED' || type === 'CHECKOUT_COMPLETED')
      return 'fa-solid fa-circle-check text-ok';
    if (type.startsWith('GRACE') || type.startsWith('TRIAL')) return 'fa-solid fa-hourglass-half text-warn-text';
    return 'fa-solid fa-circle-info text-surface-400';
  }

  /** `metadata` es JSON libre: se enseña tal cual, sin inventarle forma. */
  eventMetadata(event: SubscriptionEvent): string | null {
    const metadata = event.metadata;
    if (!metadata || Object.keys(metadata).length === 0) return null;
    return Object.entries(metadata)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }

  formatMoney(cents: number, currency: string): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang(), {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(cents / 100);
  }

  private showError(error: HttpErrorResponse): void {
    this.notify.error(billingErrorMessage(this.transloco, error));
  }
}
