import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrandingSettings } from './components/branding-settings';
import { AppointmentTypesSettings } from './components/appointment-types-settings';
import { ScheduleSettings } from './components/schedule-settings';
import { TenantAddressSettings } from './components/tenant-address-settings';
import { AssistantSettings } from './components/assistant-settings';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, BrandingSettings, AppointmentTypesSettings, ScheduleSettings, TenantAddressSettings, AssistantSettings, IfPermissionDirective, TranslocoDirective],
  templateUrl: './branding-settings.page.html'
})
export default class SettingsPage {
  activeTab = 0;
}
