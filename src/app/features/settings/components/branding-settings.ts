import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiSwitch, TuiComboBox, TuiDataListWrapper, TuiChevron, TuiFiles } from '@taiga-ui/kit';
import { TenantBrandingService } from '../../../core/api/services/tenant-branding.api';
import { TenantService } from '../../../core/api/services/tenant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { TenantPreferences } from '../../../core/api/models/tenant.model';
import { TranslocoDirective } from '@jsverse/transloco';
import { ThemeService } from '../../../core/branding/theme.service';
import { NotificationService } from '../../../core/ui';

const LANGUAGE_OPTIONS = [
  { label: 'Español', value: 'es' },
  { label: 'English', value: 'en' },
];

@Component({
  selector: 'app-branding-settings',
  standalone: true,
  imports: [
    FormsModule, TranslocoDirective,
    TuiButton, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe,
    TuiSwitch, TuiComboBox, TuiDataListWrapper, TuiChevron, ...TuiFiles,
  ],
  templateUrl: `branding-settings.html`
})
export class BrandingSettings implements OnInit, OnDestroy {
  private readonly tenantBrandingService = inject(TenantBrandingService);
  private readonly tenantService = inject(TenantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly themeService = inject(ThemeService);

  readonly languageLabels = LANGUAGE_OPTIONS.map(l => l.label);
  readonly languageDisplay = signal('');

  preferences = signal<TenantPreferences>({
    enable_vacation_module: false,
    enable_clock_in_module: false,
    ai_enabled: false,
    gemini_api_key: '',
    default_language: 'es',
    primary_color: '#059669',
    keycloak_sync_mode: '',
    from_email: '',
    standard_vacation_days: 0,
    show_price: false,
    enable_appointment_reminders: true
  });
  saving = signal(false);
  loading = signal(false);
  logoUrl = signal<string | null>(null);
  logoPdfUrl = signal<string | null>(null);
  private currentLogoBlobUrl: string | null = null;
  private currentLogoPdfBlobUrl: string | null = null;

  private revokeLogo() {
    if (this.currentLogoBlobUrl) {
      URL.revokeObjectURL(this.currentLogoBlobUrl);
      this.currentLogoBlobUrl = null;
    }
  }

  private revokeLogoPdf() {
    if (this.currentLogoPdfBlobUrl) {
      URL.revokeObjectURL(this.currentLogoPdfBlobUrl);
      this.currentLogoPdfBlobUrl = null;
    }
  }

  private setLogoFromBlob(blob: Blob) {
    this.revokeLogo();
    const url = URL.createObjectURL(blob);
    this.currentLogoBlobUrl = url;
    this.logoUrl.set(url);
  }

  private setLogoPdfFromBlob(blob: Blob) {
    this.revokeLogoPdf();
    const url = URL.createObjectURL(blob);
    this.currentLogoPdfBlobUrl = url;
    this.logoPdfUrl.set(url);
  }

  ngOnInit() {
    this.loadBranding();
  }

  ngOnDestroy() {
    this.revokeLogo();
    this.revokeLogoPdf();
  }

  loadBranding() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loading.set(true);
    this.tenantService.getById(tenantId).subscribe({
      next: (tenant) => {
        const prefs = tenant.preferences ?? {
          enable_vacation_module: false,
          enable_clock_in_module: false,
          ai_enabled: false,
          gemini_api_key: '',
          default_language: 'es',
          primary_color: '#059669',
          keycloak_sync_mode: '',
          from_email: '',
          standard_vacation_days: 0,
          show_price: false,
          enable_appointment_reminders: true
        };
        if (prefs.enable_appointment_reminders === undefined || prefs.enable_appointment_reminders === null) {
          prefs.enable_appointment_reminders = true;
        }
        this.preferences.set(prefs);
        const found = LANGUAGE_OPTIONS.find(l => l.value === prefs.default_language);
        this.languageDisplay.set(found?.label ?? prefs.default_language);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
    this.tenantBrandingService.getLogo(tenantId).subscribe({
      next: (blob) => {
        if (blob.size > 0) {
          this.setLogoFromBlob(blob);
        }
      },
      error: () => { /* handle silently */ }
    });
    this.tenantBrandingService.getLogoPdf(tenantId).subscribe({
      next: (blob) => {
        if (blob.size > 0) {
          this.setLogoPdfFromBlob(blob);
        }
      },
      error: () => { /* handle silently */ }
    });
  }

  save() {
    const tenantId = this.tenantCtx.currentTenantId();
    const prefs = { ...this.preferences() };
    if (!tenantId) return;
    const found = LANGUAGE_OPTIONS.find(l => l.label === this.languageDisplay());
    prefs.default_language = found?.value ?? this.languageDisplay();
    this.preferences.set(prefs);
    this.saving.set(true);
    this.tenantBrandingService.updatePreferences(tenantId, prefs).subscribe({
      next: (res) => {
        this.preferences.set(res);
        this.themeService.setPrimary(res.primary_color ?? '#059669');
        this.saving.set(false);
        this.notify.success('Éxito: Preferencias actualizadas');
      },
      error: () => this.saving.set(false)
    });
  }

  onFileSelected(file: File | null) {
    if (!file) return;
    this.uploadLogo(file);
  }

  private uploadLogo(file: File) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.tenantBrandingService.updateLogo(tenantId, file).subscribe({
      next: () => {
        this.setLogoFromBlob(file);
        this.notify.success('Éxito: Logo actualizado');
      }
    });
  }

  onPdfFileSelected(file: File | null) {
    if (!file) return;
    this.uploadLogoPdf(file);
  }

  private uploadLogoPdf(file: File) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.tenantBrandingService.updateLogoPdf(tenantId, file).subscribe({
      next: () => {
        this.setLogoPdfFromBlob(file);
        this.notify.success('Éxito: Logo PDF actualizado');
      }
    });
  }
}
