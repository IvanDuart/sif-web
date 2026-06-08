import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

@Component({
  selector: 'app-change-role',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SelectModule],
  templateUrl: './change-role.dialog.html'
})
export class ChangeRoleDialog implements OnInit {
  private userRoleService = inject(UserTenantRoleService);
  private tenantCtx = inject(TenantContextService);
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  saving = signal(false);
  fullName = signal('');
  userId = '';
  selectedRole = 'USER';

  roles = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Nutricionista', value: 'NUTRITIONIST' },
    { label: 'Paciente', value: 'USER' }
  ];

  ngOnInit() {
    const user = this.config.data.user;
    this.userId = user.id;
    this.fullName.set(user.firstName + ' ' + user.lastName);
    this.selectedRole = this.config.data.currentRole || 'USER';
  }

  submit() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    this.userRoleService.changeRole(tenantId, this.userId, { roleCode: this.selectedRole }).subscribe({
      next: () => {
        this.saving.set(false);
        this.ref.close(true);
      },
      error: () => this.saving.set(false)
    });
  }
}
