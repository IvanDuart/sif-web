import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiTextfield } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { UserTenantRoleService, InviteUserRequest } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { UserType, Gender } from '../../core/api/models/user.model';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

export interface InviteUserDialogInput {
  lockedUserType?: UserType;
}

@Component({
  selector: 'app-invite-user',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TuiTextfield, TranslocoDirective],
  templateUrl: './invite-user.dialog.html'
})
export class InviteUserDialog {
  private readonly fb = inject(FormBuilder);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, InviteUserDialogInput>>();

  lockedUserType = this.context.data?.lockedUserType;

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

  genderOptions = [
    { label: this.transloco.translate('users.gender_male'), value: 'MALE' as Gender },
    { label: this.transloco.translate('users.gender_female'), value: 'FEMALE' as Gender }
  ];

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
    birthDate: [null as string | null],
    heightCm: [null as number | null],
    gender: [null as Gender | null]
  });

  constructor() {
    if (this.lockedUserType === 'PATIENT') {
      this.form.patchValue({ roleCode: 'USER' });
      this.form.get('roleCode')?.disable();
    } else if (this.lockedUserType === 'STAFF') {
      this.form.patchValue({ roleCode: 'NUTRITIONIST' });
    }
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.getRawValue();
    const request: InviteUserRequest = {
      email: raw.email!,
      firstName: raw.firstName!,
      lastName: raw.lastName!,
      roleCode: raw.roleCode!,
    };
    if (raw.birthDate) {
      request.birthDate = raw.birthDate;
    }
    if (raw.heightCm != null) {
      request.heightCm = raw.heightCm;
    }
    if (raw.gender) {
      request.gender = raw.gender;
    }

    this.saving.set(true);
    this.userRoleService.inviteUser(tenantId, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
