import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton } from '@taiga-ui/core';

import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { InviteUserDialog, InviteUserDialogInput } from '../users/invite-user.dialog';
import { EditUserDialog, EditUserDialogInput } from '../users/edit-user.dialog';

@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [RouterModule, IfPermissionDirective, TranslocoDirective, EmptyState, SkeletonComponent, TuiTable, TuiButton],
  templateUrl: './patients-list.page.html'
})
export default class PatientsListPage implements OnInit {
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  users = signal<AppUserDto[]>([]);
  loading = signal(false);

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'PATIENT').subscribe({
      next: (res) => {
        this.users.set(res || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  showInviteDialog() {
    this.modal.open<boolean, InviteUserDialogInput>(InviteUserDialog, {
      label: 'Invitar Nuevo Paciente',
      size: 'm',
      data: { lockedUserType: 'PATIENT' }
    }).subscribe(() => {
      this.notify.success('Paciente invitado correctamente');
      this.loadUsers();
    });
  }

  editUser(user: AppUserDto) {
    this.modal.open<boolean, EditUserDialogInput>(EditUserDialog, {
      label: this.transloco.translate('users.edit_user_title'),
      size: 'm',
      data: { user }
    }).subscribe(() => this.loadUsers());
  }

  revokeAccess(user: AppUserDto) {
    this.confirm.confirm({
      label: this.transloco.translate('users.revoke_confirm_title'),
      content: this.transloco.translate('users.revoke_confirm_msg', { name: user.firstName + ' ' + user.lastName }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (tenantId) {
        this.userTenantRoleService.revokeAccess(tenantId, user.id).subscribe(() => {
          this.notify.success('Paciente removido correctamente');
          this.loadUsers();
        });
      }
    });
  }
}
