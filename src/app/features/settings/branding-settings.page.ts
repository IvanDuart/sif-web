import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { BrandingSettings } from './components/branding-settings';
import { AppointmentTypesSettings } from './components/appointment-types-settings';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TabsModule, BrandingSettings, AppointmentTypesSettings, TranslocoDirective],
  templateUrl: './branding-settings.page.html'
})
export default class SettingsPage {
  activeTab = '0';
}
