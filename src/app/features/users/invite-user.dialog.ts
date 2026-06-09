import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UserType } from '../../core/api/models/user.model';

@Component({
  selector: 'app-invite-user',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, InputTextModule, InputNumberModule, DatePickerModule, SelectModule],
  templateUrl: './invite-user.dialog.html'
})
export class InviteUserDialog {
  private fb = inject(FormBuilder);
  private userRoleService = inject(UserTenantRoleService);
  private tenantCtx = inject(TenantContextService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  lockedUserType = this.config.data?.lockedUserType as UserType | undefined;

  saving = signal(false);

  isStaffInvite = computed(() => this.lockedUserType === 'STAFF');

  roles = computed(() => {
    if (this.lockedUserType === 'PATIENT') {
      return [{ label: 'Paciente', value: 'USER' }];
    }
    if (this.lockedUserType === 'STAFF') {
      return [
        { label: 'Administrador', value: 'ADMIN' },
        { label: 'Nutricionista', value: 'NUTRITIONIST' }
      ];
    }
    return [
      { label: 'Administrador', value: 'ADMIN' },
      { label: 'Nutricionista', value: 'NUTRITIONIST' },
      { label: 'Paciente', value: 'USER' }
    ];
  });

  showClinicalFields = computed(() => {
    if (this.lockedUserType === 'STAFF') return false;
    const role = this.form.get('roleCode')?.value;
    return role === 'USER' || !role;
  });

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    roleCode: [{ value: '', disabled: false }, Validators.required],
    birthDate: [null as Date | null],
    heightCm: [null as number | null]
  });

  constructor() {
    if (this.lockedUserType === 'PATIENT') {
      this.form.patchValue({ roleCode: 'USER' });
      this.form.get('roleCode')?.disable();
    } else if (this.lockedUserType === 'STAFF') {
      this.form.patchValue({ roleCode: 'NUTRITIONIST' });
    }
  }

  submit() {
    if (this.form.invalid) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.getRawValue();
    const request: any = {
      email: raw.email,
      firstName: raw.firstName,
      lastName: raw.lastName,
      roleCode: raw.roleCode,
    };
    if (raw.birthDate) {
      request.birthDate = (raw.birthDate as Date).toISOString().slice(0, 10);
    }
    if (raw.heightCm != null) {
      request.heightCm = raw.heightCm;
    }

    this.saving.set(true);
    this.userRoleService.inviteUser(tenantId, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.ref.close(true);
      },
      error: () => this.saving.set(false)
    });
  }
}
