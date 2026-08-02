import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { InviteUserDialog, InviteUserDialogInput } from '../users/invite-user.dialog';
import { EditUserDialog, EditUserDialogInput } from '../users/edit-user.dialog';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [RouterModule, IfPermissionDirective, TranslocoDirective, EmptyState, SkeletonComponent, TuiTable, TuiButton, TuiBadge],
  templateUrl: './staff-list.page.html'
})
export default class StaffListPage implements OnInit {
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
    this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'STAFF', { size: 1000 }).subscribe({
      next: (res) => {
        this.users.set(res.content || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getRole(user: AppUserDto): string {
    if (user.roleName) return user.roleName;
    const tenantId = this.tenantCtx.currentTenantId();
    const membership = user.memberships?.find(m => m.tenantId === tenantId);
    return membership?.roleCode || 'DESCONOCIDO';
  }

  showInviteDialog() {
    this.modal.open<boolean, InviteUserDialogInput>(InviteUserDialog, {
      label: 'Invitar Nuevo Miembro del Equipo',
      size: 'm',
      data: { lockedUserType: 'STAFF' }
    }).subscribe(() => {
      this.notify.success('Miembro invitado correctamente');
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
          this.notify.success('Miembro removido correctamente');
          this.loadUsers();
        });
      }
    });
  }
}
