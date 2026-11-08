import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService, UpdateTenantRequest } from '../../../core/api/services/tenant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { bindingAccess } from '../../assistant/mascot/fill/descriptor';
import { MascotFillService } from '../../assistant/mascot/fill/mascot-fill.service';
import { tenantProfileSurface } from '../../assistant/mascot/fill/surfaces/tenant-profile.surface';

interface GeoOption {
  label: string;
  value: string;
}

/**
 * `country-state-city` pesa 8.4 MB (7.7 MB son las ciudades). Se carga por
 * módulos y solo cuando la sección de dirección (o el campo de ciudad) lo
 * necesita: nada de esto entra en el chunk inicial de Configuración.
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

@Component({
  selector: 'app-tenant-address-settings',
  standalone: true,
  imports: [
    FormsModule, TranslocoDirective,
    TuiButton, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe,
    TuiComboBox, TuiDataListWrapper, TuiChevron,
  ],
  templateUrl: './tenant-address-settings.html',
})
export class TenantAddressSettings implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly geoError = signal(false);

  readonly countries = signal<GeoOption[]>([]);
  readonly states = signal<GeoOption[]>([]);
  readonly cities = signal<GeoOption[]>([]);
  readonly countryLabels = computed(() => this.countries().map(c => c.label));
  readonly stateLabels = computed(() => this.states().map(s => s.label));
  readonly cityLabels = computed(() => this.cities().map(c => c.label));

  countryDisplay = '';
  stateDisplay = '';
  cityDisplay = '';
  address = '';

  private countryCode = '';
  private stateCode = '';
  private tenantId: string | null = null;
  private countryApi?: CountryApi;
  private stateApi?: StateApi;
  private cityApi?: CityApi;
  private geoPromise?: Promise<void>;
  private cityPromise?: Promise<void>;

  constructor() {
    // Mientras esta sección esté en pantalla, la mascota puede rellenarla.
    // País y provincia arrastran a los siguientes (recargan su lista), así que
    // su escritura dispara el mismo `onChange` que dispararía la persona.
    inject(MascotFillService).register(
      tenantProfileSurface({
        loaded: () => !this.loading(),
        countries: () => this.countries(),
        states: () => this.states(),
        cities: () => this.cities(),
      }),
      bindingAccess({
        countryDisplay: {
          get: () => this.countryDisplay,
          set: (value) => (this.countryDisplay = String(value ?? '')),
          after: () => this.onCountryChange(),
        },
        stateDisplay: {
          get: () => this.stateDisplay,
          set: (value) => (this.stateDisplay = String(value ?? '')),
          after: () => this.onStateChange(),
        },
        cityDisplay: {
          get: () => this.cityDisplay,
          set: (value) => (this.cityDisplay = String(value ?? '')),
        },
        address: { get: () => this.address, set: (value) => (this.address = String(value ?? '')) },
      }),
    );
  }

  ngOnInit() {
    this.loading.set(true);
    this.loadGeo();
  }

  retryGeo(): void {
    this.geoPromise = undefined;
    this.loading.set(true);
    this.loadGeo();
  }

  private loadGeo(): void {
    this.geoError.set(false);
    void this.ensureGeo()
      .then(() => this.loadProfile())
      .catch(() => {
        this.geoError.set(true);
        this.loading.set(false);
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

  private findCountryByCode(code: string): GeoOption | undefined {
    return this.countries().find(c => c.value === code);
  }

  private findCountryByLabel(label: string): GeoOption | undefined {
    return this.countries().find(c => c.label === label);
  }

  private findStateByCode(code: string): GeoOption | undefined {
    return this.states().find(s => s.value === code);
  }

  private findStateByLabel(label: string): GeoOption | undefined {
    return this.states().find(s => s.label === label);
  }

  loadProfile() {
    const id = this.tenantCtx.currentTenantId();
    if (!id) return;
    this.tenantId = id;
    this.loading.set(true);

    this.tenantService.getProfile(id).subscribe({
      next: async (tenant) => {
        this.countryCode = tenant.countryCode ?? '';
        const found = this.findCountryByCode(this.countryCode);
        this.countryDisplay = found?.label ?? this.countryCode;

        this.stateCode = tenant.stateCode ?? '';
        if (this.countryCode) {
          await this.loadStates(this.countryCode);
        }
        const foundState = this.findStateByCode(this.stateCode);
        this.stateDisplay = foundState?.label ?? this.stateCode;

        // La ciudad guardada se muestra tal cual: resolverla contra el dataset
        // descargaría 7.7 MB al abrir la sección. La lista llega al enfocar.
        this.cityDisplay = tenant.city ?? '';

        this.address = tenant.address ?? '';
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onCountryChange() {
    this.stateCode = '';
    this.stateDisplay = '';
    this.states.set([]);
    this.cities.set([]);
    const found = this.findCountryByLabel(this.countryDisplay);
    this.countryCode = found?.value ?? this.countryDisplay;
    if (this.countryCode) {
      void this.loadStates(this.countryCode);
    }
  }

  onStateChange() {
    const found = this.findStateByLabel(this.stateDisplay);
    this.stateCode = found?.value ?? this.stateDisplay;
    this.cityDisplay = '';
    this.cities.set([]);
    // El siguiente paso natural es elegir ciudad: se precarga en segundo
    // plano (solo al editar la provincia, nunca al abrir la sección).
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
    this.loadCities(this.countryCode, this.stateCode);
  }

  private async loadStates(c: string) {
    // Fast path síncrono: tras `ensureGeo()` los estados se resuelven sin
    // ceder el turno, para que el encadenado país → provincia (incluido el
    // relleno de la mascota) encuentre la lista ya poblada.
    if (!this.stateApi) {
      try {
        await this.ensureGeo();
      } catch {
        return;
      }
    }
    const list = this.stateApi?.getStatesOfCountry(c).map(s => ({ label: s.name, value: s.isoCode })) ?? [];
    this.states.set(list);
  }

  private loadCities(country: string, state: string) {
    const list = this.cityApi?.getCitiesOfState(country, state).map(c => ({ label: c.name, value: c.name })) ?? [];
    this.cities.set(list);
  }

  save() {
    if (!this.tenantId) return;
    this.saving.set(true);

    const request: UpdateTenantRequest = {
      countryCode: this.countryCode || undefined,
      stateCode: this.stateCode || undefined,
      city: this.cityDisplay || undefined,
      address: this.address || undefined,
    };

    this.tenantService.updateProfile(this.tenantId, request).subscribe({
      next: (tenant) => {
        this.countryCode = tenant.countryCode ?? '';
        this.stateCode = tenant.stateCode ?? '';
        this.saving.set(false);
        this.notify.success('Dirección guardada correctamente');
      },
      error: () => {
        this.saving.set(false);
        this.notify.error('Error al guardar la dirección');
      },
    });
  }
}
