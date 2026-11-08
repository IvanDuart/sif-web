import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService, CreateTenantRequest } from '../../core/api/services/tenant.api';
import { NotificationService } from '../../core/ui';
import { Tenant } from '../../core/api/models/tenant.model';

interface GeoOption {
  label: string;
  value: string;
}

/** Ver `tenant-address-settings`: el dataset se carga por módulos y bajo demanda. */
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

@Component({
  selector: 'app-create-tenant-dialog',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoDirective,
    TuiButton,
    TuiInput,
    TuiTextfield,
    TuiDropdown,
    TuiFilterByInputPipe,
    TuiComboBox,
    TuiDataListWrapper,
    TuiChevron,
  ],
  templateUrl: './create-tenant.dialog.html'
})
export class CreateTenantDialog implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<Tenant | null, void>>();

  readonly saving = signal(false);
  readonly geoLoading = signal(true);
  readonly geoError = signal(false);
  readonly countries = signal<GeoOption[]>([]);
  readonly states = signal<GeoOption[]>([]);
  readonly cities = signal<GeoOption[]>([]);
  readonly countryLabels = computed(() => this.countries().map(c => c.label));
  readonly stateLabels = computed(() => this.states().map(s => s.label));
  readonly cityLabels = computed(() => this.cities().map(c => c.label));

  name = '';
  cif = '';
  phone = '';
  address = '';
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

  ngOnInit() {
    this.loadGeo();
  }

  retryGeo(): void {
    this.geoPromise = undefined;
    this.geoLoading.set(true);
    this.loadGeo();
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

  private ensureGeo(): Promise<void> {
    this.geoPromise ??= Promise.all([
      import('country-state-city/lib/country'),
      import('country-state-city/lib/state'),
    ]).then(([country, state]) => {
      this.countryApi = country.default;
      this.stateApi = state.default;
      this.countries.set(
        this.countryApi.getAllCountries().map((c) => ({ label: c.name, value: c.isoCode })),
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

  onCountryChange() {
    this.countryCode = this.countries().find(c => c.label === this.countryDisplay)?.value ?? this.countryDisplay;
    this.stateCode = '';
    this.stateDisplay = '';
    this.cityDisplay = '';
    this.cities.set([]);
    if (this.stateApi) {
      this.fillStates();
      return;
    }
    void this.ensureGeo().then(() => this.fillStates());
  }

  private fillStates() {
    const states = this.countryCode
      ? this.stateApi?.getStatesOfCountry(this.countryCode).map(s => ({ label: s.name, value: s.isoCode })) ?? []
      : [];
    this.states.set(states);
  }

  onStateChange() {
    this.stateCode = this.states().find(s => s.label === this.stateDisplay)?.value ?? this.stateDisplay;
    this.cityDisplay = '';
    this.cities.set([]);
    void this.loadCitiesIfNeeded();
  }

  /** Carga el dataset de ciudades solo cuando la persona va a elegir una. */
  async loadCitiesIfNeeded() {
    if (!this.countryCode || !this.stateCode) return;
    try {
      await this.ensureCities();
    } catch {
      return;
    }
    this.cities.set(
      this.cityApi?.getCitiesOfState(this.countryCode, this.stateCode).map(c => ({ label: c.name, value: c.name })) ?? [],
    );
  }

  save() {
    if (!this.name.trim() || this.saving()) return;
    this.saving.set(true);

    const request: CreateTenantRequest = {
      name: this.name.trim(),
      cif: this.cif || undefined,
      phone: this.phone || undefined,
      address: this.address || undefined,
      countryCode: this.countryCode || undefined,
      stateCode: this.stateCode || undefined,
      city: this.cityDisplay || undefined,
    };

    this.tenantService.create(request).subscribe({
      next: (tenant) => {
        this.saving.set(false);
        this.context.$implicit.next(tenant);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error('No se pudo crear el centro');
      }
    });
  }
}
