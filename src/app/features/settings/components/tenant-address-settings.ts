import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService, UpdateTenantRequest } from '../../../core/api/services/tenant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { Country, State, City } from 'country-state-city';

interface GeoOption {
  label: string;
  value: string;
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

  ngOnInit() {
    const all = Country.getAllCountries().map(c => ({ label: c.name, value: c.isoCode }));
    this.countries.set(all);
    this.loadProfile();
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
      next: (tenant) => {
        this.countryCode = tenant.countryCode ?? '';
        const found = this.findCountryByCode(this.countryCode);
        this.countryDisplay = found?.label ?? this.countryCode;

        this.stateCode = tenant.stateCode ?? '';
        if (this.countryCode) {
          this.loadStates(this.countryCode);
        }
        const foundState = this.findStateByCode(this.stateCode);
        this.stateDisplay = foundState?.label ?? this.stateCode;

        if (this.countryCode && this.stateCode) {
          this.loadCities(this.countryCode, this.stateCode);
        }
        const cityCode = tenant.city ?? '';
        const foundCity = this.findCityByName(cityCode);
        this.cityDisplay = foundCity?.label ?? cityCode;

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
    const found = this.findCountryByLabel(this.countryDisplay);
    this.countryCode = found?.value ?? this.countryDisplay;
    if (this.countryCode) {
      this.loadStates(this.countryCode);
    }
  }

  onStateChange() {
    const found = this.findStateByLabel(this.stateDisplay);
    this.stateCode = found?.value ?? this.stateDisplay;
    this.cityDisplay = '';
    this.cities.set([]);
    if (this.countryCode && this.stateCode) {
      this.loadCities(this.countryCode, this.stateCode);
    }
  }

  private loadStates(c: string) {
    const list = State.getStatesOfCountry(c).map(s => ({ label: s.name, value: s.isoCode }));
    this.states.set(list);
  }

  private loadCities(country: string, state: string) {
    const list = City.getCitiesOfState(country, state).map(c => ({ label: c.name, value: c.name }));
    this.cities.set(list);
  }

  private findCityByName(name: string): GeoOption | undefined {
    return this.cities().find(c => c.value === name);
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
