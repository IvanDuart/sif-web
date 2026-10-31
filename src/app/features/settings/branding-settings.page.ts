import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BrandingSettings } from './components/branding-settings';
import { AppointmentTypesSettings } from './components/appointment-types-settings';
import { ScheduleSettings } from './components/schedule-settings';
import { TenantAddressSettings } from './components/tenant-address-settings';
import { AssistantSettings } from './components/assistant-settings';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { TranslocoDirective } from '@jsverse/transloco';

/**
 * Las secciones de Ajustes no tienen ruta propia, pero sí nombre: `?tab=`
 * permite enlazar (y que la mascota abra) una sección concreta sin que nadie
 * tenga que saberse el índice de la pestaña.
 */
const TABS = ['branding', 'appointment-types', 'schedules', 'address', 'assistant'] as const;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, BrandingSettings, AppointmentTypesSettings, ScheduleSettings, TenantAddressSettings, AssistantSettings, IfPermissionDirective, TranslocoDirective],
  templateUrl: './branding-settings.page.html'
})
export default class SettingsPage {
  activeTab = 0;

  constructor() {
    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    const index = TABS.indexOf((tab ?? '') as (typeof TABS)[number]);
    if (index >= 0) this.activeTab = index;
  }
}
