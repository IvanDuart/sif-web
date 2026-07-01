import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrandingSettings } from './components/branding-settings';
import { AppointmentTypesSettings } from './components/appointment-types-settings';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, BrandingSettings, AppointmentTypesSettings, TranslocoDirective],
  templateUrl: './branding-settings.page.html'
})
export default class SettingsPage {
  activeTab = '0';
}
