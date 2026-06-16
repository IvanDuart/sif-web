import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { UserTenantRoleService, UpdateUserRequest } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto, Gender } from '../../core/api/models/user.model';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap, map, catchError, of } from 'rxjs';

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, InputTextModule, InputNumberModule, DatePickerModule, SelectModule, TranslocoDirective],
  templateUrl: './edit-user.dialog.html'
})
export class EditUserDialog {
  private fb = inject(FormBuilder);
  private userRoleService = inject(UserTenantRoleService);
  private tenantCtx = inject(TenantContextService);
  private messageService = inject(MessageService);
  private transloco = inject(TranslocoService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  user: AppUserDto = this.config.data.user;

  saving = false;
  today = new Date();

  isStaff = computed(() => this.user.userType === 'STAFF');

  private tenantId = this.tenantCtx.currentTenantId();

  private getCurrentRoleCode(): string {
    if (this.user.roleCode) return this.user.roleCode;
    if (this.tenantId && this.user.memberships) {
      const m = this.user.memberships.find(m => m.tenantId === this.tenantId);
      if (m?.roleCode) return m.roleCode;
    }
    return 'USER';
  }

  initialRoleCode = this.getCurrentRoleCode();

  genderOptions = [
    { label: this.transloco.translate('users.gender_male'), value: 'MALE' as Gender },
    { label: this.transloco.translate('users.gender_female'), value: 'FEMALE' as Gender }
  ];

  staffRoles = [
    { label: this.transloco.translate('users.role_admin'), value: 'ADMIN' },
    { label: this.transloco.translate('users.role_nutritionist'), value: 'NUTRITIONIST' }
  ];

  form = this.fb.group({
    firstName: [this.user.firstName, [Validators.required, Validators.maxLength(100)]],
    lastName: [this.user.lastName, [Validators.required, Validators.maxLength(100)]],
    email: [this.user.email, [Validators.required, Validators.email]],
    birthDate: [this.toDate(this.user.birthDate)],
    heightCm: [this.user.heightCm ?? null],
    gender: [this.user.gender ?? null],
    roleCode: [this.initialRoleCode]
  });

  fieldErrors: Record<string, string> = {};

  private toDate(dateStr: string | undefined | null): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  private formatDate(date: Date | null): string | null {
    if (!date) return null;
    return date.toISOString().slice(0, 10);
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
      request.birthDate = this.formatDate(raw.birthDate ?? null);
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
              this.messageService.add({
                severity: 'warn',
                summary: this.transloco.translate('common.attention'),
                detail: this.transloco.translate('users.partial_update_warning')
              });
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
          this.messageService.add({
            severity: 'success',
            summary: this.transloco.translate('common.success'),
            detail: this.transloco.translate('users.update_success')
          });
        }
        this.ref.close(res.updated);
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
      this.messageService.add({
        severity: 'error',
        summary: this.transloco.translate('common.error'),
        detail: this.transloco.translate('users.update_error')
      });
      return;
    }

    if (errorMsg.toLowerCase().includes('email already in use')) {
      this.fieldErrors = { email: this.transloco.translate('users.email_already_in_use') };
      this.form.get('email')?.markAsDirty();
      this.messageService.add({
        severity: 'error',
        summary: this.transloco.translate('common.error'),
        detail: this.transloco.translate('users.email_already_in_use')
      });
    } else if (errorMsg.toLowerCase().includes('birthdate') && errorMsg.toLowerCase().includes('past')) {
      this.fieldErrors = { birthDate: this.transloco.translate('users.future_birth_date') };
      this.form.get('birthDate')?.markAsDirty();
      this.messageService.add({
        severity: 'error',
        summary: this.transloco.translate('common.error'),
        detail: this.transloco.translate('users.future_birth_date')
      });
    } else if (errorMsg.toLowerCase().includes('heightcm') || errorMsg.toLowerCase().includes('height')) {
      this.fieldErrors = { heightCm: this.transloco.translate('users.height_out_of_range') };
      this.form.get('heightCm')?.markAsDirty();
      this.messageService.add({
        severity: 'error',
        summary: this.transloco.translate('common.error'),
        detail: this.transloco.translate('users.height_out_of_range')
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.transloco.translate('common.error'),
        detail: errorMsg
      });
    }
  }
}
