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
import { MascotFillService } from '../assistant/mascot/fill/mascot-fill.service';
import { TENANT_PROFILE_OPENER } from '../assistant/mascot/fill/surfaces/tenant-profile.surface';
import { APPOINTMENT_TYPE_OPENER } from '../assistant/mascot/fill/surfaces/appointment-type.surface';
import { SCHEDULE_OPENER } from '../assistant/mascot/fill/surfaces/schedule.surface';
import { SCHEDULE_ASSIGNMENT_OPENER } from '../assistant/mascot/fill/surfaces/schedule-assignment.surface';
import { HOLIDAY_OPENER } from '../assistant/mascot/fill/surfaces/holiday.surface';

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
    // Los openers de Ajustes se registran AQUÍ y no en cada sección, porque
    // sólo está montada la sección de la pestaña activa: si los registrara
    // cada una, la mascota sólo sabría abrir el formulario de la pestaña en la
    // que ya estuviera. Su `reveal` pulsa la pestaña y entonces la sección
    // monta, que es justo lo que haría una persona.
    const fill = inject(MascotFillService);
    fill.registerOpener(TENANT_PROFILE_OPENER);
    fill.registerOpener(APPOINTMENT_TYPE_OPENER);
    fill.registerOpener(SCHEDULE_OPENER);
    fill.registerOpener(SCHEDULE_ASSIGNMENT_OPENER);
    fill.registerOpener(HOLIDAY_OPENER);

    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    const index = TABS.indexOf((tab ?? '') as (typeof TABS)[number]);
    if (index >= 0) this.activeTab = index;
  }
}
