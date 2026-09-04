import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiInput, TuiTextfield, TuiLabel } from '@taiga-ui/core';
import { NotificationService } from '../../core/ui/notification.service';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UserTenantProfileDto } from '../../core/api/models/user.model';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

export interface BoneMassDialogInput {
  userId: string;
  boneMassKg?: number | null;
  currentProfile?: UserTenantProfileDto | null;
}

@Component({
  selector: 'app-bone-mass-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslocoDirective,
    TuiButton,
    TuiInput,
    TuiTextfield,
    TuiLabel
  ],
  templateUrl: './bone-mass.dialog.html'
})
export class BoneMassDialog {
  private readonly fb = inject(FormBuilder);
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, BoneMassDialogInput>>();

  saving = signal(false);
  userId = this.context.data.userId;
  initialBoneMass = this.context.data.boneMassKg ?? null;

  form = this.fb.group({
    boneMassKg: [this.initialBoneMass, [Validators.required, Validators.min(0.5), Validators.max(10.0)]]
  });

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.value;
    const currentProfile = this.context.data.currentProfile || ({} as UserTenantProfileDto);
    const request: UserTenantProfileDto = {
      ...currentProfile,
      boneMassKg: raw.boneMassKg != null ? Number(raw.boneMassKg) : null
    };

    this.saving.set(true);
    this.userTenantRoleService.updatePatientProfile(tenantId, this.userId, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(
          this.transloco.translate('measurements.bone_mass_saved'),
          this.transloco.translate('common.success')
        );
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(
          this.transloco.translate('patient_profile.save_error'),
          this.transloco.translate('common.error')
        );
      }
    });
  }
}
