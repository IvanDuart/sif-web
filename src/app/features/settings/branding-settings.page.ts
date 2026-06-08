import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { FileUploadModule } from 'primeng/fileupload';
import { TenantBrandingService } from '../../core/api/services/tenant-branding.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TenantPreferences } from '../../core/api/models/tenant.model';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-branding-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule, ColorPickerModule, FileUploadModule],
  templateUrl: './branding-settings.page.html'
})
export default class BrandingSettingsPage implements OnInit {
  private tenantBrandingService = inject(TenantBrandingService);
  private tenantCtx = inject(TenantContextService);
  private messageService = inject(MessageService);
  
  preferences = signal<TenantPreferences | null>(null);
  loading = signal(false);
  saving = signal(false);

  ngOnInit() {
    this.loadBranding();
  }

  loadBranding() {
    // For MVP we just initialize a default preferences object if we can't fetch it
    // because GET /branding returns TenantBrandingDto, and GET /tenant/{id} returns full Tenant including preferences
    // For simplicity, we initialize it here:
    this.preferences.set({
      enable_vacation_module: false,
      enable_clock_in_module: false,
      default_language: 'es',
      primary_color: '#000000',
      keycloak_sync_mode: '',
      from_email: '',
      standard_vacation_days: 0
    });
  }

  save() {
    const tenantId = this.tenantCtx.currentTenantId();
    const prefs = this.preferences();
    if (!tenantId || !prefs) return;
    
    this.saving.set(true);
    this.tenantBrandingService.updatePreferences(tenantId, prefs).subscribe({
      next: (res) => {
        this.preferences.set(res);
        this.saving.set(false);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Preferencias actualizadas' });
      },
      error: () => this.saving.set(false)
    });
  }

  uploadLogo(event: any) {
    const tenantId = this.tenantCtx.currentTenantId();
    const file = event.files[0];
    if (!tenantId || !file) return;

    this.tenantBrandingService.updateLogo(tenantId, file).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Logo actualizado' });
        event.options.clear();
      }
    });
  }
}
