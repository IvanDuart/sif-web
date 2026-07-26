import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiCheckbox } from '@taiga-ui/core';
import { TenantService } from '../../../core/api/services/tenant.api';
import { TenantBrandingService } from '../../../core/api/services/tenant-branding.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { TenantPreferences } from '../../../core/api/models/tenant.model';
import { TranslocoDirective } from '@jsverse/transloco';
import { NotificationService } from '../../../core/ui';

const ALL_ANAMNESIS_FIELDS = [
  'consultationReason',
  'diseases',
  'medicalHistory',
  'habits',
  'lifestyle',
  'exercise',
  'psyche',
  'allergiesIntolerances',
  'foodPreferences',
  'medicationSupplements',
  'gastrointestinalStatus',
  'hormonalCycle'
];

@Component({
  selector: 'app-anamnesis-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoDirective, TuiCheckbox, TuiButton],
  templateUrl: './anamnesis-settings.html'
})
export class AnamnesisSettings implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly tenantBrandingService = inject(TenantBrandingService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);

  fields = ALL_ANAMNESIS_FIELDS;
  loading = signal(false);
  saving = signal(false);

  preferences = signal<TenantPreferences | null>(null);
  activeFields = signal<string[]>([]);

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.tenantService.getById(tenantId).subscribe({
      next: (tenant) => {
        this.preferences.set(tenant.preferences || null);
        const active = tenant.preferences?.active_anamnesis_fields;
        this.activeFields.set(active || [...ALL_ANAMNESIS_FIELDS]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  isFieldActive(field: string): boolean {
    return this.activeFields().includes(field);
  }

  toggleField(field: string) {
    const current = this.activeFields();
    if (current.includes(field)) {
      this.activeFields.set(current.filter(f => f !== field));
    } else {
      this.activeFields.set([...current, field]);
    }
  }

  save() {
    const tenantId = this.tenantCtx.currentTenantId();
    const prefs = this.preferences();
    if (!tenantId || !prefs) return;

    this.saving.set(true);
    const updatedPrefs: TenantPreferences = {
      ...prefs,
      active_anamnesis_fields: this.activeFields()
    };

    this.tenantBrandingService.updatePreferences(tenantId, updatedPrefs).subscribe({
      next: (res) => {
        this.preferences.set(res);
        this.activeFields.set(res.active_anamnesis_fields || [...ALL_ANAMNESIS_FIELDS]);
        this.saving.set(false);
        this.notify.success('Éxito: Configuración de anamnesis guardada');
      },
      error: () => {
        this.saving.set(false);
        this.notify.error('Error: No se pudo guardar la configuración');
      }
    });
  }

  camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
