import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { InviteUserDialog } from '../users/invite-user.dialog';
import { EditUserDialog } from '../users/edit-user.dialog';
import { EmptyState } from '../../shared/ui/empty-state';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule, ButtonModule, CardModule, TagModule, TooltipModule, IfPermissionDirective, TranslocoDirective, EmptyState],
  templateUrl: './patients-list.page.html'
})
export default class PatientsListPage implements OnInit {
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly dialogService = inject(DialogService);
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

  getRole(user: AppUserDto): string {
    if (user.roleName) return user.roleName;
    const tenantId = this.tenantCtx.currentTenantId();
    const membership = user.memberships?.find(m => m.tenantId === tenantId);
    return membership?.roleCode || 'DESCONOCIDO';
  }

  showInviteDialog() {
    const ref = this.dialogService.open(InviteUserDialog, {
      header: 'Invitar Nuevo Paciente',
      width: '450px',
      modal: true,
      data: { lockedUserType: 'PATIENT' },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Paciente invitado correctamente' });
          this.loadUsers();
        }
      });
    }
  }

  editUser(user: AppUserDto) {
    const ref = this.dialogService.open(EditUserDialog, {
      header: this.transloco.translate('users.edit_user_title'),
      width: '500px',
      modal: true,
      data: { user },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) this.loadUsers();
      });
    }
  }

  revokeAccess(user: AppUserDto) {
    this.confirmationService.confirm({
      message: this.transloco.translate('users.revoke_confirm_msg', { name: user.firstName + ' ' + user.lastName }),
      header: this.transloco.translate('users.revoke_confirm_title'),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: this.transloco.translate('common.yes'),
      rejectLabel: this.transloco.translate('common.no'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.userTenantRoleService.revokeAccess(tenantId, user.id).subscribe(() => {
            this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Paciente removido correctamente' });
            this.loadUsers();
          });
        }
      }
    });
  }
}
