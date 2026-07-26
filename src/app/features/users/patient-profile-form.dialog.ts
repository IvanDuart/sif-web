import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { TuiButton } from '@taiga-ui/core';
import { NotificationService } from '../../core/ui/notification.service';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TenantService } from '../../core/api/services/tenant.api';
import { UserTenantProfileDto } from '../../core/api/models/user.model';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-patient-profile-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslocoDirective, TuiButton],
  templateUrl: './patient-profile-form.dialog.html'
})
export class PatientProfileFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly tenantService = inject(TenantService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, { profile: UserTenantProfileDto; userId: string }>>();
  ref = { close: () => this.context.$implicit.complete() };

  saving = false;
  profile: UserTenantProfileDto = this.context.data.profile;
  userId: string = this.context.data.userId;
  activeFields = signal<string[]>([]);

  ngOnInit() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (tenantId) {
      this.tenantService.getById(tenantId).subscribe({
        next: (tenant) => {
          this.activeFields.set(tenant.preferences?.active_anamnesis_fields || []);
        }
      });
    }
  }

  isFieldActive(field: string): boolean {
    const active = this.activeFields();
    return active.length === 0 || active.includes(field);
  }

  form = this.fb.group({
    consultationReason: [this.profile.consultationReason ?? ''],
    diseases: [this.profile.diseases ?? ''],
    medicalHistory: [this.profile.medicalHistory ?? ''],
    habits: [this.profile.habits ?? ''],
    lifestyle: [this.profile.lifestyle ?? ''],
    exercise: [this.profile.exercise ?? ''],
    psyche: [this.profile.psyche ?? ''],
    allergiesIntolerances: [this.profile.allergiesIntolerances ?? ''],
    foodPreferences: [this.profile.foodPreferences ?? ''],
    medicationSupplements: [this.profile.medicationSupplements ?? ''],
    gastrointestinalStatus: [this.profile.gastrointestinalStatus ?? ''],
    hormonalCycle: [this.profile.hormonalCycle ?? '']
  });

  submit() {
    if (this.form.invalid) return;

    const raw = this.form.value;
    const request: UserTenantProfileDto = {
      ...this.profile,
      consultationReason: raw.consultationReason || null,
      diseases: raw.diseases || null,
      medicalHistory: raw.medicalHistory || null,
      habits: raw.habits || null,
      lifestyle: raw.lifestyle || null,
      exercise: raw.exercise || null,
      psyche: raw.psyche || null,
      allergiesIntolerances: raw.allergiesIntolerances || null,
      foodPreferences: raw.foodPreferences || null,
      medicationSupplements: raw.medicationSupplements || null,
      gastrointestinalStatus: raw.gastrointestinalStatus || null,
      hormonalCycle: raw.hormonalCycle || null
    };

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving = true;
    this.userRoleService.updatePatientProfile(tenantId, this.userId, request).subscribe({
      next: () => {
        this.saving = false;
        this.notify.success(this.transloco.translate('patient_profile.save_success'), this.transloco.translate('common.success'));
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving = false;
        this.notify.error(this.transloco.translate('patient_profile.save_error'), this.transloco.translate('common.error'));
      }
    });
  }
}
