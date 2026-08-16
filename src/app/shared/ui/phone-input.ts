import { Component, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, FormControl, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { MaskitoDirective } from '@maskito/angular';
import { maskitoGetCountryFromNumber, maskitoPhone } from '@maskito/phone';
import { TuiDropdown, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiChevron, TuiDataListWrapper, TuiSelect } from '@taiga-ui/kit';
import { formatIncompletePhoneNumber, getCountryCallingCode } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import metadata from 'libphonenumber-js/metadata.min.json';

interface PhoneCountry {
  iso: CountryCode;
  name: string;
}

const DEFAULT_COUNTRY: CountryCode = 'ES';

const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'ES', name: 'España' },
  { iso: 'AR', name: 'Argentina' },
  { iso: 'MX', name: 'México' },
  { iso: 'CO', name: 'Colombia' },
  { iso: 'CL', name: 'Chile' },
  { iso: 'PE', name: 'Perú' },
  { iso: 'VE', name: 'Venezuela' },
  { iso: 'EC', name: 'Ecuador' },
  { iso: 'UY', name: 'Uruguay' },
  { iso: 'PY', name: 'Paraguay' },
  { iso: 'BO', name: 'Bolivia' },
  { iso: 'CR', name: 'Costa Rica' },
  { iso: 'PA', name: 'Panamá' },
  { iso: 'DO', name: 'República Dominicana' },
  { iso: 'GT', name: 'Guatemala' },
  { iso: 'HN', name: 'Honduras' },
  { iso: 'SV', name: 'El Salvador' },
  { iso: 'NI', name: 'Nicaragua' },
  { iso: 'CU', name: 'Cuba' },
  { iso: 'US', name: 'Estados Unidos' },
  { iso: 'GB', name: 'Reino Unido' },
  { iso: 'FR', name: 'Francia' },
  { iso: 'DE', name: 'Alemania' },
  { iso: 'IT', name: 'Italia' },
  { iso: 'PT', name: 'Portugal' },
  { iso: 'BR', name: 'Brasil' },
  { iso: 'CH', name: 'Suiza' },
  { iso: 'BE', name: 'Bélgica' },
  { iso: 'NL', name: 'Países Bajos' },
  { iso: 'AU', name: 'Australia' },
];

@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TranslocoDirective,
    MaskitoDirective,
    TuiTextfield,
    TuiInput,
    TuiSelect,
    TuiDropdown,
    TuiChevron,
    TuiDataListWrapper,
  ],
  templateUrl: './phone-input.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInput),
      multi: true,
    },
  ],
})
export class PhoneInput implements ControlValueAccessor {
  readonly countries: PhoneCountry[] = PHONE_COUNTRIES;
  readonly countryCodes: CountryCode[] = PHONE_COUNTRIES.map((c) => c.iso);

  readonly countryControl = new FormControl<CountryCode>(DEFAULT_COUNTRY);
  readonly numberControl = new FormControl<string>('');

  private readonly country = signal<CountryCode>(DEFAULT_COUNTRY);

  readonly phoneMask = computed(() =>
    maskitoPhone({
      countryIsoCode: this.country(),
      metadata,
      strict: true,
      format: 'NATIONAL',
      separator: ' ',
    }),
  );

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private writing = false;

  constructor() {
    this.countryControl.valueChanges.subscribe((iso) => {
      if (this.writing || !iso) return;
      this.country.set(iso);
      this.reformat();
      this.emitValue();
    });

    this.numberControl.valueChanges.subscribe(() => {
      if (this.writing) return;
      this.emitValue();
    });
  }

  countryStringify = (iso: CountryCode): string => {
    const found = this.countries.find((c) => c.iso === iso);
    return found ? `+${getCountryCallingCode(found.iso)} ${found.name}` : iso;
  };

  writeValue(value: string | null | undefined): void {
    const { iso, national } = this.parsePhone(value);
    this.writing = true;
    this.country.set(iso);
    this.countryControl.setValue(iso, { emitEvent: false });
    this.numberControl.setValue(national, { emitEvent: false });
    this.writing = false;
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.countryControl.disable();
      this.numberControl.disable();
    } else {
      this.countryControl.enable();
      this.numberControl.enable();
    }
  }

  onNumberBlur(): void {
    this.onTouched();
  }

  private reformat(): void {
    const digits = (this.numberControl.value ?? '').replace(/\D/g, '');
    if (digits) {
      this.numberControl.setValue(formatIncompletePhoneNumber(digits, this.country()), { emitEvent: false });
    }
  }

  private emitValue(): void {
    if (this.writing) return;
    const digits = (this.numberControl.value ?? '').replace(/\D/g, '');
    if (!digits) {
      this.onChange(null);
      return;
    }
    const iso = this.country();
    this.onChange(`+${getCountryCallingCode(iso)} ${formatIncompletePhoneNumber(digits, iso)}`);
  }

  private parsePhone(value?: string | null): { iso: CountryCode; national: string } {
    if (!value) return { iso: DEFAULT_COUNTRY, national: '' };
    const detected = maskitoGetCountryFromNumber(value, metadata);
    const iso = detected ?? DEFAULT_COUNTRY;
    const code = getCountryCallingCode(iso);
    const digits = value.replace(/\D/g, '');
    const national = digits.startsWith(code) ? digits.slice(code.length) : digits;
    return { iso, national };
  }
}