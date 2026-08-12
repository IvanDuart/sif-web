import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService, CreateTenantRequest } from '../../core/api/services/tenant.api';
import { NotificationService } from '../../core/ui';
import { Tenant } from '../../core/api/models/tenant.model';
import { Country, State, City } from 'country-state-city';

interface GeoOption {
  label: string;
  value: string;
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
export class CreateTenantDialog {
  private readonly tenantService = inject(TenantService);
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<Tenant | null, void>>();

  readonly saving = signal(false);
  readonly countries = signal<GeoOption[]>(Country.getAllCountries().map(c => ({ label: c.name, value: c.isoCode })));
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

  onCountryChange() {
    this.countryCode = this.countries().find(c => c.label === this.countryDisplay)?.value ?? this.countryDisplay;
    this.stateCode = '';
    this.stateDisplay = '';
    this.cityDisplay = '';
    this.states.set(this.countryCode ? State.getStatesOfCountry(this.countryCode).map(s => ({ label: s.name, value: s.isoCode })) : []);
    this.cities.set([]);
  }

  onStateChange() {
    this.stateCode = this.states().find(s => s.label === this.stateDisplay)?.value ?? this.stateDisplay;
    this.cityDisplay = '';
    this.cities.set(this.countryCode && this.stateCode ? City.getCitiesOfState(this.countryCode, this.stateCode).map(c => ({ label: c.name, value: c.name })) : []);
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
