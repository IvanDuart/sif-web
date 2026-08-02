import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiInput } from '@taiga-ui/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { UserTenantRoleService, UserSearchParams } from '../../core/api/services/user-tenant-role.api';
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
  imports: [RouterModule, ReactiveFormsModule, IfPermissionDirective, TranslocoDirective, EmptyState, SkeletonComponent, TuiTable, TuiButton, TuiInput],
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
  totalRecords = signal(0);
  searchControl = new FormControl('');

  sortKey = signal<string>('appUser.firstName');
  sortDirection = signal<'ASC' | 'DESC'>('ASC');

  lastPage = 0;
  lastSize = 25;

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.lastPage = 0;
      this.loadUsers();
    });

    this.loadUsers();
  }

  loadUsers() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const params: UserSearchParams = {
      search: this.searchControl.value?.trim() || undefined,
      page: this.lastPage,
      size: this.lastSize,
      sort: [`${this.sortKey()},${this.sortDirection()}`]
    };

    this.loading.set(true);
    this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'PATIENT', params).subscribe({
      next: (res) => {
        this.users.set(res.content || []);
        this.totalRecords.set(res.page?.totalElements || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('ASC');
    }
    this.lastPage = 0;
    this.loadUsers();
  }

  onPage(page: number) {
    this.lastPage = page;
    this.loadUsers();
  }

  prevPage() {
    if (this.lastPage > 0) {
      this.lastPage--;
      this.loadUsers();
    }
  }

  nextPage() {
    if ((this.lastPage + 1) * this.lastSize < this.totalRecords()) {
      this.lastPage++;
      this.loadUsers();
    }
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
