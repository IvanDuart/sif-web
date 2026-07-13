import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiTextfield } from '@taiga-ui/core';
import { TenantBrandingService } from '../../../core/api/services/tenant-branding.api';
import { TenantService } from '../../../core/api/services/tenant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { TenantPreferences } from '../../../core/api/models/tenant.model';
import { TranslocoDirective } from '@jsverse/transloco';
import { NotificationService } from '../../../core/ui';

@Component({
  selector: 'app-branding-settings',
  standalone: true,
  imports: [FormsModule, TuiTextfield, TranslocoDirective],
  template: `
    <div *transloco="let t" class="py-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="data-card">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="primaryColor" class="text-sm font-medium text-surface-700">{{ t('settings.primary_color') }}</label>
              <input
                type="color"
                id="primaryColor"
                [(ngModel)]="preferences().primary_color"
                class="h-10 w-full rounded-lg border border-surface-300 cursor-pointer bg-transparent" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="fromEmail" class="text-sm font-medium text-surface-700">{{ t('settings.from_email') }}</label>
              <tui-textfield>
                <input
                  id="fromEmail"
                  tuiTextfield
                  [(ngModel)]="preferences().from_email" />
              </tui-textfield>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="defaultLang" class="text-sm font-medium text-surface-700">{{ t('settings.default_language') }}</label>
              <tui-textfield>
                <input
                  id="defaultLang"
                  tuiTextfield
                  [(ngModel)]="preferences().default_language" />
              </tui-textfield>
            </div>

            <button class="btn-primary" [disabled]="saving()" (click)="save()">
              @if (saving()) {
                <i class="fa-solid fa-spinner fa-spin"></i>
              }
              {{ t('common.save') }}
            </button>
          </div>
        </div>

        <div class="data-card">
          <div class="flex flex-col gap-4">
            <input type="file" accept="image/*" class="form-input" (change)="onFileSelected($event)" />
            <p class="text-sm text-surface-400">{{ t('settings.logo_hint') }}</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class BrandingSettings implements OnInit {
  private readonly tenantBrandingService = inject(TenantBrandingService);
  private readonly tenantService = inject(TenantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);

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
        this.notify.success('Éxito: Preferencias actualizadas');
      },
      error: () => this.saving.set(false)
    });
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadLogo(file);
  }

  private uploadLogo(file: File) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.tenantBrandingService.updateLogo(tenantId, file).subscribe({
      next: () => {
        this.notify.success('Éxito: Logo actualizado');
      }
    });
  }
}
