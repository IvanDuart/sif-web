import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiDropdown, TuiTextfield, TuiError, TuiLabel } from '@taiga-ui/core';
import { TuiSelect, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { NotificationService } from '../../core/ui';

export interface AssignNutritionistDialogInput {
  patientId: string;
  patientName: string;
  assignedNutritionistId?: string | null;
}

/**
 * Assigns (or clears) a patient's titular nutritionist (V45).
 * Reused from the patient file and from the "Mis pacientes" cartera.
 */
@Component({
  selector: 'app-assign-nutritionist-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslocoDirective,
    TuiButton,
    TuiDropdown,
    TuiTextfield,
    TuiError,
    TuiLabel,
    TuiSelect,
    TuiDataListWrapper,
    TuiChevron,
  ],
  templateUrl: './assign-nutritionist.dialog.html'
})
export class AssignNutritionistDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  readonly context = injectContext<TuiDialogContext<AppUserDto | true, AssignNutritionistDialogInput>>();
  readonly patientId = this.context.data.patientId;
  readonly patientName = this.context.data.patientName;

  saving = signal(false);
  nutritionists = signal<{ label: string; value: string }[]>([]);

  /** Empty string is the "Sin asignar" option, mapped to `null` on submit. */
  nutritionistValues = computed(() => ['', ...this.nutritionists().map(n => n.value)]);

  nutritionistStringify = (value: string): string => {
    if (!value) return this.transloco.translate('users.nutritionist_none');
    return this.nutritionists().find(n => n.value === value)?.label ?? value;
  };

  form = this.fb.group({
    nutritionistId: [this.context.data.assignedNutritionistId ?? '']
  });

  ngOnInit() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.userRoleService.getUsersByTenantAndType(tenantId, 'STAFF', { size: 100 }).subscribe({
      next: (res) => {
        const options = (res.content || [])
          .map(u => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }))
          .sort((a, b) => a.label.localeCompare(b.label));
        this.nutritionists.set(options);
      }
    });
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const nutritionistId = this.form.getRawValue().nutritionistId || null;

    this.saving.set(true);
    this.userRoleService.assignNutritionist(tenantId, this.patientId, nutritionistId).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.notify.success(
          this.transloco.translate('users.assign_nutritionist_success'),
          this.transloco.translate('common.success')
        );
        this.context.$implicit.next(updated);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(
          this.transloco.translate('users.assign_nutritionist_error'),
          this.transloco.translate('common.error')
        );
      }
    });
  }
}
