import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrandingSettings } from './components/branding-settings';
import { AppointmentTypesSettings } from './components/appointment-types-settings';
import { AnamnesisSettings } from './components/anamnesis-settings';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, BrandingSettings, AppointmentTypesSettings, AnamnesisSettings, TranslocoDirective],
  templateUrl: './branding-settings.page.html'
})
export default class SettingsPage {
  activeTab = '0';
}
