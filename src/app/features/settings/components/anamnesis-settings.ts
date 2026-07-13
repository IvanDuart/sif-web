import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule, TranslocoDirective],
  template: `
    <div *transloco="let t" class="py-4">
      <div class="data-card max-w-2xl border border-surface-200 dark:border-surface-700">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-2">
          {{ t('settings.anamnesis_fields_title', { defaultValue: 'Configurar Campos de Anamnesis' }) }}
        </h3>
        <p class="text-sm text-surface-500 mb-6">
          {{ t('settings.anamnesis_fields_desc', { defaultValue: 'Selecciona los campos de anamnesis que estarán activos para los perfiles de pacientes en tu centro.' }) }}
        </p>

        @if (loading()) {
          <div class="flex items-center justify-center py-8">
            <i class="fa-solid fa-spinner fa-spin text-primary-500 text-2xl"></i>
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            @for (field of fields; track field) {
              <label class="flex items-start gap-3 p-3 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  [checked]="isFieldActive(field)"
                  (change)="toggleField(field)"
                  class="mt-1 rounded border-surface-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
                <div>
                  <p class="text-sm font-medium text-surface-900 dark:text-surface-0">
                    {{ t('patient_profile.' + camelToSnake(field)) }}
                  </p>
                </div>
              </label>
            }
          </div>

          <div class="flex justify-end pt-4 border-t border-surface-200 dark:border-surface-700">
            <button class="btn-primary" [disabled]="saving()" (click)="save()">
              @if (saving()) {
                <i class="fa-solid fa-spinner fa-spin mr-2"></i>
              }
              {{ t('common.save') }}
            </button>
          </div>
        }
      </div>
    </div>
  `
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
