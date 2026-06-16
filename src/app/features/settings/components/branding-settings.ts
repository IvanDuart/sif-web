import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { FileUploadModule } from 'primeng/fileupload';
import { TenantBrandingService } from '../../../core/api/services/tenant-branding.api';
import { TenantService } from '../../../core/api/services/tenant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { TenantPreferences } from '../../../core/api/models/tenant.model';
import { MessageService } from 'primeng/api';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-branding-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule, ColorPickerModule, FileUploadModule, TranslocoDirective],
  template: `
    <div *transloco="let t" class="py-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <p-card [header]="t('settings.branding')">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="primaryColor" class="text-sm font-medium text-surface-700">{{ t('settings.primary_color') }}</label>
              <p-colorPicker
                id="primaryColor"
                [(ngModel)]="preferences().primary_color"
                styleClass="w-full" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="fromEmail" class="text-sm font-medium text-surface-700">{{ t('settings.from_email') }}</label>
              <input
                id="fromEmail"
                pInputText
                [(ngModel)]="preferences().from_email"
                class="w-full" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="defaultLang" class="text-sm font-medium text-surface-700">{{ t('settings.default_language') }}</label>
              <input
                id="defaultLang"
                pInputText
                [(ngModel)]="preferences().default_language"
                class="w-full" />
            </div>

            <p-button
              [label]="t('common.save')"
              [loading]="saving()"
              (onClick)="save()">
            </p-button>
          </div>
        </p-card>

        <p-card [header]="t('settings.logo')">
          <div class="flex flex-col gap-4">
            <p-fileUpload
              mode="basic"
              accept="image/*"
              [maxFileSize]="2097152"
              [auto]="true"
              chooseLabel="Subir logo"
              [customUpload]="true"
              (uploadHandler)="uploadLogo($event)">
            </p-fileUpload>
            <p class="text-sm text-surface-400">{{ t('settings.logo_hint') }}</p>
          </div>
        </p-card>
      </div>
    </div>
  `
})
export class BrandingSettings implements OnInit {
  private tenantBrandingService = inject(TenantBrandingService);
  private tenantService = inject(TenantService);
  private tenantCtx = inject(TenantContextService);
  private messageService = inject(MessageService);

  preferences = signal<TenantPreferences>({
    enable_vacation_module: false,
    enable_clock_in_module: false,
    default_language: 'es',
    primary_color: '#000000',
    keycloak_sync_mode: '',
    from_email: '',
    standard_vacation_days: 0
  });
  saving = signal(false);
  loading = signal(false);

  ngOnInit() {
    this.loadBranding();
  }

  loadBranding() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loading.set(true);
    this.tenantService.getById(tenantId).subscribe({
      next: (tenant) => {
        this.preferences.set(tenant.preferences ?? {
          enable_vacation_module: false,
          enable_clock_in_module: false,
          default_language: 'es',
          primary_color: '#000000',
          keycloak_sync_mode: '',
          from_email: '',
          standard_vacation_days: 0
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
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

  uploadLogo(event: { files: File[] }) {
    const tenantId = this.tenantCtx.currentTenantId();
    const file = event.files[0];
    if (!tenantId || !file) return;
    this.tenantBrandingService.updateLogo(tenantId, file).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Logo actualizado' });
      }
    });
  }
}
