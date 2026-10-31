import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiSwitch, TuiComboBox, TuiDataListWrapper, TuiChevron, TuiFiles, TuiBadge } from '@taiga-ui/kit';
import { TenantBrandingService } from '../../../core/api/services/tenant-branding.api';
import { TenantService } from '../../../core/api/services/tenant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { AppointmentTimeBand, NutrientDisplayMode, TenantPreferences, TenantPreferencesPatch } from '../../../core/api/models/tenant.model';
import { TranslocoDirective } from '@jsverse/transloco';
import { ThemeService } from '../../../core/branding/theme.service';
import { NotificationService } from '../../../core/ui';
import { BrandingStore } from '../../../core/branding/branding.store';
import { IfPermissionDirective } from '../../../core/permissions/if-permission.directive';

const LANGUAGE_OPTIONS = [
  { label: 'Español', value: 'es' },
  { label: 'English', value: 'en' },
];

/**
 * Valores por defecto de las preferencias del tenant.
 *
 * Fuente única: el guardado hace un PUT del objeto completo, así que una clave
 * que falte aquí se enviaría como `undefined`. Un tenant guardado antes de que
 * existiera una clave la devuelve ausente, por eso el estado se construye
 * extendiendo este objeto con la respuesta del servidor y no sustituyéndolo.
 */
const DEFAULT_PREFERENCES: TenantPreferences = {
  enable_vacation_module: false,
  enable_clock_in_module: false,
  ai_enabled: false,
  nutrient_display_mode: 'HIDDEN',
  default_language: 'es',
  primary_color: '#059669',
  keycloak_sync_mode: '',
  from_email: '',
  standard_vacation_days: 0,
  active_anamnesis_fields: [],
  show_price: false,
  enable_appointment_reminders: true,
  menu_creation_mode: 'MANUAL',
  attendance_target_rate: 0.9,
  cancellation_notice_threshold_hours: 24,
  appointment_time_bands: [],
};

@Component({
  selector: 'app-branding-settings',
  standalone: true,
  imports: [
    FormsModule, TranslocoDirective, IfPermissionDirective,
    TuiButton, TuiInput, TuiTextfield, TuiDropdown, TuiFilterByInputPipe,
    TuiSwitch, TuiComboBox, TuiDataListWrapper, TuiChevron, TuiBadge, ...TuiFiles,
  ],
  templateUrl: `branding-settings.html`
})
export class BrandingSettings implements OnInit, OnDestroy {
  private readonly tenantBrandingService = inject(TenantBrandingService);
  private readonly tenantService = inject(TenantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly themeService = inject(ThemeService);
  private readonly brandingStore = inject(BrandingStore);

  readonly languageLabels = LANGUAGE_OPTIONS.map(l => l.label);
  readonly languageDisplay = signal('');
  readonly nutrientDisplayModeOptions: { label: string; value: NutrientDisplayMode }[] = [
    { label: 'Ocultos', value: 'HIDDEN' },
    { label: 'Macros', value: 'MACROS' },
    { label: 'Completos', value: 'FULL' },
  ];
  readonly nutrientDisplayModeLabels = this.nutrientDisplayModeOptions.map(o => o.label);
  readonly nutrientDisplayModeDisplay = signal('Ocultos');

  preferences = signal<TenantPreferences>({ ...DEFAULT_PREFERENCES });
  private loadedPreferences = signal<TenantPreferences | null>(null);
  /** Clave nueva que el usuario escribe para guardar/rotar (nunca se lee de la API). */
  readonly geminiApiKeyInput = signal('');
  readonly hasApiKey = computed(() => this.brandingStore.branding()?.hasApiKey === true);

  readonly isBedcaMode = computed(() => this.preferences().menu_creation_mode === 'BEDCA');

  /**
   * Objetivo de asistencia en % (0..100). Se guarda en preferencias como 0..1.
   * Redondeo a 1 decimal para que el input no muestre colas de coma flotante.
   */
  readonly targetRatePercent = computed(() =>
    Math.round((this.preferences().attendance_target_rate ?? 0.9) * 1000) / 10
  );

  readonly timeBands = computed<AppointmentTimeBand[]>(
    () => this.preferences().appointment_time_bands ?? []
  );

  setTargetRatePercent(value: number | string | null): void {
    const raw = typeof value === 'string' ? value.trim() : value;
    // Mientras se borra el campo no se pisa el valor guardado.
    if (raw === '' || raw == null) return;
    const n = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw;
    const safe = Number.isNaN(n) ? 0.9 : Math.min(1, Math.max(0, n / 100));
    this.preferences.update(p => ({ ...p, attendance_target_rate: safe }));
  }

  addTimeBand(): void {
    this.preferences.update(p => ({
      ...p,
      appointment_time_bands: [
        ...(p.appointment_time_bands ?? []),
        { label: '', from: '09:00', to: '14:00' },
      ],
    }));
  }

  removeTimeBand(index: number): void {
    this.preferences.update(p => ({
      ...p,
      appointment_time_bands: (p.appointment_time_bands ?? []).filter((_, i) => i !== index),
    }));
  }

  updateTimeBand(index: number, field: keyof AppointmentTimeBand, value: string): void {
    this.preferences.update(p => ({
      ...p,
      appointment_time_bands: (p.appointment_time_bands ?? []).map((band, i) =>
        i === index ? { ...band, [field]: value } : band
      ),
    }));
  }

  setBedcaMode(enabled: boolean) {
    this.preferences.update(prefs => ({
      ...prefs,
      menu_creation_mode: enabled ? 'BEDCA' : 'MANUAL',
    }));
  }

  onNutrientDisplayModeChange(label: string): void {
    this.nutrientDisplayModeDisplay.set(label);
    const value = this.nutrientDisplayModeOptions.find(o => o.label === label)?.value ?? 'HIDDEN';
    this.preferences.update(prefs => ({ ...prefs, nutrient_display_mode: value }));
  }
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
    this.tenantService.getProfile(tenantId).subscribe({
      next: (tenant) => {
        // El spread rellena las claves que el tenant todavía no tenga guardadas.
        const prefs: TenantPreferences = { ...DEFAULT_PREFERENCES, ...(tenant.preferences ?? {}) };
        if (prefs.enable_appointment_reminders === undefined || prefs.enable_appointment_reminders === null) {
          prefs.enable_appointment_reminders = true;
        }
        if (prefs.attendance_target_rate === undefined || prefs.attendance_target_rate === null) {
          prefs.attendance_target_rate = DEFAULT_PREFERENCES.attendance_target_rate;
        }
        if (prefs.cancellation_notice_threshold_hours === undefined || prefs.cancellation_notice_threshold_hours === null) {
          prefs.cancellation_notice_threshold_hours = DEFAULT_PREFERENCES.cancellation_notice_threshold_hours;
        }
        if (!Array.isArray(prefs.appointment_time_bands)) {
          prefs.appointment_time_bands = [];
        }
        this.preferences.set(prefs);
        this.loadedPreferences.set({ ...prefs });
        const found = LANGUAGE_OPTIONS.find(l => l.value === prefs.default_language);
        this.languageDisplay.set(found?.label ?? prefs.default_language);
        const nutrientMode = this.nutrientDisplayModeOptions.find(o => o.value === prefs.nutrient_display_mode);
        this.nutrientDisplayModeDisplay.set(nutrientMode?.label ?? this.nutrientDisplayModeOptions[0].label);
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
    if (!tenantId) return;

    const prefs = { ...this.preferences() };
    const found = LANGUAGE_OPTIONS.find(l => l.label === this.languageDisplay());
    prefs.default_language = found?.value ?? this.languageDisplay();
    this.preferences.set(prefs);

    const loaded = this.loadedPreferences();
    const patch: TenantPreferencesPatch = {};
    const editableKeys: (keyof TenantPreferences)[] = [
      'enable_vacation_module',
      'enable_clock_in_module',
      'ai_enabled',
      'default_language',
      'primary_color',
      'keycloak_sync_mode',
      'from_email',
      'standard_vacation_days',
      'active_anamnesis_fields',
      'show_price',
      'enable_appointment_reminders',
      'menu_creation_mode',
      'attendance_target_rate',
      'cancellation_notice_threshold_hours',
      'appointment_time_bands',
      'nutrient_display_mode',
    ];

    for (const key of editableKeys) {
      if (!loaded || JSON.stringify(prefs[key]) !== JSON.stringify(loaded[key])) {
        (patch as Record<string, unknown>)[key] = prefs[key];
      }
    }

    const newKey = this.geminiApiKeyInput().trim();
    if (newKey) patch.gemini_api_key = newKey;

    if (Object.keys(patch).length === 0) {
      this.notify.success('Éxito: Preferencias actualizadas');
      return;
    }

    this.saving.set(true);
    this.tenantBrandingService.patchPreferences(tenantId, patch).subscribe({
      next: (res) => {
        const merged: TenantPreferences = { ...DEFAULT_PREFERENCES, ...res };
        this.preferences.set(merged);
        this.loadedPreferences.set({ ...merged });
        this.geminiApiKeyInput.set('');
        this.themeService.setPrimary(merged.primary_color ?? '#059669');
        // Sin esto el modo recién guardado no se aplicaría hasta recargar la página.
        this.brandingStore.branding.update(branding =>
          branding
            ? {
                ...branding,
                menuCreationMode: merged.menu_creation_mode ?? 'MANUAL',
                aiEnabled: merged.ai_enabled,
                hasApiKey: newKey ? true : branding.hasApiKey,
              }
            : branding
        );
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
