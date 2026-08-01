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
  template: `
    <div *transloco="let t" class="w-full">
      <form (ngSubmit)="save()" class="flex flex-col gap-4 mt-2">
        <tui-textfield class="w-full">
          <label tuiLabel>{{ t('admin.dialog_name') }} *</label>
          <input tuiInput [(ngModel)]="name" name="name" [placeholder]="t('admin.dialog_name_placeholder')" required />
        </tui-textfield>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <tui-textfield class="w-full">
            <label tuiLabel>{{ t('admin.dialog_cif') }}</label>
            <input tuiInput [(ngModel)]="cif" name="cif" placeholder="B12345678" />
          </tui-textfield>

          <tui-textfield class="w-full">
            <label tuiLabel>{{ t('admin.dialog_phone') }}</label>
            <input tuiInput [(ngModel)]="phone" name="phone" placeholder="+34 600 000 000" />
          </tui-textfield>
        </div>

        <tui-textfield class="w-full">
          <label tuiLabel>{{ t('admin.dialog_address') }}</label>
          <input tuiInput [(ngModel)]="address" name="address" placeholder="C/ Mayor 1, 07001 Palma" />
        </tui-textfield>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <tui-textfield tuiChevron>
            <label tuiLabel>{{ t('admin.dialog_country') }}</label>
            <input tuiComboBox [(ngModel)]="countryDisplay" (ngModelChange)="onCountryChange()" name="country" />
            <tui-data-list-wrapper *tuiDropdown [items]="countryLabels() | tuiFilterByInput" />
          </tui-textfield>

          <tui-textfield tuiChevron>
            <label tuiLabel>{{ t('admin.dialog_state') }}</label>
            <input tuiComboBox [(ngModel)]="stateDisplay" (ngModelChange)="onStateChange()" name="state" [disabled]="!countryDisplay" />
            <tui-data-list-wrapper *tuiDropdown [items]="stateLabels() | tuiFilterByInput" />
          </tui-textfield>

          <tui-textfield tuiChevron>
            <label tuiLabel>{{ t('admin.dialog_city') }}</label>
            <input tuiComboBox [(ngModel)]="cityDisplay" name="city" [disabled]="!stateDisplay" />
            <tui-data-list-wrapper *tuiDropdown [items]="cityLabels() | tuiFilterByInput" />
          </tui-textfield>
        </div>

        <div class="mt-2 p-4 rounded-lg bg-primary-50 dark:bg-primary-950/10 border border-primary-100 dark:border-primary-900/40">
          <div class="flex items-start gap-3">
            <i class="fa-solid fa-circle-info mt-1 text-primary-500"></i>
            <div>
              <p class="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-1">{{ t('admin.dialog_info_title') }}</p>
              <p class="text-xs text-surface-500 leading-relaxed">{{ t('admin.dialog_info') }}</p>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
          <button tuiButton appearance="secondary" size="m" type="button" (click)="context.$implicit.complete()">
            {{ t('common.cancel') }}
          </button>
          <button tuiButton size="m" type="submit" [disabled]="!name.trim() || saving()">
            @if (saving()) {
              <i class="fa-solid fa-spinner fa-spin"></i>
            }
            <i class="fa-solid fa-plus mr-1"></i>
            {{ t('admin.dialog_submit') }}
          </button>
        </div>
      </form>
    </div>
  `
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
