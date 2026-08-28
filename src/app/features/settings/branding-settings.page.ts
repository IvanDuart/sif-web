import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiTabs } from '@taiga-ui/kit';
import { BrandingSettings } from './components/branding-settings';
import { AppointmentTypesSettings } from './components/appointment-types-settings';
import { ScheduleSettings } from './components/schedule-settings';
import { TenantAddressSettings } from './components/tenant-address-settings';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, TuiTabs, BrandingSettings, AppointmentTypesSettings, ScheduleSettings, TenantAddressSettings, TranslocoDirective],
  templateUrl: './branding-settings.page.html'
})
export default class SettingsPage {
  activeTab = 0;
}
