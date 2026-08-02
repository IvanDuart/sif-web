import { Component, inject, computed } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiInput, TuiDropdown } from '@taiga-ui/core';
import { TuiInputDate, TuiSelect, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TuiDay } from '@taiga-ui/cdk';
import { NotificationService } from '../../core/ui/notification.service';
import { UserTenantRoleService, UpdateUserRequest } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto, Gender } from '../../core/api/models/user.model';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap, map, catchError, of } from 'rxjs';

export interface EditUserDialogInput {
  user: AppUserDto;
}

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslocoDirective, TuiButton, TuiInput, TuiDropdown, TuiInputDate, TuiSelect, TuiDataListWrapper, TuiChevron],
  templateUrl: './edit-user.dialog.html'
})
export class EditUserDialog {
  private readonly fb = inject(FormBuilder);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, EditUserDialogInput>>();

  user: AppUserDto = this.context.data.user;

  saving = false;

  isStaff = computed(() => this.user.userType === 'STAFF');

  private readonly tenantId = this.tenantCtx.currentTenantId();

  private getCurrentRoleCode(): string {
    if (this.user.roleCode) return this.user.roleCode;
    if (this.tenantId && this.user.memberships) {
      const m = this.user.memberships.find(m => m.tenantId === this.tenantId);
      if (m?.roleCode) return m.roleCode;
    }
    return 'USER';
  }

  initialRoleCode = this.getCurrentRoleCode();

  staffRoles = [
    { label: this.transloco.translate('users.role_admin'), value: 'ADMIN' },
    { label: this.transloco.translate('users.role_nutritionist'), value: 'NUTRITIONIST' }
  ];

  staffRoleValues = this.staffRoles.map(r => r.value);

  roleStringify = (value: string): string => {
    const found = this.staffRoles.find(r => r.value === value);
    return found ? found.label : value;
  };

  genderOptions = [
    { label: this.transloco.translate('users.gender_male'), value: 'MALE' as Gender },
    { label: this.transloco.translate('users.gender_female'), value: 'FEMALE' as Gender }
  ];

  genderValues = ['MALE', 'FEMALE'];

  genderStringify = (value: string): string => {
    const found = this.genderOptions.find(g => g.value === value);
    return found ? found.label : value;
  };

  form = this.fb.group({
    firstName: [this.user.firstName, [Validators.required, Validators.maxLength(100)]],
    lastName: [this.user.lastName, [Validators.required, Validators.maxLength(100)]],
    email: [this.user.email, [Validators.required, Validators.email]],
    birthDate: [this.toTuiDay(this.user.birthDate)],
    heightCm: [this.user.heightCm ?? null],
    gender: [this.user.gender ?? null],
    roleCode: [this.initialRoleCode]
  });

  private toTuiDay(value?: string | null): TuiDay | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new TuiDay(year, month - 1, day)
      : null;
  }

  fieldErrors: Record<string, string> = {};

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;
    this.fieldErrors = {};

    const raw = this.form.value;
    const request: UpdateUserRequest = {
      firstName: raw.firstName ?? null,
      lastName: raw.lastName ?? null,
      email: raw.email ?? null,
    };

    if (this.isStaff()) {
      request.birthDate = this.user.birthDate ?? null;
      request.heightCm = this.user.heightCm ?? null;
      request.gender = this.user.gender ?? null;
    } else {
      request.birthDate = raw.birthDate ? (raw.birthDate as TuiDay).toString('yyyy/mm/dd', '-') : null;
      request.heightCm = raw.heightCm ?? null;
      request.gender = raw.gender ?? null;
    }

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving = true;
    this.userRoleService.updateUser(tenantId, this.user.id, request).pipe(
      switchMap((updated) => {
        const newRole = raw.roleCode;
        if (this.isStaff() && newRole && newRole !== this.initialRoleCode) {
          return this.userRoleService.changeRole(tenantId, this.user.id, { roleCode: newRole }).pipe(
            map(() => ({ updated, roleChanged: true, partial: false })),
            catchError(() => {
              this.notify.warning(this.transloco.translate('users.partial_update_warning'));
              return of({ updated, roleChanged: false, partial: true });
            })
          );
        }
        return of({ updated, roleChanged: false, partial: false });
      })
    ).subscribe({
      next: (res) => {
        this.saving = false;
        if (!res.partial) {
          this.notify.success(this.transloco.translate('users.update_success'));
        }
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: (err) => {
        this.saving = false;
        this.handleError(err);
      }
    });
  }

  private handleError(err: HttpErrorResponse) {
    const body = err.error;
    const errorMsg = typeof body === 'object' && body !== null ? body.error || body.message || '' : body || '';

    if (!errorMsg) {
      this.notify.error(this.transloco.translate('users.update_error'));
      return;
    }

    if (errorMsg.toLowerCase().includes('email already in use')) {
      this.fieldErrors = { email: this.transloco.translate('users.email_already_in_use') };
      this.form.get('email')?.markAsDirty();
      this.notify.error(this.transloco.translate('users.email_already_in_use'));
    } else if (errorMsg.toLowerCase().includes('birthdate') && errorMsg.toLowerCase().includes('past')) {
      this.fieldErrors = { birthDate: this.transloco.translate('users.future_birth_date') };
      this.form.get('birthDate')?.markAsDirty();
      this.notify.error(this.transloco.translate('users.future_birth_date'));
    } else if (errorMsg.toLowerCase().includes('heightcm') || errorMsg.toLowerCase().includes('height')) {
      this.fieldErrors = { heightCm: this.transloco.translate('users.height_out_of_range') };
      this.form.get('heightCm')?.markAsDirty();
      this.notify.error(this.transloco.translate('users.height_out_of_range'));
    } else {
      this.notify.error(errorMsg);
    }
  }
}
