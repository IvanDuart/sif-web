import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Textarea } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UserTenantProfileDto } from '../../core/api/models/user.model';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-patient-profile-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, Textarea, InputTextModule, TranslocoDirective],
  templateUrl: './patient-profile-form.dialog.html'
})
export class PatientProfileFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly messageService = inject(MessageService);
  private readonly transloco = inject(TranslocoService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  saving = false;
  profile: UserTenantProfileDto = this.config.data.profile;
  userId: string = this.config.data.userId;

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
        this.messageService.add({
          severity: 'success',
          summary: this.transloco.translate('common.success'),
          detail: this.transloco.translate('patient_profile.save_success')
        });
        this.ref.close(true);
      },
      error: () => {
        this.saving = false;
        this.messageService.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: this.transloco.translate('patient_profile.save_error')
        });
      }
    });
  }
}
